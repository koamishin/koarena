import { getPrisma } from '@koarena/db'

/**
 * Test helpers for the ledger.
 *
 * They talk to the real database: the rules being tested (unique constraints,
 * transactions, cascades) live in Postgres, not in this package.
 */

export const hasDatabase = Boolean(process.env.DATABASE_URL)

let counter = 0

/**
 * A suffix unique across parallel test workers.
 *
 * The process id and a random component matter: two workers can create a row
 * in the same millisecond, and a shared counter would not be enough to keep
 * their email addresses apart.
 */
export function uniqueSuffix(): string {
  counter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}${process.pid.toString(36)}${counter.toString(36)}${random}`
}

/** Create a throwaway user row (a Clerk user mirrored into KoArena). */
export async function createTestUser(role: 'PLAYER' | 'ORGANIZER' = 'PLAYER') {
  const prisma = getPrisma()
  const suffix = uniqueSuffix()

  return prisma.user.create({
    data: {
      id: `user_test_${suffix}`,
      email: `test-${suffix}@koarena.test`,
      firstName: 'Test',
      role,
    },
  })
}

/** Create a tournament to score against. */
export async function createTestTournament(
  userId: string,
  overrides: {
    name?: string
    slug?: string
    gameMode?: 'CTF' | 'ACM' | 'HACKATHON'
    config?: Record<string, unknown>
    status?: 'DRAFT' | 'REGISTRATION' | 'LIVE'
  } = {},
) {
  const prisma = getPrisma()
  const suffix = uniqueSuffix()

  return prisma.tournament.create({
    data: {
      name: overrides.name ?? 'Ledger Test',
      slug: overrides.slug ?? `ledger-${suffix}`,
      gameMode: overrides.gameMode ?? 'CTF',
      status: overrides.status ?? 'LIVE',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() - 1_000),
      endsAt: new Date(Date.now() + 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      config: (overrides.config ?? {
        basePoints: 500,
        firstBloodBonus: 25,
      }) as never,
      createdById: userId,
    },
  })
}

/** Remove everything a test created, in dependency order. */
export async function cleanup(userIds: string[], teamIds: string[] = []) {
  const prisma = getPrisma()

  if (userIds.length > 0) {
    await prisma.tournamentParticipant.deleteMany({
      where: { userId: { in: userIds } },
    })
    await prisma.tournament.deleteMany({
      where: { createdById: { in: userIds } },
    })
  }

  if (teamIds.length > 0) {
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } })
  }

  if (userIds.length > 0) {
    await prisma.team.deleteMany({ where: { ownerId: { in: userIds } } })
    await prisma.teamInvite.deleteMany({
      where: {
        OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }],
      },
    })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
}
