import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { DownloadIcon, LightbulbIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { getChallengeFn } from '../../../../../features/challenges/challenges.functions'
import { submitFlagFn } from '../../../../../features/flags/flags.functions'
import { getTournamentBySlug } from '../../../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute(
  '/tournaments/$slug/challenges/$challengeId/',
)({
  loader: async ({ params }) => {
    const tournament = await getTournamentBySlug({
      data: { slug: params.slug },
    })
    if (!tournament) return { tournament: null, challenge: null }

    const challenge = await getChallengeFn({
      data: { tournamentId: tournament.id, challengeId: params.challengeId },
    })

    return { tournament, challenge }
  },
  component: ChallengeDetailPage,
})

function ChallengeDetailPage() {
  const { tournament, challenge } = Route.useLoaderData()
  const router = useRouter()
  const [flag, setFlag] = useState('')
  const [busy, setBusy] = useState(false)

  if (!tournament || !challenge) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That challenge does not exist.
        </p>
      </div>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await submitFlagFn({
        data: {
          tournamentId: tournament.id,
          challengeId: challenge.id,
          flag,
        },
      })

      if (result.correct) {
        toast.success(result.message)
        setFlag('')
        await router.invalidate()
      } else {
        toast.error(result.message)
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not submit the flag.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {challenge.categoryName ? (
            <Badge variant="outline" size="sm">
              {challenge.categoryName}
            </Badge>
          ) : null}
          <Badge variant="info-light" size="sm">
            {challenge.difficulty}
          </Badge>
          {challenge.solved ? (
            <Badge variant="success-light" size="sm">
              Solved for {challenge.pointsAwarded} points
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {challenge.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Worth {challenge.currentPoints} points now · {challenge.solveCount}{' '}
          solve{challenge.solveCount === 1 ? '' : 's'} ·{' '}
          <Link
            to="/tournaments/$slug/challenges"
            params={{ slug: tournament.slug }}
            className="hover:text-foreground hover:underline"
          >
            back to the board
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {challenge.description}
          </p>
        </CardContent>
      </Card>

      {challenge.files.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>Files for this challenge.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {challenge.files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <DownloadIcon className="size-4 text-muted-foreground" />
                {file.name}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {Math.round(file.sizeBytes / 1024)} KB
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {challenge.hints.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Hints</CardTitle>
            <CardDescription>
              Hints cost points once the challenge is solved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {challenge.hints.map((hint, index) => (
              <Alert key={hint.id}>
                <LightbulbIcon />
                <AlertTitle>Hint {index + 1}</AlertTitle>
                <AlertDescription>
                  {hint.revealed
                    ? hint.content
                    : `Locked — costs ${hint.cost} points.`}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Submit a flag</CardTitle>
          <CardDescription>
            {challenge.solved
              ? 'You already solved this one.'
              : 'Flags are case sensitive unless the organizer says otherwise.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flag">Flag</Label>
              <Input
                id="flag"
                value={flag}
                placeholder="koarena{...}"
                autoComplete="off"
                spellCheck={false}
                disabled={challenge.solved}
                onChange={(event) => setFlag(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || challenge.solved || flag.trim().length === 0}
              className="self-start"
            >
              {busy ? 'Checking…' : 'Submit flag'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
