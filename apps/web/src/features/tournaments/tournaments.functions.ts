import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { slugify } from '../../lib/slug'
import { requireOrganizer, requireUser } from '../auth/auth.functions'
import { grantOrganizerRole, readViewerId } from '../auth/auth.server'
import {
  createTournamentFor,
  fetchAvailableLanguages,
  fetchPublicTournaments,
  getTournamentBySlugFor,
  getTournamentForOrganizer,
  listTeamsForRegistration,
  listTournamentsForOrganizer,
  registerForTournamentFor,
  updateTournamentFor,
  withdrawFromTournamentFor,
} from './tournaments.server'

const gameModeSchema = z.enum([
  'CTF',
  'ATTACK_DEFENSE',
  'HACKATHON',
  'ACM',
  'POLYGLOT_BATTLE',
  'CODE_GOLF',
  'BUG_HUNT',
  'KNOCKOUT',
])

export const listPublicTournaments = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      status: z
        .enum(['REGISTRATION', 'LIVE', 'SCHEDULED', 'FINISHED'])
        .optional(),
      search: z.string().trim().max(80).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ data }) => fetchPublicTournaments(data))

export const getTournamentBySlug = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const viewerId = await readViewerId()
    return getTournamentBySlugFor(data.slug, viewerId)
  })

export const listMyOrganizedTournaments = createServerFn({
  method: 'GET',
}).handler(async () => {
  const user = await requireUser()
  return listTournamentsForOrganizer(user.id)
})

export const getOrganizerTournament = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireOrganizer()
    return getTournamentForOrganizer(user, data.tournamentId)
  })

export const createTournament = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(3, 'Name is too short').max(80),
      slug: z
        .string()
        .trim()
        .max(60)
        .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes')
        .optional(),
      tagline: z.string().trim().max(140).optional(),
      description: z.string().trim().max(4000).optional(),
      rules: z.string().trim().max(8000).optional(),
      gameMode: gameModeSchema,
      visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      registrationClosesAt: z.coerce.date().optional(),
      teamSizeMin: z.number().int().min(1).max(20).default(1),
      teamSizeMax: z.number().int().min(1).max(20).default(5),
      maxTeams: z.number().int().min(1).max(1000).optional(),
      languageIds: z.array(z.string().min(1)).default([]),
      config: z.record(z.string(), z.unknown()).default({}),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()

    const result = await createTournamentFor(user.id, {
      ...data,
      name: data.name.trim(),
      slug: slugify(data.slug || data.name),
      tagline: data.tagline?.trim() || undefined,
      description: data.description?.trim() || undefined,
      rules: data.rules?.trim() || undefined,
    })

    await grantOrganizerRole(user.id)

    return result
  })

export const updateTournament = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(3).max(80).optional(),
      tagline: z.string().trim().max(140).nullable().optional(),
      description: z.string().trim().max(4000).nullable().optional(),
      rules: z.string().trim().max(8000).nullable().optional(),
      visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      registrationClosesAt: z.coerce.date().optional(),
      teamSizeMin: z.number().int().min(1).max(20).optional(),
      teamSizeMax: z.number().int().min(1).max(20).optional(),
      maxTeams: z.number().int().min(1).max(1000).nullable().optional(),
      status: z
        .enum(['DRAFT', 'SCHEDULED', 'REGISTRATION', 'LIVE', 'FINISHED'])
        .optional(),
      languageIds: z.array(z.string().min(1)).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireOrganizer()
    return updateTournamentFor(user, data)
  })

export const registerForTournament = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      teamId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    return registerForTournamentFor(user.id, data)
  })

export const withdrawFromTournament = createServerFn({ method: 'POST' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withdrawFromTournamentFor(user.id, data.tournamentId)
  })

export const listAvailableLanguages = createServerFn({ method: 'GET' }).handler(
  async () => fetchAvailableLanguages(),
)

export const listMyTeamsForRegistration = createServerFn({
  method: 'GET',
}).handler(async () => {
  const user = await requireUser()
  return listTeamsForRegistration(user.id)
})

export type {
  AvailableLanguage,
  RegistrationTeam,
  TournamentDetail,
  TournamentLanguage,
  TournamentSummary,
} from './types'
