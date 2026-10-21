import { getPrisma, TeamRole } from '@koarena/db'

import type { InvitePreview, TeamDetail, TeamSummary } from './types'

/**
 * Server-only: the database calls behind the team operations.
 *
 * Every function takes the acting user's id explicitly, so the rules are
 * testable without a session.
 */

const INVITE_TTL_HOURS = 24 * 7

function inviteToken(): string {
  // 24 hex chars is plenty for a 7-day, single-use invite.
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export async function listTeamsForUser(userId: string): Promise<TeamSummary[]> {
  const prisma = getPrisma()

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: { team: { include: { _count: { select: { members: true } } } } },
  })

  return memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
    slug: membership.team.slug,
    description: membership.team.description,
    role: membership.role,
    memberCount: membership.team._count.members,
    ownerId: membership.team.ownerId,
  }))
}

export async function getTeamForMember(
  userId: string,
  teamId: string,
): Promise<TeamDetail | null> {
  const prisma = getPrisma()

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: {
          user: {
            select: { id: true, email: true, handle: true, firstName: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  })

  if (!team) return null

  const isMember = team.members.some((member) => member.userId === userId)
  if (!isMember) return null

  const pendingInvites =
    team.ownerId === userId
      ? await prisma.teamInvite.findMany({
          where: { teamId: team.id, acceptedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, receiverEmail: true, expiresAt: true },
        })
      : []

  const membership = team.members.find((member) => member.userId === userId)

  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    role: membership?.role ?? TeamRole.MEMBER,
    memberCount: team._count.members,
    ownerId: team.ownerId,
    members: team.members.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    })),
    pendingInvites: pendingInvites.map((invite) => ({
      id: invite.id,
      receiverEmail: invite.receiverEmail,
      expiresAt: invite.expiresAt.toISOString(),
    })),
    isOwner: team.ownerId === userId,
  }
}

export async function createTeamFor(
  userId: string,
  input: { name: string; slug: string; description?: string },
): Promise<TeamSummary> {
  const prisma = getPrisma()

  const existing = await prisma.team.findUnique({
    where: { ownerId_slug: { ownerId: userId, slug: input.slug } },
    select: { id: true },
  })

  if (existing) {
    throw new Error('You already have a team with that name.')
  }

  const team = await prisma.team.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      ownerId: userId,
      members: { create: { userId, role: TeamRole.LEADER } },
    },
    include: { _count: { select: { members: true } } },
  })

  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    role: TeamRole.LEADER,
    memberCount: team._count.members,
    ownerId: team.ownerId,
  }
}

export async function updateTeamFor(
  userId: string,
  input: { teamId: string; name?: string; description?: string | null },
): Promise<TeamSummary> {
  const prisma = getPrisma()

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    include: { _count: { select: { members: true } } },
  })

  if (!team) throw new Error('Team not found.')
  if (team.ownerId !== userId) {
    throw new Error('Only the team owner can change these details.')
  }

  const updated = await prisma.team.update({
    where: { id: input.teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
    include: { _count: { select: { members: true } } },
  })

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    role: TeamRole.LEADER,
    memberCount: updated._count.members,
    ownerId: updated.ownerId,
  }
}

export async function deleteTeamFor(
  userId: string,
  teamId: string,
): Promise<{ deleted: true }> {
  const prisma = getPrisma()

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true },
  })

  if (!team) throw new Error('Team not found.')
  if (team.ownerId !== userId) {
    throw new Error('Only the team owner can delete the team.')
  }

  await prisma.team.delete({ where: { id: team.id } })
  return { deleted: true }
}

export async function inviteToTeamFor(
  userId: string,
  input: { teamId: string; email: string },
): Promise<{ token: string; expiresAt: string }> {
  const prisma = getPrisma()

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, ownerId: true },
  })

  if (!team) throw new Error('Team not found.')
  if (team.ownerId !== userId) {
    throw new Error('Only the team owner can invite members.')
  }

  const email = input.email.trim().toLowerCase()

  const existingMember = await prisma.teamMember.findFirst({
    where: { teamId: team.id, user: { email } },
    select: { id: true },
  })

  if (existingMember) {
    throw new Error('That person is already on the team.')
  }

  const token = inviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

  await prisma.teamInvite.create({
    data: {
      teamId: team.id,
      senderId: userId,
      receiverEmail: email,
      token,
      expiresAt,
    },
  })

  return { token, expiresAt: expiresAt.toISOString() }
}

export async function revokeInviteFor(
  userId: string,
  inviteId: string,
): Promise<{ revoked: true }> {
  const prisma = getPrisma()

  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: { team: { select: { ownerId: true } } },
  })

  if (!invite) throw new Error('Invite not found.')
  if (invite.team.ownerId !== userId) {
    throw new Error('Only the team owner can revoke an invite.')
  }

  await prisma.teamInvite.delete({ where: { id: invite.id } })
  return { revoked: true }
}

export async function getInviteByToken(
  token: string,
): Promise<InvitePreview | null> {
  const prisma = getPrisma()

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      team: { select: { name: true, slug: true } },
      sender: { select: { email: true } },
    },
  })

  if (!invite) return null

  return {
    token: invite.token,
    teamName: invite.team.name,
    teamSlug: invite.team.slug,
    senderEmail: invite.sender.email,
    expiresAt: invite.expiresAt.toISOString(),
    accepted: invite.acceptedAt !== null,
  }
}

export async function acceptInviteFor(
  user: { id: string; email: string },
  token: string,
): Promise<{ teamId: string }> {
  const prisma = getPrisma()

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
  })

  if (!invite) throw new Error('That invite does not exist.')
  if (invite.acceptedAt) throw new Error('That invite has already been used.')
  if (invite.expiresAt < new Date()) throw new Error('That invite has expired.')
  if (invite.receiverEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('That invite was sent to a different email address.')
  }

  const member = await prisma.teamMember.findFirst({
    where: { teamId: invite.teamId, userId: user.id },
    select: { id: true },
  })

  if (!member) {
    await prisma.teamMember.create({
      data: { teamId: invite.teamId, userId: user.id, role: TeamRole.MEMBER },
    })
  }

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date(), receiverId: user.id },
  })

  return { teamId: invite.teamId }
}

export async function removeMemberFor(
  actingUserId: string,
  input: { teamId: string; userId: string },
): Promise<{ removed: true }> {
  const prisma = getPrisma()

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, ownerId: true },
  })

  if (!team) throw new Error('Team not found.')

  const isOwner = team.ownerId === actingUserId
  const isSelf = input.userId === actingUserId

  if (!isOwner && !isSelf) {
    throw new Error('Only the team owner can remove other members.')
  }

  if (input.userId === team.ownerId) {
    throw new Error('The owner cannot be removed. Transfer the team first.')
  }

  await prisma.teamMember.deleteMany({
    where: { teamId: input.teamId, userId: input.userId },
  })

  return { removed: true }
}
