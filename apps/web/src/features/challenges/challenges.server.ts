import { getPrisma } from '@koarena/db'
import { ctfPointsAt } from '@koarena/game'

import type {
  ChallengeBoard,
  ChallengeCategoryDto,
  ChallengeDto,
} from './types'

/**
 * Server-only: the challenge board and the organizer\'s challenge manager.
 */

export interface Viewer {
  id: string
  teamId: string | null
}

function pointsFor(challenge: {
  initialPoints: number
  minPoints: number
  decayPerSolve: number
  solveCount: number
}): number {
  return ctfPointsAt(
    {
      basePoints: challenge.initialPoints,
      minPoints: challenge.minPoints,
      decayPerSolve: challenge.decayPerSolve,
    },
    challenge.solveCount,
  )
}

/** The player-facing challenge board. */
export async function getChallengeBoard(
  tournamentId: string,
  viewer: Viewer | null,
): Promise<ChallengeBoard> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, gameMode: true },
  })

  if (!tournament) {
    return { categories: [], challenges: [], lockedCount: 0 }
  }

  const [categories, challenges, solves] = await Promise.all([
    prisma.challengeCategory.findMany({
      where: { tournamentId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { challenges: true } } },
    }),
    prisma.challenge.findMany({
      where: { tournamentId, state: 'PUBLISHED' },
      orderBy: [{ categoryId: 'asc' }, { title: 'asc' }],
      include: {
        category: { select: { id: true, name: true, slug: true, color: true } },
        hints: { orderBy: { createdAt: 'asc' } },
        files: { orderBy: { name: 'asc' } },
        flags: { select: { id: true } },
      },
    }),
    viewer
      ? prisma.challengeSolve.findMany({
          where: {
            challenge: { tournamentId },
            OR: [
              { userId: viewer.id },
              ...(viewer.teamId ? [{ teamId: viewer.teamId }] : []),
            ],
          },
        })
      : Promise.resolve([]),
  ])

  const solvedBy = new Map<string, { solvedAt: string; points: number }>()
  for (const solve of solves) {
    const key = `${solve.challengeId}:${solve.teamId ?? solve.userId}`
    if (!solvedBy.has(key)) {
      solvedBy.set(key, {
        solvedAt: solve.solvedAt.toISOString(),
        points: solve.pointsAwarded,
      })
    }
  }

  const dtos: ChallengeDto[] = challenges.map((challenge) => {
    const solve = viewer
      ? solvedBy.get(`${challenge.id}:${viewer.teamId ?? viewer.id}`)
      : undefined

    const now = Date.now()

    return {
      id: challenge.id,
      slug: challenge.slug,
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      state: challenge.state,
      categoryId: challenge.categoryId,
      categoryName: challenge.category?.name ?? null,
      categorySlug: challenge.category?.slug ?? null,
      categoryColor: challenge.category?.color ?? null,
      currentPoints: pointsFor(challenge),
      initialPoints: challenge.initialPoints,
      minPoints: challenge.minPoints,
      decayPerSolve: challenge.decayPerSolve,
      solveCount: challenge.solveCount,
      maxSolves: challenge.maxSolves,
      firstBloodClaimed: challenge.firstBloodClaimed,
      solved: Boolean(solve),
      solvedAt: solve?.solvedAt ?? null,
      pointsAwarded: solve?.points ?? null,
      hints: challenge.hints.map((hint) => {
        const revealed =
          !hint.unlocksAt ||
          hint.unlocksAt.getTime() <= now ||
          solve !== undefined
        return {
          id: hint.id,
          content: revealed ? hint.content : '',
          cost: hint.cost,
          unlocksAt: hint.unlocksAt?.toISOString() ?? null,
          revealed,
        }
      }),
      files: challenge.files.map((file) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        sizeBytes: file.sizeBytes,
      })),
      flagCount: challenge.flags.length,
      hasFlag: challenge.flags.length > 0,
      createdAt: challenge.createdAt.toISOString(),
    }
  })

  const categoryDtos: ChallengeCategoryDto[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color,
    description: category.description,
    order: category.order,
    challengeCount: category._count.challenges,
  }))

  const lockedCount = await prisma.challenge.count({
    where: { tournamentId, state: 'LOCKED' },
  })

  return {
    categories: categoryDtos,
    challenges: dtos,
    lockedCount,
  }
}

/** One challenge, for the detail page. */
export async function getChallenge(
  tournamentId: string,
  challengeId: string,
  viewer: Viewer | null,
): Promise<ChallengeDto | null> {
  const board = await getChallengeBoard(tournamentId, viewer)
  return (
    board.challenges.find((challenge) => challenge.id === challengeId) ?? null
  )
}

