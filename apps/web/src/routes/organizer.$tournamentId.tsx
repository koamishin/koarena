import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'

import { requireOrganizer } from '../features/auth/auth.functions'
import { getOrganizerTournament } from '../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/organizer/$tournamentId')({
  beforeLoad: async () => {
    await requireOrganizer()
  },
  loader: async ({ params }) => {
    const tournament = await getOrganizerTournament({
      data: { tournamentId: params.tournamentId },
    })
    return { tournament }
  },
  component: OrganizerTournamentLayout,
})

function OrganizerTournamentLayout() {
  const { tournament } = Route.useLoaderData()

  if (!tournament) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          That tournament does not exist.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tournament.name}
          </h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {tournament.gameModeLabel} · /{tournament.slug}
            <Badge
              variant={
                tournament.status === 'LIVE' ? 'success-light' : 'primary-light'
              }
              size="sm"
            >
              {tournament.status.toLowerCase()}
            </Badge>
          </p>
        </div>
        <nav className="flex items-center gap-1">
          <Button size="sm" variant="ghost" render={<Link to="/organizer" />}>
            All tournaments
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/organizer/$tournamentId/challenges"
                params={{ tournamentId: tournament.id }}
              />
            }
          >
            Challenges
          </Button>
        </nav>
      </div>

      {/* The control room, the challenge manager and anything else the
          organizer adds all render here. */}
      <Outlet />
    </div>
  )
}
