import { clerkClient } from '@clerk/tanstack-react-start/server'
import { getPrisma, UserRole } from '@koarena/db'

import type { SessionUser } from './types'

const CLERK_ROLE_KEY = 'role'

/**
 * Server-only: everything in this file talks to Clerk or the database and must
 * never reach the browser. The `.server.ts` suffix makes TanStack Start's
 * import protection deny it in the client environment.
 */

/**
 * Map Clerk's `publicMetadata.role` onto a KoArena role.
 *
 * Clerk is the source of truth for a user's role so it can be changed from the
 * Clerk dashboard; the database mirrors it so it can be joined in queries.
 */
export function mapClerkRole(metadata: unknown): UserRole {
  const raw =
    typeof metadata === 'object' && metadata !== null
      ? (metadata as Record<string, unknown>)[CLERK_ROLE_KEY]
      : undefined

  switch (raw) {
    case 'ADMIN':
      return UserRole.ADMIN
    case 'ORGANIZER':
      return UserRole.ORGANIZER
    case 'JUDGE':
      return UserRole.JUDGE
    default:
      return UserRole.PLAYER
  }
}

/**
 * Mirror a Clerk user into KoArena's own `users` table.
 *
 * Clerk owns credentials, sessions and OAuth. KoArena keeps a row so it can
 * join users in queries without a cross-service call.
 */
export async function syncClerkUser(clerkUser: {
  id: string
  primaryEmailAddressId?: string | null
  emailAddresses?: Array<{ id: string; emailAddress: string }>
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  publicMetadata?: unknown
}): Promise<SessionUser> {
  const prisma = getPrisma()

  const email =
    clerkUser.emailAddresses?.find(
      (address) => address.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress

  if (!email) {
    throw new Error(`Clerk user ${clerkUser.id} has no email address.`)
  }

  const role = mapClerkRole(clerkUser.publicMetadata)

  const user = await prisma.user.upsert({
    where: { id: clerkUser.id },
    update: {
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      handle: clerkUser.username ?? null,
      role,
    },
    create: {
      id: clerkUser.id,
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      handle: clerkUser.username ?? null,
      role,
    },
  })

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    handle: user.handle,
    firstName: user.firstName,
  }
}

/**
 * Promote a player to organizer.
 *
 * Creating a tournament is what makes someone an organizer, so the flow works
 * from a cold start without anyone editing the database by hand.
 */
export async function grantOrganizerRole(userId: string): Promise<void> {
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (
    !user ||
    user.role === UserRole.ORGANIZER ||
    user.role === UserRole.ADMIN
  ) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.ORGANIZER },
  })
}

/** The Clerk user id of the current request, or null. */
export async function readViewerId(): Promise<string | null> {
  const { auth } = await import('@clerk/tanstack-react-start/server')
  const { isAuthenticated, userId } = await auth()
  return isAuthenticated && userId ? userId : null
}

/**
 * The signed-in KoArena user, or null.
 *
 * The Clerk user is only fetched when KoArena has no row yet — after that the
 * webhook keeps it fresh, so a page render costs one database read, not one
 * Clerk API call.
 */
export async function readCurrentUser(): Promise<SessionUser | null> {
  const { auth } = await import('@clerk/tanstack-react-start/server')
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) return null

  const prisma = getPrisma()
  const existing = await prisma.user.findUnique({ where: { id: userId } })

  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      role: existing.role,
      handle: existing.handle,
      firstName: existing.firstName,
    }
  }

  const clerkUser = await clerkClient().users.getUser(userId)
  return syncClerkUser(clerkUser)
}
