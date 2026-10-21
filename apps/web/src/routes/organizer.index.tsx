import { createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { requireUser } from '../features/auth/auth.functions'
import { TournamentsGrid } from '../features/tournaments/components/TournamentsGrid'
import { listMyOrganizedTournaments } from '../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/organizer/')({
  beforeLoad: async () => {
    await requireUser()
  },
  loader: async () => {
    const tournaments = await listMyOrganizedTournaments()
    return { tournaments }
  },
  component: OrganizerIndexPage,
})

function OrganizerIndexPage() {
  const { tournaments } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Organizer</h1>
          <p className="text-sm text-muted-foreground">
            The tournaments you run. Drafts are only visible to you.
          </p>
        </div>
      </div>

      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Your tournaments</FrameTitle>
          <FrameDescription>
            {tournaments.length} tournament
            {tournaments.length === 1 ? '' : 's'}.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <TournamentsGrid
            tournaments={tournaments}
            showManage
            emptyAction={{
              label: 'Create the first one',
              to: '/organizer/new',
            }}
          />
        </FramePanel>
      </Frame>

      <div className="flex items-center gap-2">
        <Badge variant="outline" size="sm">
          Phase 2
        </Badge>
        <p className="text-xs text-muted-foreground">
          Challenges and flags live under each tournament. The live scoreboard
          is one click away.
        </p>
      </div>
    </div>
  )
}
