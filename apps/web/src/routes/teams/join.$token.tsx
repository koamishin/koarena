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

import { requireUser } from '../../features/auth/auth.functions'
import { acceptInvite, getInvite } from '../../features/teams/teams.functions'

export const Route = createFileRoute('/teams/join/$token')({
  beforeLoad: async () => {
    await requireUser()
  },
  loader: async ({ params }) => {
    const invite = await getInvite({ data: { token: params.token } })
    return { invite }
  },
  component: JoinTeamPage,
})

function JoinTeamPage() {
  const { invite } = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!invite) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>That invite does not exist</CardTitle>
            <CardDescription>
              It may have been revoked, or the link may be wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to="/teams" />}
            >
              Go to your teams
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expired = new Date(invite.expiresAt) < new Date()

  const join = async () => {
    setBusy(true)
    try {
      const result = await acceptInvite({ data: { token: invite.token } })
      toast.success(`You joined ${invite.teamName}.`)
      await router.navigate({
        to: '/teams/$teamId',
        params: { teamId: result.teamId },
      })
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not join the team.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Join {invite.teamName}</CardTitle>
            {invite.accepted ? (
              <Badge variant="success-light" size="sm">
                Already used
              </Badge>
            ) : expired ? (
              <Badge variant="destructive-light" size="sm">
                Expired
              </Badge>
            ) : (
              <Badge variant="primary-light" size="sm">
                Pending
              </Badge>
            )}
          </div>
          <CardDescription>
            {invite.senderEmail} invited you to this team. The invite expires{' '}
            {new Date(invite.expiresAt).toLocaleDateString()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={join} disabled={busy || invite.accepted || expired}>
            Accept invite
          </Button>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link to="/teams" />}
          >
            Not now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
