import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireOrganizer, requireUser } from '../auth/auth.functions'
import { resolveParticipant } from '../tournaments/tournaments.server'
import { createFlag, deleteFlag, submitFlag } from './flags.server'

export const submitFlagFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      challengeId: z.string().min(1),
      flag: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const participant = await resolveParticipant(data.tournamentId, user.id)

    return submitFlag(participant, data)
  })

export const createFlagFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      challengeId: z.string().min(1),
      value: z.string().trim().min(1).max(2000),
      format: z.enum(['STATIC', 'REGEX', 'CASE_INSENSITIVE']).default('STATIC'),
      points: z.number().int().min(0).max(100_000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    await requireOrganizer()
    return createFlag(data.tournamentId, data.challengeId, {
      value: data.value,
      format: data.format,
      points: data.points,
    })
  })

export const deleteFlagFn = createServerFn({ method: 'POST' })
  .validator(z.object({ flagId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    await deleteFlag(data.flagId)
    return { deleted: true }
  })
