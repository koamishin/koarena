import { getPrisma } from '@koarena/db'
import { type LiveEvent, subscribeLiveEvents } from '@koarena/realtime'

import { getStandings } from '../scoring/scoring.server'

/**
 * Server-only: the live SSE stream for one tournament.
 *
 * The stream is a plain HTTP response with `text/event-stream`. The browser's
 * `EventSource` reconnects on its own, so a dropped connection is not an error.
 */

const KEEPALIVE_MS = 15_000

export interface LiveStreamOptions {
  tournamentId: string
  /** Called once when the stream opens, to send the current standings. */
  onOpen?: (send: (event: LiveEvent) => void) => void
}

/**
 * Open a live stream for a tournament.
 *
 * Returns a `Response` that streams events until the client disconnects.
 */
export function openLiveStream(options: LiveStreamOptions): Response {
  const encoder = new TextEncoder()
  let counter = 0
  let unsubscribe: (() => void) | undefined
  let keepalive: ReturnType<typeof setInterval> | undefined
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    if (keepalive) clearInterval(keepalive)
    keepalive = undefined
    unsubscribe?.()
    unsubscribe = undefined
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }

      const send = (event: LiveEvent) => {
        counter += 1
        write(
          `id: ${counter}\n` +
            `event: ${event.type}\n` +
            `data: ${JSON.stringify({ ...event, id: counter })}\n\n`,
        )
      }

      // Tell the browser how long to wait before reconnecting.
      write('retry: 3000\n\n')

      options.onOpen?.(send)

      // Awaited: a subscriber that has not finished its psubscribe would miss
      // every event published in the next moment.
      unsubscribe = await subscribeLiveEvents(options.tournamentId, send)

      keepalive = setInterval(() => {
        // A comment frame keeps proxies from closing an idle connection.
        write(': keepalive\n\n')
      }, KEEPALIVE_MS)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Stops nginx and similar proxies from buffering the stream.
      'X-Accel-Buffering': 'no',
    },
  })
}

/** The current standings, for the stream's first frame. */
export async function currentStandings(tournamentId: string) {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, gameMode: true },
  })

  if (!tournament) return []

  return getStandings(tournamentId, tournament.gameMode)
}
