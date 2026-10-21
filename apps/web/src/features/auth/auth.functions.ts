import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { readCurrentUser } from './auth.server'
import type { SessionUser } from './types'

/**
 * Server function wrappers. This file is safe to import from client code —
 * the compiler replaces each handler with an RPC stub in the client bundle and
 * prunes the server-only imports it no longer needs.
 */

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => readCurrentUser(),
)

/** The signed-in user, or a redirect to the sign-in screen. */
export const requireUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser> => {
    const user = await readCurrentUser()

    if (!user) {
      throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
    }

    return user
  },
)

/** The signed-in user, who must be an organizer or an admin. */
export const requireOrganizer = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser> => {
    const user = await readCurrentUser()

    if (!user) {
      throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
    }

    if (user.role !== 'ORGANIZER' && user.role !== 'ADMIN') {
      throw redirect({ to: '/tournaments' })
    }

    return user
  },
)

export type { KoArenaRole, SessionUser } from './types'
