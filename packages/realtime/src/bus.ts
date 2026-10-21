import Redis from 'ioredis'

import { type LiveEvent, type LiveEventBase, liveChannel } from './events'

/**
 * The live bus.
 *
 * One Redis connection publishes, one subscribes. The subscriber fans out to
 * every SSE connection in this process, so a hundred browsers cost one
 * subscription rather than a hundred.
 */

let publisher: Redis | undefined
let subscriber: Redis | undefined

/** The Redis URL, or null when Redis is not configured. */
export function redisUrl(): string | null {
  return process.env.REDIS_URL ?? null
}

/** True when a live bus is available. */
export function hasRedis(): boolean {
  return Boolean(redisUrl())
}

function getPublisher(): Redis | null {
  const url = redisUrl()
  if (!url) return null

  if (!publisher) {
    publisher = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: true,
    })
    publisher.on('error', () => {
      // A transient Redis failure must not take the request down; the
      // leaderboard falls back to the database.
    })
  }

  return publisher
}

function getSubscriber(): Redis | null {
  const url = redisUrl()
  if (!url) return null

  if (!subscriber) {
    subscriber = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    })
    subscriber.on('error', () => {})
  }

  return subscriber
}

/** tournamentId -> handlers */
const handlers = new Map<string, Set<(event: LiveEvent) => void>>()

/**
 * The psubscribe promise.
 *
 * It matters that this is awaited before a subscriber is registered: Redis
 * drops a published message for a client that has not finished subscribing
 * yet, so a subscriber that registered early would silently miss the first
 * events after it attached.
 */
let wiring: Promise<void> | null = null

function ensureWired(): Promise<void> {
  if (wiring) return wiring

  const client = getSubscriber()
  if (!client) return Promise.resolve()

  client.on(
    'pmessage',
    (_pattern: string, channel: string, message: string) => {
      const tournamentId = channel.slice('live:'.length)
      const listeners = handlers.get(tournamentId)
      if (!listeners || listeners.size === 0) return

      let event: LiveEvent
      try {
        event = JSON.parse(message) as LiveEvent
      } catch {
        return
      }

      for (const listener of listeners) {
        try {
          listener(event)
        } catch {
          // A broken listener must not stop the others.
        }
      }
    },
  )

  wiring = client
    .psubscribe('live:*')
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error('[realtime] psubscribe failed', error)
    })

  return wiring
}

/**
 * Publish an event to every subscriber of a tournament.
 *
 * Returns false when Redis is unavailable — callers treat that as "no live
 * update" and the client refetches instead.
 */
export async function publishLiveEvent(
  tournamentId: string,
  event: Omit<LiveEvent, keyof LiveEventBase> | LiveEvent,
): Promise<boolean> {
  const client = getPublisher()
  if (!client) {
    console.error(
      '[realtime] publish skipped — REDIS_URL is not set in this context',
    )
    return false
  }

  const payload: LiveEvent = {
    ...(event as LiveEvent),
    id: (event as LiveEvent).id ?? 0,
    at: (event as LiveEvent).at ?? Date.now(),
  }

  try {
    await client.publish(liveChannel(tournamentId), JSON.stringify(payload))
    return true
  } catch (error) {
    // A failed publish means the live board goes stale until the next reload.
    // It must be loud: a silent failure here looks like "the score never
    // updated" and is nearly impossible to trace from the UI.
    console.error('[realtime] publish failed', error)
    return false
  }
}

/**
 * Subscribe to a tournament's events.
 *
 * Returns an unsubscribe function.
 */
export async function subscribeLiveEvents(
  tournamentId: string,
  handler: (event: LiveEvent) => void,
): Promise<() => void> {
  await ensureWired()

  let listeners = handlers.get(tournamentId)
  if (!listeners) {
    listeners = new Set()
    handlers.set(tournamentId, listeners)
  }
  listeners.add(handler)

  return () => {
    const current = handlers.get(tournamentId)
    if (!current) return
    current.delete(handler)
    if (current.size === 0) handlers.delete(tournamentId)
  }
}

/** Close the Redis connections. Used by tests and graceful shutdown. */
export async function closeLiveBus(): Promise<void> {
  handlers.clear()
  wiring = null

  const open = [publisher, subscriber].filter(Boolean) as Redis[]
  await Promise.all(open.map((client) => client.quit().catch(() => undefined)))
  publisher = undefined
  subscriber = undefined
}
