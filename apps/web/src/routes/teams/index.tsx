import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

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

import { requireUser } from '../../features/auth/auth.functions'
import { createTeam, listMyTeams } from '../../features/teams/teams.functions'

export const Route = createFileRoute('/teams/')({
  beforeLoad: async () => {
    await requireUser()
  },
  loader: async () => {
    const teams = await listMyTeams()
    return { teams }
  },
  component: TeamsPage,
})

function TeamsPage() {
  const { teams } = Route.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const team = await createTeam({ data: { name, description } })
      toast.success(`${team.name} is ready.`)
      setName('')
      setDescription('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not create the team.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your teams</h1>
        <p className="text-sm text-muted-foreground">
          A team is reusable across tournaments. Its roster is what registers
          for one.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Create a team</CardTitle>
            <CardDescription>You become its first member.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={submit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-name">Name</Label>
                <Input
                  id="team-name"
                  value={name}
                  placeholder="Segfault Society"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-description">Description</Label>
                <Input
                  id="team-description"
                  value={description}
                  placeholder="Optional"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy || name.trim().length < 2}>
                Create team
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:col-span-2">
          {teams.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-md border border-border px-4 py-8">
              <p className="text-sm font-medium">No teams yet</p>
              <p className="text-sm text-muted-foreground">
                Create one on the left to register for a tournament.
              </p>
            </div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <Link
                    to="/teams/$teamId"
                    params={{ teamId: team.id }}
                    className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                  >
                    {team.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {team.memberCount} member
                    {team.memberCount === 1 ? '' : 's'}
                    {team.description ? ` · ${team.description}` : ''}
                  </span>
                </div>
                <Badge
                  variant={team.role === 'LEADER' ? 'primary-light' : 'outline'}
                  size="sm"
                >
                  {team.role === 'LEADER' ? 'Captain' : 'Member'}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
