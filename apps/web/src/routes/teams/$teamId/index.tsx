import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { requireUser } from '../../../features/auth/auth.functions'
import {
  getTeam,
  inviteToTeam,
  removeMember,
  revokeInvite,
} from '../../../features/teams/teams.functions'

export const Route = createFileRoute('/teams/$teamId/')({
  beforeLoad: async () => {
    await requireUser()
  },
  loader: async ({ params }) => {
    const team = await getTeam({ data: { teamId: params.teamId } })
    return { team }
  },
  component: TeamPage,
})

function TeamPage() {
  const { team } = Route.useLoaderData()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  if (!team) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That team does not exist, or you are not on it.
        </p>
      </div>
    )
  }

  const isOwner = team.isOwner

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await inviteToTeam({
        data: { teamId: team.id, email },
      })
      const link = `${window.location.origin}/teams/join/${result.token}`
      await navigator.clipboard?.writeText(link)
      toast.success('Invite created. The link is on your clipboard.')
      setEmail('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not invite.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string) => {
    try {
      await removeMember({ data: { teamId: team.id, userId } })
      toast.success('Member removed.')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not remove.',
      )
    }
  }

  const revoke = async (inviteId: string) => {
    try {
      await revokeInvite({ data: { inviteId } })
      toast.success('Invite revoked.')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not revoke.',
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.memberCount} member{team.memberCount === 1 ? '' : 's'} ·{' '}
            <Link to="/teams" className="hover:text-foreground hover:underline">
              all teams
            </Link>
          </p>
        </div>
        <Badge variant={isOwner ? 'primary-light' : 'outline'} size="sm">
          {isOwner ? 'Captain' : 'Member'}
        </Badge>
      </div>

      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Roster</FrameTitle>
          <FrameDescription>Who plays for this team.</FrameDescription>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-2">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {member.user.firstName ?? member.user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {member.user.email} · joined{' '}
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      member.role === 'LEADER' ? 'primary-light' : 'outline'
                    }
                    size="sm"
                  >
                    {member.role === 'LEADER' ? 'Captain' : 'Member'}
                  </Badge>
                  {isOwner && member.role !== 'LEADER' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(member.user.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>

      {isOwner ? (
        <Frame spacing="default" variant="default">
          <FrameHeader>
            <FrameTitle>Invite</FrameTitle>
            <FrameDescription>
              The invite link only works for the address you enter.
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-4">
              <form className="flex items-end gap-2" onSubmit={invite}>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    placeholder="teammate@example.com"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy || !email.includes('@')}>
                  Send invite
                </Button>
              </form>

              {team.pendingInvites.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">
                    Pending invites
                  </span>
                  {team.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-sm">{invite.receiverEmail}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke(invite.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </FramePanel>
        </Frame>
      ) : null}
    </div>
  )
}
