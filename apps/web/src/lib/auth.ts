import { auth } from '@clerk/tanstack-react-start/server'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

/**
 * Require a signed-in user.
 *
 * Both layers matter: the server function is the only place that reads the
 * session, and `beforeLoad` runs on the server too, so an unauthenticated
 * request never reaches the component.
 */
export const requireUser = createServerFn().handler(async () => {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
  }

  return { userId }
})

/** Read the session without requiring one. */
export const getSession = createServerFn().handler(async () => {
  const { isAuthenticated, userId, sessionId } = await auth()
  return { isAuthenticated, userId, sessionId }
})
