import { createFileRoute } from '@tanstack/react-router'

import { getChallengeBoardFn } from '../../../../features/challenges/challenges.functions'
import { ChallengeBoard } from '../../../../features/challenges/components/ChallengeBoard'
import { getTournamentBySlug } from '../../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/$slug/challenges/')({
  loader: async ({ params }) => {
    const tournament = await getTournamentBySlug({
      data: { slug: params.slug },
    })
    if (!tournament) return { tournament: null, board: null }

    const board = await getChallengeBoardFn({
      data: { tournamentId: tournament.id },
    })

    return { tournament, board }
  },
  component: ChallengesPage,
})

function ChallengesPage() {
  const { tournament, board } = Route.useLoaderData()

  if (!tournament || !board) {
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
      <ChallengeBoard
        tournamentSlug={tournament.slug}
        tournamentName={tournament.name}
        board={board}
      />
    </div>
  )
}
