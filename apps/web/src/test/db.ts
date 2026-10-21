import { getPrisma } from '@koarena/db'

/**
 * Integration-test helpers.
 *
 * These talk to the real database — there is no mock layer, because the rules
 * being tested (unique constraints, cascades, transaction boundaries) live in
 * Postgres, not in the application code.
 *
 * Every helper needs DATABASE_URL; without it the suites skip.
 */

export const hasDatabase = Boolean(process.env.DATABASE_URL)

let counter = 0

export function uniqueSuffix(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter}`
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
