import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireOrganizer } from '../auth/auth.functions'
import { readViewerId } from '../auth/auth.server'
import { resolveParticipant } from '../tournaments/tournaments.server'
import {
  addFile,
  addHint,
  createCategory,
  createChallenge,
  deleteChallenge,
  deleteFile,
  deleteHint,
  getChallenge,
  getChallengeBoard,
  listCategories,
  listChallengesForOrganizer,
  updateChallenge,
} from './challenges.server'

export const getChallengeBoardFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await readViewerId()

    const viewer = userId
      ? await resolveParticipant(data.tournamentId, userId)
      : null

    return getChallengeBoard(data.tournamentId, viewer)
  })

export const getChallengeFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      challengeId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await readViewerId()

    const viewer = userId
      ? await resolveParticipant(data.tournamentId, userId)
      : null

    return getChallenge(data.tournamentId, data.challengeId, viewer)
  })

export const listCategoriesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => listCategories(data.tournamentId))

export const listOrganizerChallenges = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    return listChallengesForOrganizer(data.tournamentId)
  })

export const createCategoryFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      name: z.string().trim().min(1).max(60),
      slug: z.string().trim().min(1).max(60),
      color: z.string().trim().max(20).optional(),
      description: z.string().trim().max(280).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireOrganizer()
    return createCategory(data.tournamentId, {
      name: data.name,
      slug: data.slug,
      color: data.color,
      description: data.description,
    })
  })

export const createChallengeFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      title: z.string().trim().min(3).max(120),
      slug: z.string().trim().min(1).max(80),
      description: z.string().trim().min(1).max(20_000),
      categoryId: z.string().min(1).nullish(),
      difficulty: z
        .enum(['easy', 'medium', 'hard', 'insane'])
        .default('medium'),
      initialPoints: z.number().int().min(0).max(100_000).default(500),
      minPoints: z.number().int().min(0).max(100_000).default(100),
      decayPerSolve: z.number().int().min(0).max(10_000).default(50),
      maxSolves: z.number().int().min(1).max(10_000).nullish(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireOrganizer()
    return createChallenge(data.tournamentId, user.id, {
      title: data.title,
      slug: data.slug,
      description: data.description,
      categoryId: data.categoryId ?? null,
      difficulty: data.difficulty,
      initialPoints: data.initialPoints,
      minPoints: data.minPoints,
      decayPerSolve: data.decayPerSolve,
      maxSolves: data.maxSolves ?? null,
    })
  })

export const updateChallengeFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      challengeId: z.string().min(1),
      title: z.string().trim().min(3).max(120).optional(),
      description: z.string().trim().max(20_000).optional(),
      categoryId: z.string().min(1).nullish(),
      difficulty: z.enum(['easy', 'medium', 'hard', 'insane']).optional(),
      state: z.enum(['DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED']).optional(),
      initialPoints: z.number().int().min(0).max(100_000).optional(),
      minPoints: z.number().int().min(0).max(100_000).optional(),
      decayPerSolve: z.number().int().min(0).max(10_000).optional(),
      maxSolves: z.number().int().min(1).max(10_000).nullish(),
    }),
  )
  .handler(async ({ data }) => {
    await requireOrganizer()
    return updateChallenge(data.challengeId, {
      ...data,
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.maxSolves !== undefined ? { maxSolves: data.maxSolves } : {}),
    })
  })

export const deleteChallengeFn = createServerFn({ method: 'POST' })
  .validator(z.object({ challengeId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    await deleteChallenge(data.challengeId)
    return { deleted: true }
  })

export const addHintFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      challengeId: z.string().min(1),
      content: z.string().trim().min(1).max(2000),
      cost: z.number().int().min(0).max(10_000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireOrganizer()
    return addHint(data.challengeId, user.id, {
      content: data.content,
      cost: data.cost,
    })
  })

export const deleteHintFn = createServerFn({ method: 'POST' })
  .validator(z.object({ hintId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    await deleteHint(data.hintId)
    return { deleted: true }
  })

export const addFileFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      challengeId: z.string().min(1),
      name: z.string().trim().min(1).max(200),
      url: z.string().trim().min(1).max(2000),
      sizeBytes: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ data }) => {
    await requireOrganizer()
    return addFile(data.challengeId, data)
  })

export const deleteFileFn = createServerFn({ method: 'POST' })
  .validator(z.object({ fileId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    await deleteFile(data.fileId)
    return { deleted: true }
  })

export type {
  ChallengeBoard,
  ChallengeCategoryDto,
  ChallengeDto,
} from './types'
