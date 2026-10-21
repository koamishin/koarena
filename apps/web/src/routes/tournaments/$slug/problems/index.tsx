import { createFileRoute, Link } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

import { listProblemsFn } from '../../../../features/problems/problems.functions'
import { getTournamentBySlug } from '../../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/$slug/problems/')({
  loader: async ({ params }) => {
    const tournament = await getTournamentBySlug({
      data: { slug: params.slug },
    })
    if (!tournament) return { tournament: null, problems: [] }

    const problems = await listProblemsFn({
      data: { tournamentId: tournament.id },
    })

    return { tournament, problems }
  },
  component: ProblemsPage,
})

function ProblemsPage() {
  const { tournament, problems } = Route.useLoaderData()

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
          <FrameTitle>Problems</FrameTitle>
          <FrameDescription>
            {tournament.name} · {problems.length} problem
            {problems.length === 1 ? '' : 's'} · judged against hidden test
            cases
          </FrameDescription>
        </FrameHeader>

        <FramePanel>
          {problems.length === 0 ? (
            <div className="flex flex-col items-start gap-2 px-1 py-6">
              <p className="text-sm font-medium">No problems yet</p>
              <p className="text-sm text-muted-foreground">
                The organizer has not published any problems.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {problems.map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <Link
                      to="/tournaments/$slug/problems/$problemId"
                      params={{ slug: tournament.slug, problemId: problem.id }}
                      className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                    >
                      {problem.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {problem.difficulty} · {problem.points} point
                      {problem.points === 1 ? '' : 's'} ·{' '}
                      {problem.hiddenTestCaseCount} hidden test case
                      {problem.hiddenTestCaseCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {problem.solved ? (
                      <Badge variant="success-light" size="sm">
                        Solved
                      </Badge>
                    ) : null}
                    <Badge variant="outline" size="sm">
                      {problem.solveCount} solve
                      {problem.solveCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}
