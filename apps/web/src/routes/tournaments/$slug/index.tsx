import { Show } from '@clerk/tanstack-react-start'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  getTournamentBySlug,
  listMyTeamsForRegistration,
  registerForTournament,
  withdrawFromTournament,
} from '../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/$slug/')({
  loader: async ({ params }) => {
    const tournament = await getTournamentBySlug({
      data: { slug: params.slug },
    })
    return { tournament }
  },
  component: TournamentDetailPage,
})

function TournamentDetailPage() {
  const { tournament } = Route.useLoaderData()
  const router = useRouter()
  const [teams, setTeams] = useState<Array<{
    id: string
    name: string
    memberCount: number
  }> | null>(null)
  const [teamId, setTeamId] = useState<string>('')
  const [busy, setBusy] = useState(false)

  if (!tournament) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That tournament does not exist.
        </p>
      </div>
    )
  }

  const open =
    tournament.status === 'REGISTRATION' || tournament.status === 'LIVE'

  const join = async () => {
    setBusy(true)
    try {
      const result = await registerForTournament({
        data: { tournamentId: tournament.id, teamId: teamId || undefined },
      })
      if (result.registered) {
        toast.success('You are registered.')
        await router.invalidate()
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not register.',
      )
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    try {
      await withdrawFromTournament({ data: { tournamentId: tournament.id } })
      toast.success('You have withdrawn.')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not withdraw.',
      )
    } finally {
      setBusy(false)
    }
  }

  const loadTeams = async () => {
    const list = await listMyTeamsForRegistration()
    setTeams(list)
    if (list[0]) setTeamId(list[0].id)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <FrameTitle>{tournament.name}</FrameTitle>
              <FrameDescription>
                {tournament.tagline ?? 'No tagline yet.'}
              </FrameDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                {tournament.gameModeLabel}
              </Badge>
              <Badge
                variant={
                  tournament.status === 'LIVE'
                    ? 'success-light'
                    : 'primary-light'
                }
                size="sm"
              >
                {tournament.status.toLowerCase()}
              </Badge>
            </div>
          </div>
        </FrameHeader>

        <FramePanel>
          <div className="flex flex-col gap-4">
            {tournament.description ? (
              <p className="text-sm text-muted-foreground">
                {tournament.description}
              </p>
            ) : null}

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
                <dt className="text-xs text-muted-foreground">Team size</dt>
                <dd className="text-sm font-medium">
                  {tournament.teamSizeMin} to {tournament.teamSizeMax}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Teams</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {tournament.teamCount}
                  {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ''}
                </dd>
              </div>
            </dl>

            {tournament.languages.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Languages</span>
                <div className="flex flex-wrap gap-1.5">
                  {tournament.languages.map((language) => (
                    <Badge key={language.id} variant="outline" size="sm">
                      {language.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Show
                when="signed-in"
                fallback={
                  <p className="text-sm text-muted-foreground">
                    Sign in to register for this tournament.
                  </p>
                }
              >
                {tournament.isRegistered ? (
                  <>
                    <Badge variant="success-light" size="sm">
                      Registered
                    </Badge>
                    <Button
                      variant="outline"
                      onClick={withdraw}
                      disabled={busy}
                    >
                      Withdraw
                    </Button>
                  </>
                ) : (
                  <>
                    {teams === null ? (
                      <Button
                        variant="outline"
                        onClick={loadTeams}
                        disabled={busy}
                      >
                        Choose a team
                      </Button>
                    ) : teams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        You are not on a team yet. Create one from your
                        dashboard.
                      </p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select
                          value={teamId}
                          onValueChange={(value) => setTeamId(value ?? '')}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Pick a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} ({team.memberCount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={join} disabled={busy || !open}>
                          Register
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Show>
            </div>
          </div>
        </FramePanel>
      </Frame>

      {tournament.rules ? (
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Read before you join.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {tournament.rules}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
