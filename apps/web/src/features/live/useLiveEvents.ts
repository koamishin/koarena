import type { LiveEvent } from '@koarena/realtime'
import { useEffect, useRef } from 'react'

/**
 * Subscribe to a tournament's live events.
 *
 * `EventSource` reconnects on its own, so a dropped connection is not an
 * error — the server sends the current standings when the stream reopens.
 *
 * The endpoint is addressed by **slug**, not by id: the stream is public (the
 * scoreboard is public) and a slug is what appears in a URL.
 *
 * This file is isomorphic, not client-only: the subscription happens inside
 * `useEffect`, which never runs on the server, and the route that uses it is
 * compiled for both environments.
 */
export function useLiveEvents(
  tournamentSlug: string | null | undefined,
  onEvent: (event: LiveEvent) => void,
): void {
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!tournamentSlug) return

    const source = new EventSource(`/api/live/${tournamentSlug}`)

    const listener = (raw: Event) => {
      try {
        handler.current(JSON.parse((raw as MessageEvent).data) as LiveEvent)
      } catch {
        // A malformed frame is not worth breaking the stream over.
      }
    }

    const types: LiveEvent['type'][] = [
      'score:update',
      'scoreboard:full',
      'challenge:solved',
      'announce',
      'chat:message',
      'judge:progress',
    ]

    for (const type of types) {
      source.addEventListener(type, listener)
    }

    return () => {
      for (const type of types) {
        source.removeEventListener(type, listener)
      }
      source.close()
    }
  }, [tournamentSlug])
}
