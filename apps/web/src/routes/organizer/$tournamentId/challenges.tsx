import { createFileRoute, useRouter } from '@tanstack/react-router'
import { KeyRoundIcon, PlusIcon } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

import {
  addHintFn,
  createChallengeFn,
  listOrganizerChallenges,
  updateChallengeFn,
} from '../../../features/challenges/challenges.functions'
import { createFlagFn } from '../../../features/flags/flags.functions'
import { getOrganizerTournament } from '../../../features/tournaments/tournaments.functions'
import { slugify } from '../../../lib/slug'

export const Route = createFileRoute('/organizer/$tournamentId/challenges')({
  loader: async ({ params }) => {
    const tournament = await getOrganizerTournament({
      data: { tournamentId: params.tournamentId },
    })
    if (!tournament) return { tournament: null, challenges: [] }

    const challenges = await listOrganizerChallenges({
      data: { tournamentId: tournament.id },
    })

    return { tournament, challenges }
  },
  component: OrganizerChallengesPage,
})

const STATE_VARIANT = {
  DRAFT: 'outline',
  PUBLISHED: 'success-light',
  LOCKED: 'warning-light',
  ARCHIVED: 'outline',
} as const

function OrganizerChallengesPage() {
  const { tournament, challenges } = Route.useLoaderData()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [flagFor, setFlagFor] = useState<string | null>(null)
  const [flagValue, setFlagValue] = useState('')

  if (!tournament) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That tournament does not exist.
        </p>
      </div>
    )
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await createChallengeFn({
        data: {
          tournamentId: tournament.id,
          title,
          slug: slugify(title),
          description,
        },
      })
      toast.success('Challenge created as a draft.')
      setTitle('')
      setDescription('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not create it.',
      )
    } finally {
      setBusy(false)
    }
  }

  const publish = async (challengeId: string, state: 'DRAFT' | 'PUBLISHED') => {
    try {
      await updateChallengeFn({ data: { challengeId, state } })
      toast.success(state === 'PUBLISHED' ? 'Published.' : 'Moved to draft.')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not update it.',
      )
    }
  }

  const saveFlag = async (challengeId: string) => {
    try {
      await createFlagFn({
        data: {
          tournamentId: tournament.id,
          challengeId,
          value: flagValue,
        },
      })
      toast.success('Flag stored (encrypted).')
      setFlagFor(null)
      setFlagValue('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not save the flag.',
      )
    }
  }

  const addHint = async (challengeId: string) => {
    const content = window.prompt('Hint text')
    if (!content) return
    try {
      await addHintFn({ data: { challengeId, content } })
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not add the hint.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-sm text-muted-foreground">
          {tournament.name} · {challenges.length} challenge
          {challenges.length === 1 ? '' : 's'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New challenge</CardTitle>
          <CardDescription>
            Challenges start as a draft. Publish when the flag is in place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={create}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="challenge-title">Title</Label>
              <Input
                id="challenge-title"
                value={title}
                placeholder="Warmup: the first flag"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="challenge-description">Description</Label>
              <Textarea
                id="challenge-description"
                rows={4}
                value={description}
                placeholder="What the player has to do."
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || title.trim().length < 3}
              className="self-start"
            >
              <PlusIcon />
              Create challenge
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {challenges.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-border px-4 py-8">
            <p className="text-sm font-medium">No challenges yet</p>
            <p className="text-sm text-muted-foreground">
              Create one above to get started.
            </p>
          </div>
        ) : (
          challenges.map((challenge) => (
            <Card key={challenge.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{challenge.title}</CardTitle>
                    <CardDescription>
                      {challenge.currentPoints} points · {challenge.solveCount}{' '}
                      solve{challenge.solveCount === 1 ? '' : 's'} · by{' '}
                      {challenge.authorName ?? 'unknown'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      STATE_VARIANT[
                        challenge.state as keyof typeof STATE_VARIANT
                      ] ?? 'outline'
                    }
                    size="sm"
                  >
                    {challenge.state.toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {challenge.state === 'PUBLISHED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publish(challenge.id, 'DRAFT')}
                  >
                    Move to draft
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => publish(challenge.id, 'PUBLISHED')}
                  >
                    Publish
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFlagFor(flagFor === challenge.id ? null : challenge.id)
                    setFlagValue('')
                  }}
                >
                  <KeyRoundIcon />
                  {flagFor === challenge.id ? 'Cancel' : 'Set flag'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addHint(challenge.id)}
                >
                  Add hint
                </Button>

                <span className="ml-auto text-xs text-muted-foreground">
                  {challenge.flagCount > 0
                    ? `${challenge.flagCount} flag stored`
                    : 'no flag yet'}
                </span>
              </CardContent>

              {flagFor === challenge.id ? (
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Alert>
                      <KeyRoundIcon />
                      <AlertTitle>The flag is encrypted at rest</AlertTitle>
                      <AlertDescription>
                        It is stored as AES-256-GCM ciphertext and never sent to
                        a browser.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-end gap-2">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label htmlFor={`flag-${challenge.id}`}>Flag</Label>
                        <Input
                          id={`flag-${challenge.id}`}
                          value={flagValue}
                          placeholder="koarena{...}"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => setFlagValue(event.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => saveFlag(challenge.id)}
                        disabled={flagValue.trim().length === 0}
                      >
                        Save flag
                      </Button>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
