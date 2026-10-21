import { useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireUser } from '@/lib/auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    await requireUser()
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useUser()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your tournaments, teams and submissions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
            <CardDescription>
              {user?.primaryEmailAddress?.emailAddress ?? 'unknown'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="primary-light" size="sm">
              {user?.id ?? 'no user id'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My tournaments</CardTitle>
            <CardDescription>Nothing registered yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/tournaments" />}
            >
              Browse tournaments
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My teams</CardTitle>
            <CardDescription>
              Teams are created in the next phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/dashboard" />}
            >
              Create a team
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
