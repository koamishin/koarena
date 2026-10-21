import type { LiveEvent } from '@koarena/realtime'
import { createFileRoute } from '@tanstack/react-router'
import { currentStandings, openLiveStream } from '../features/live/live.server'
import type { StandingRow } from '../features/scoring/scoring.server'
import { getTournamentBySlug } from '../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/api/live/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const tournament = await getTournamentBySlug({
          data: { slug: params.slug },
        })

        if (!tournament) {
          return new Response('Tournament not found', { status: 404 })
        }

        return openLiveStream({
          tournamentId: tournament.id,
          onOpen: (send: (event: LiveEvent) => void) => {
            void currentStandings(tournament.id).then(
              (standings: StandingRow[]) => {
                send({
                  id: 0,
                  at: Date.now(),
                  type: 'scoreboard:full',
                  payload: { standings },
                })
              },
            )
          },
        })
      },
    },
  },
})
