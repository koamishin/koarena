import { getPrisma, TournamentStatus, TournamentVisibility } from '@koarena/db'
import type { GameModeEnum } from '@koarena/game'
import { listModes, parseConfig, toGameModeId } from '@koarena/game'
import type { JsonValue } from '../../lib/json'
import type {
  AvailableLanguage,
  RegistrationTeam,
  TournamentDetail,
  TournamentSummary,
} from './types'

/**
 * Server-only: the database calls behind the tournament operations.
 *
 * Every function takes the acting user's id explicitly, so the rules are
 * testable without a session.
 */

export function modeLabel(gameMode: string): string {
  return listModes().find((mode) => mode.enum === gameMode)?.label ?? gameMode
}

export async function fetchPublicTournaments(input: {
  status?: 'REGISTRATION' | 'LIVE' | 'SCHEDULED' | 'FINISHED'
  search?: string
  limit: number
}): Promise<TournamentSummary[]> {
  const prisma = getPrisma()

  const tournaments = await prisma.tournament.findMany({
    where: {
      visibility: TournamentVisibility.PUBLIC,
      // A draft is the organizer's private scratchpad — it never goes public.
      status: input.status
        ? input.status
        : { notIn: [TournamentStatus.DRAFT, TournamentStatus.CANCELLED] },
      ...(input.status ? {} : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { tagline: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }],
    take: input.limit,
    include: { _count: { select: { teams: true, participants: true } } },
  })

  return tournaments.map((tournament) => ({
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    tagline: tournament.tagline,
    gameMode: tournament.gameMode as GameModeEnum,
    gameModeLabel: modeLabel(tournament.gameMode),
    status: tournament.status,
    visibility: tournament.visibility,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    teamCount: tournament._count.teams,
    participantCount: tournament._count.participants,
    maxTeams: tournament.maxTeams,
    teamSizeMin: tournament.teamSizeMin,
    teamSizeMax: tournament.teamSizeMax,
  }))
}

async function loadDetail(
  tournamentId: string,
  viewerId: string | null,
): Promise<TournamentDetail | null> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      languages: {
        include: { language: true },
        orderBy: { language: { name: 'asc' } },
      },
      _count: { select: { teams: true, participants: true } },
    },
  })

  if (!tournament) return null

  const participation = viewerId
    ? await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: tournament.id,
            userId: viewerId,
          },
        },
        select: { teamId: true },
      })
    : null

  return {
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    tagline: tournament.tagline,
    description: tournament.description,
    rules: tournament.rules,
    gameMode: tournament.gameMode as GameModeEnum,
    gameModeLabel: modeLabel(tournament.gameMode),
    status: tournament.status,
    visibility: tournament.visibility,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    registrationClosesAt:
      tournament.registrationClosesAt?.toISOString() ?? null,
    teamCount: tournament._count.teams,
    participantCount: tournament._count.participants,
    maxTeams: tournament.maxTeams,
    teamSizeMin: tournament.teamSizeMin,
    teamSizeMax: tournament.teamSizeMax,
    requireVerifiedEmail: tournament.requireVerifiedEmail,
    joinCode: tournament.joinCode,
    createdById: tournament.createdById,
    config: tournament.config as JsonValue,
    languages: tournament.languages.map((entry) => ({
      id: entry.language.id,
      slug: entry.language.slug,
      name: entry.language.name,
      difficultyWeight: entry.language.difficultyWeight,
    })),
    isRegistered: participation !== null,
    registeredTeamId: participation?.teamId ?? null,
  }
}

export async function getTournamentBySlugFor(
  slug: string,
  viewerId: string | null,
): Promise<TournamentDetail | null> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!tournament) return null
  return loadDetail(tournament.id, viewerId)
}

export async function getTournamentForOrganizer(
  user: { id: string; role: string },
  tournamentId: string,
): Promise<TournamentDetail | null> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, createdById: true },
  })

  if (!tournament) return null
  if (tournament.createdById !== user.id && user.role !== 'ADMIN') {
    throw new Error('Only the organizer can open this tournament.')
  }

  return loadDetail(tournament.id, user.id)
}

