import { createFileRoute } from '@tanstack/react-router'

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

import { requireUser } from '../features/auth/auth.functions'
import { listAvailableLanguages } from '../features/tournaments/tournaments.functions'
import { TournamentWizard } from '../features/tournaments/wizard/TournamentWizard'

export const Route = createFileRoute('/organizer/new')({
  beforeLoad: async () => {
    await requireUser()
  },
  loader: async () => {
    const languages = await listAvailableLanguages()
    return { languages }
  },
  component: NewTournamentPage,
})

function NewTournamentPage() {
  const { languages } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-4">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>New tournament</FrameTitle>
          <FrameDescription>
            Four steps: the basics, the languages, the scoring rules, then a
            look before you save.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <TournamentWizard languages={languages} />
        </FramePanel>
      </Frame>
    </div>
  )
}
