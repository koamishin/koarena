import type { LiveEvent } from '@koarena/realtime'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RadioIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

import { useLiveEvents } from '../../../features/live/useLiveEvents'
import { getStandingsFn } from '../../../features/scoring/scoring.functions'
import { getTournamentBySlug } from '../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/$slug/scoreboard')({
  loader: async ({ params }) => {
    const tournament = await getTournamentBySlug({
      data: { slug: params.slug },
    })
    if (!tournament) return { tournament: null, standings: [] }

    const standings = await getStandingsFn({
      data: { tournamentId: tournament.id },
    })

    return { tournament, standings }
  },
  component: ScoreboardPage,
})

interface Row {
  rank: number
  id: string
  teamId: string | null
  teamName: string | null
  userName: string | null
  score: number
  solves: number
  penalty: number
}

function ScoreboardPage() {
  const { tournament, standings: initial } = Route.useLoaderData()
  const [standings, setStandings] = useState<Row[]>(initial)
  const [lastEvent, setLastEvent] = useState<string | null>(null)

  const onEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'scoreboard:full') {
      setStandings(event.payload.standings as Row[])
      setLastEvent(null)
      return
    }

    if (event.type === 'challenge:solved') {
      setLastEvent(
        `${event.payload.teamName ?? 'Someone'} solved ${event.payload.challengeTitle} (+${event.payload.points})`,
      )
    }
  }, [])

  useLiveEvents(tournament?.slug, onEvent)

  if (!tournament) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That tournament does not exist.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <FrameTitle>Scoreboard</FrameTitle>
              <FrameDescription>
                {tournament.name} · updates live as solves land.
              </FrameDescription>
            </div>
            <Badge variant="success-light" size="sm">
              <RadioIcon className="mr-1" />
              Live
            </Badge>
          </div>
        </FrameHeader>

        <FramePanel>
          <div className="flex flex-col gap-3">
            {lastEvent ? (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                {lastEvent}
              </p>
            ) : null}

            {standings.length === 0 ? (
              <div className="flex flex-col items-start gap-2 px-1 py-6">
                <p className="text-sm font-medium">Nobody has scored yet</p>
                <p className="text-sm text-muted-foreground">
                  The first solve puts a team on the board.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 border-b border-border pb-2 text-xs text-muted-foreground">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-right">Solved</span>
                  <span className="text-right">Score</span>
                </div>
                {standings.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[3rem_1fr_6rem_6rem] items-center gap-2 border-b border-border py-2 text-sm last:border-b-0"
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {row.rank}
                    </span>
                    <span className="font-medium">
                      {row.teamName ?? row.userName ?? 'Solo player'}
                    </span>
                    <span className="text-right tabular-nums">
                      {row.solves}
                    </span>
                    <span className="text-right font-medium tabular-nums">
                      {row.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FramePanel>
      </Frame>

      <p className="text-xs text-muted-foreground">
        Looking for the challenges?{' '}
        <Link
          to="/tournaments/$slug/challenges"
          params={{ slug: tournament.slug }}
          className="hover:text-foreground hover:underline"
        >
          Open the challenge board
        </Link>
      </p>
    </div>
  )
}