export async function createTournamentFor(
  userId: string,
  input: {
    name: string
    slug: string
    tagline?: string
    description?: string
    rules?: string
    gameMode: GameModeEnum
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
    startsAt: Date
    endsAt: Date
    registrationClosesAt?: Date
    teamSizeMin: number
    teamSizeMax: number
    maxTeams?: number
    languageIds: string[]
    config: Record<string, unknown>
  },
): Promise<{ id: string; slug: string }> {
  const prisma = getPrisma()

  if (input.endsAt <= input.startsAt) {
    throw new Error('The tournament must end after it starts.')
  }
  if (input.teamSizeMax < input.teamSizeMin) {
    throw new Error('The maximum team size cannot be smaller than the minimum.')
  }
  if (!input.slug) {
    throw new Error('Give the tournament a name with letters in it.')
  }

  const clash = await prisma.tournament.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  })
  if (clash) throw new Error('That tournament URL is already taken.')

  // Throws with a readable message when the config does not fit the mode.
  const config = parseConfig(toGameModeId(input.gameMode), input.config)

  const tournament = await prisma.tournament.create({
    data: {
      name: input.name,
      slug: input.slug,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      rules: input.rules ?? null,
      gameMode: input.gameMode,
      status: TournamentStatus.DRAFT,
      visibility: input.visibility,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      registrationClosesAt: input.registrationClosesAt ?? null,
      teamSizeMin: input.teamSizeMin,
      teamSizeMax: input.teamSizeMax,
      maxTeams: input.maxTeams ?? null,
      config: config as object,
      createdById: userId,
      languages: {
        create: input.languageIds.map((languageId) => ({ languageId })),
      },
    },
    select: { id: true, slug: true },
  })

  return tournament
}

export async function listTournamentsForOrganizer(
  userId: string,
): Promise<TournamentSummary[]> {
  const prisma = getPrisma()

  const tournaments = await prisma.tournament.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { teams: true, participants: true } } },
  })

  return tournaments.map((tournament) => ({
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    tagline: tournament.tagline,
    gameMode: tournament.gameMode as GameModeEnum,
    gameModeLabel: modeLabel(tournament.gameMode),
    status: tournament.status,
    visibility: tournament.visibility,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    teamCount: tournament._count.teams,
    participantCount: tournament._count.participants,
    maxTeams: tournament.maxTeams,
    teamSizeMin: tournament.teamSizeMin,
    teamSizeMax: tournament.teamSizeMax,
  }))
}

export async function updateTournamentFor(
  user: { id: string; role: string },
  input: {
    id: string
    name?: string
    tagline?: string | null
    description?: string | null
    rules?: string | null
    visibility?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
    startsAt?: Date
    endsAt?: Date
    registrationClosesAt?: Date
    teamSizeMin?: number
    teamSizeMax?: number
    maxTeams?: number | null
    status?: 'DRAFT' | 'SCHEDULED' | 'REGISTRATION' | 'LIVE' | 'FINISHED'
    languageIds?: string[]
    config?: Record<string, unknown>
  },
): Promise<{ id: string; slug: string }> {
  const prisma = getPrisma()

  const existing = await prisma.tournament.findUnique({
    where: { id: input.id },
    select: { id: true, slug: true, createdById: true, gameMode: true },
  })

  if (!existing) throw new Error('Tournament not found.')
  if (existing.createdById !== user.id && user.role !== 'ADMIN') {
    throw new Error('Only the organizer can change this tournament.')
  }

  const gameMode = existing.gameMode as GameModeEnum

  const config =
    input.config !== undefined
      ? parseConfig(toGameModeId(gameMode), input.config)
      : undefined

  const tournament = await prisma.tournament.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.rules !== undefined ? { rules: input.rules } : {}),
      ...(input.visibility !== undefined
        ? { visibility: input.visibility }
        : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.registrationClosesAt !== undefined
        ? { registrationClosesAt: input.registrationClosesAt }
        : {}),
      ...(input.teamSizeMin !== undefined
        ? { teamSizeMin: input.teamSizeMin }
        : {}),
      ...(input.teamSizeMax !== undefined
        ? { teamSizeMax: input.teamSizeMax }
        : {}),
      ...(input.maxTeams !== undefined ? { maxTeams: input.maxTeams } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(config !== undefined ? { config: config as object } : {}),
    },
    select: { id: true, slug: true },
  })

  if (input.languageIds) {
    await prisma.tournamentLanguage.deleteMany({
      where: { tournamentId: input.id },
    })
    await prisma.tournamentLanguage.createMany({
      data: input.languageIds.map((languageId) => ({
        tournamentId: input.id,
        languageId,
      })),
    })
  }

  return tournament
}

