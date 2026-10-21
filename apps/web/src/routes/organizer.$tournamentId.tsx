import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'

import { requireOrganizer } from '../features/auth/auth.functions'
import {
  getOrganizerTournament,
  updateTournament,
} from '../features/tournaments/tournaments.functions'

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
  component: OrganizerTournamentPage,
})

function OrganizerTournamentPage() {
  const { tournament } = Route.useLoaderData()
  const router = useRouter()

  if (!tournament) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That tournament does not exist.
        </p>
      </div>
    )
  }

  const setStatus = async (status: 'DRAFT' | 'SCHEDULED' | 'REGISTRATION') => {
    try {
      await updateTournament({ data: { id: tournament.id, status } })
      toast.success(`Tournament is now ${status.toLowerCase()}.`)
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not update.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tournament.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tournament.gameModeLabel} · /{tournament.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              tournament.status === 'LIVE' ? 'success-light' : 'primary-light'
            }
            size="sm"
          >
            {tournament.status.toLowerCase()}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link to="/organizer" />}
          >
            All tournaments
          </Button>
        </div>
      </div>

      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Setup</FrameTitle>
          <FrameDescription>
            What players will see when the tournament opens.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <dl className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Starts</dt>
              <dd className="text-sm font-medium">
                {new Date(tournament.startsAt).toLocaleString()}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Ends</dt>
              <dd className="text-sm font-medium">
                {new Date(tournament.endsAt).toLocaleString()}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Teams</dt>
              <dd className="text-sm font-medium tabular-nums">
                {tournament.teamCount}
                {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ''}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Languages</dt>
              <dd className="text-sm font-medium tabular-nums">
                {tournament.languages.length}
              </dd>
            </div>
          </dl>
        </FramePanel>
      </Frame>

      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Publish</FrameTitle>
          <FrameDescription>
            A draft is invisible to players. Opening for registration makes it
            joinable.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setStatus('DRAFT')}
              disabled={tournament.status === 'DRAFT'}
            >
              Move to draft
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatus('SCHEDULED')}
              disabled={tournament.status === 'SCHEDULED'}
            >
              Schedule
            </Button>
            <Button
              onClick={() => setStatus('REGISTRATION')}
              disabled={tournament.status === 'REGISTRATION'}
            >
              Open registration
            </Button>
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}
