import { createFileRoute } from '@tanstack/react-router'

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

import { TournamentsGrid } from '../../features/tournaments/components/TournamentsGrid'
import { listPublicTournaments } from '../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/')({
  loader: async () => {
    const tournaments = await listPublicTournaments({ data: { limit: 100 } })
    return { tournaments }
  },
  component: TournamentsPage,
})

function TournamentsPage() {
  const { tournaments } = Route.useLoaderData()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Tournaments</FrameTitle>
          <FrameDescription>
            Live and upcoming competitions across every game mode.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <TournamentsGrid
            tournaments={tournaments}
            emptyAction={{ label: 'Create the first one', to: '/organizer' }}
          />
        </FramePanel>
      </Frame>
    </div>
  )
}