export async function registerForTournamentFor(
  userId: string,
  input: { tournamentId: string; teamId?: string },
): Promise<{ registered: true }> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    select: {
      id: true,
      status: true,
      maxTeams: true,
      teamSizeMin: true,
      teamSizeMax: true,
    },
  })

  if (!tournament) throw new Error('Tournament not found.')
  if (tournament.status === TournamentStatus.FINISHED) {
    throw new Error('That tournament has already finished.')
  }
  if (tournament.status === TournamentStatus.DRAFT) {
    throw new Error('That tournament has not opened for registration yet.')
  }

  const teamId = input.teamId ?? null

  if (teamId) {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    })

    if (!membership) {
      throw new Error('You are not on that team.')
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    })

    if (!team) throw new Error('Team not found.')

    if (team._count.members < tournament.teamSizeMin) {
      throw new Error(
        `Your team needs at least ${tournament.teamSizeMin} members to register.`,
      )
    }
    if (team._count.members > tournament.teamSizeMax) {
      throw new Error(
        `Your team is larger than the ${tournament.teamSizeMax} member limit.`,
      )
    }

    const registered = await prisma.tournamentTeam.count({
      where: { tournamentId: tournament.id },
    })

    if (tournament.maxTeams && registered >= tournament.maxTeams) {
      throw new Error('This tournament is full.')
    }
  }

  const existing = await prisma.tournamentParticipant.findUnique({
    where: {
      tournamentId_userId: { tournamentId: tournament.id, userId },
    },
    select: { id: true },
  })

  if (!existing) {
    await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, userId, teamId },
    })
  } else if (teamId !== null) {
    await prisma.tournamentParticipant.update({
      where: { id: existing.id },
      data: { teamId },
    })
  }

  if (teamId) {
    const alreadyRegistered = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId: tournament.id, teamId } },
      select: { id: true },
    })

    if (!alreadyRegistered) {
      await prisma.tournamentTeam.create({
        data: { tournamentId: tournament.id, teamId },
      })
    }
  }

  return { registered: true }
}

export async function withdrawFromTournamentFor(
  userId: string,
  tournamentId: string,
): Promise<{ withdrawn: true }> {
  const prisma = getPrisma()

  const participation = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true, teamId: true },
  })

  if (!participation) throw new Error('You are not registered.')

  await prisma.tournamentParticipant.delete({
    where: { id: participation.id },
  })

  if (participation.teamId) {
    await prisma.tournamentTeam.deleteMany({
      where: { tournamentId, teamId: participation.teamId },
    })
  }

  return { withdrawn: true }
}

export async function fetchAvailableLanguages(): Promise<AvailableLanguage[]> {
  const prisma = getPrisma()

  return prisma.language.findMany({
    where: { enabled: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      difficultyWeight: true,
    },
  })
}

export async function listTeamsForRegistration(
  userId: string,
): Promise<RegistrationTeam[]> {
  const prisma = getPrisma()

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  })

  return memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
    memberCount: membership.team._count.members,
    role: membership.role,
  }))
}
