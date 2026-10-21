import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'

import { updateTournament } from '../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/organizer/$tournamentId/')({
  component: OrganizerControlRoom,
})

/** The parent loaded the tournament; the child reads it from there. */
const tournamentRoute = getRouteApi('/organizer/$tournamentId')

function OrganizerControlRoom() {
  const { tournament } = tournamentRoute.useLoaderData()
  const router = useRouter()

  if (!tournament) {
    return (
      <p className="text-sm text-muted-foreground">
        That tournament does not exist.
      </p>
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
    <Frame spacing="default" variant="default">
      <FrameHeader>
        <FrameTitle>Setup</FrameTitle>
        <FrameDescription>
          What players will see when the tournament opens.
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="flex flex-col gap-4">
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

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
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
        </div>
      </FramePanel>
    </Frame>
  )
}