/** The organizer's view: every challenge, published or not. */
export async function listChallengesForOrganizer(
  tournamentId: string,
): Promise<Array<ChallengeDto & { authorName: string | null }>> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, config: true },
  })
  if (!tournament) return []

  const challenges = await prisma.challenge.findMany({
    where: { tournamentId },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      category: { select: { id: true, name: true, slug: true, color: true } },
      hints: { orderBy: { createdAt: 'asc' } },
      files: { orderBy: { name: 'asc' } },
      flags: { select: { id: true } },
      author: { select: { firstName: true, email: true } },
    },
  })

  return challenges.map((challenge) => ({
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    state: challenge.state,
    categoryId: challenge.categoryId,
    categoryName: challenge.category?.name ?? null,
    categorySlug: challenge.category?.slug ?? null,
    categoryColor: challenge.category?.color ?? null,
    currentPoints: pointsFor(challenge),
    initialPoints: challenge.initialPoints,
    minPoints: challenge.minPoints,
    decayPerSolve: challenge.decayPerSolve,
    solveCount: challenge.solveCount,
    maxSolves: challenge.maxSolves,
    firstBloodClaimed: challenge.firstBloodClaimed,
    solved: false,
    solvedAt: null,
    pointsAwarded: null,
    hints: challenge.hints.map((hint) => ({
      id: hint.id,
      content: hint.content,
      cost: hint.cost,
      unlocksAt: hint.unlocksAt?.toISOString() ?? null,
      revealed: true,
    })),
    files: challenge.files.map((file) => ({
      id: file.id,
      name: file.name,
      url: file.url,
      sizeBytes: file.sizeBytes,
    })),
    flagCount: challenge.flags.length,
    hasFlag: challenge.flags.length > 0,
    createdAt: challenge.createdAt.toISOString(),
    authorName: challenge.author.firstName ?? challenge.author.email,
  }))
}

export async function listCategories(
  tournamentId: string,
): Promise<ChallengeCategoryDto[]> {
  const prisma = getPrisma()

  const categories = await prisma.challengeCategory.findMany({
    where: { tournamentId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { challenges: true } } },
  })

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color,
    description: category.description,
    order: category.order,
    challengeCount: category._count.challenges,
  }))
}

export async function createCategory(
  tournamentId: string,
  input: {
    name: string
    slug: string
    color?: string
    description?: string
  },
): Promise<ChallengeCategoryDto> {
  const prisma = getPrisma()

  const category = await prisma.challengeCategory.create({
    data: {
      tournamentId,
      name: input.name,
      slug: input.slug,
      color: input.color ?? null,
      description: input.description ?? null,
    },
    include: { _count: { select: { challenges: true } } },
  })

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color,
    description: category.description,
    order: category.order,
    challengeCount: category._count.challenges,
  }
}

export async function createChallenge(
  tournamentId: string,
  authorId: string,
  input: {
    title: string
    slug: string
    description: string
    categoryId?: string | null
    difficulty?: string
    initialPoints?: number
    minPoints?: number
    decayPerSolve?: number
    maxSolves?: number | null
  },
): Promise<{ id: string; slug: string }> {
  const prisma = getPrisma()

  const clash = await prisma.challenge.findUnique({
    where: { tournamentId_slug: { tournamentId, slug: input.slug } },
    select: { id: true },
  })
  if (clash) throw new Error('A challenge with that URL already exists.')

  const challenge = await prisma.challenge.create({
    data: {
      tournamentId,
      authorId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      categoryId: input.categoryId ?? null,
      difficulty: input.difficulty ?? 'medium',
      initialPoints: input.initialPoints ?? 500,
      minPoints: input.minPoints ?? 100,
      decayPerSolve: input.decayPerSolve ?? 50,
      maxSolves: input.maxSolves ?? null,
      state: 'DRAFT',
    },
    select: { id: true, slug: true },
  })

  return challenge
}

export async function updateChallenge(
  challengeId: string,
  input: {
    title?: string
    description?: string
    categoryId?: string | null
    difficulty?: string
    state?: 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED'
    initialPoints?: number
    minPoints?: number
    decayPerSolve?: number
    maxSolves?: number | null
  },
): Promise<{ id: string; slug: string }> {
  const prisma = getPrisma()

  return prisma.challenge.update({
    where: { id: challengeId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.difficulty !== undefined
        ? { difficulty: input.difficulty }
        : {}),
      ...(input.state !== undefined
        ? {
            state: input.state,
            publishedAt: input.state === 'PUBLISHED' ? new Date() : undefined,
          }
        : {}),
      ...(input.initialPoints !== undefined
        ? { initialPoints: input.initialPoints }
        : {}),
      ...(input.minPoints !== undefined ? { minPoints: input.minPoints } : {}),
      ...(input.decayPerSolve !== undefined
        ? { decayPerSolve: input.decayPerSolve }
        : {}),
      ...(input.maxSolves !== undefined ? { maxSolves: input.maxSolves } : {}),
    },
    select: { id: true, slug: true },
  })
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.challenge.delete({ where: { id: challengeId } })
}

export async function addHint(
  challengeId: string,
  authorId: string,
  input: { content: string; cost?: number; unlocksAt?: Date | null },
): Promise<{ id: string }> {
  const prisma = getPrisma()

  const hint = await prisma.challengeHint.create({
    data: {
      challengeId,
      authorId,
      content: input.content,
      cost: input.cost ?? 0,
      unlocksAt: input.unlocksAt ?? null,
    },
    select: { id: true },
  })

  return hint
}

export async function deleteHint(hintId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.challengeHint.delete({ where: { id: hintId } })
}

export async function addFile(
  challengeId: string,
  input: { name: string; url: string; sizeBytes: number; sha256?: string },
): Promise<{ id: string }> {
  const prisma = getPrisma()

  const file = await prisma.challengeFile.create({
    data: {
      challengeId,
      name: input.name,
      url: input.url,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256 ?? null,
    },
    select: { id: true },
  })

  return file
}

export async function deleteFile(fileId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.challengeFile.delete({ where: { id: fileId } })
}
