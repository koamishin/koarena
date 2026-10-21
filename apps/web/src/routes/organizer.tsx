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

export const Route = createFileRoute('/organizer')({
  component: OrganizerPage,
})

const steps = [
  {
    title: 'Pick a game mode',
    body: 'CTF, Attack & Defense, Hackathon, ACM, Polyglot Battle, Golf Royale, Bug Hunt or Knockout.',
  },
  {
    title: 'Choose the languages',
    body: 'The allowed set drives the editor, the runner and the scoring handicap.',
  },
  {
    title: 'Set the scoring rules',
    body: 'Point decay, penalties, rubric weights — all part of the mode config.',
  },
  {
    title: 'Open registration',
    body: 'Team sizes, join codes and verified-email requirements.',
  },
] as const

function OrganizerPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Run a tournament
        </h1>
        <p className="text-sm text-muted-foreground">
          The wizard asks for what your mode needs and nothing else.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm">
                  Step {index + 1}
                </Badge>
                <CardTitle>{step.title}</CardTitle>
              </div>
              <CardDescription>{step.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button disabled>Start a tournament</Button>
        <p className="text-xs text-muted-foreground">
          The setup wizard arrives with Phase 1.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Looking to play instead?</CardTitle>
          <CardDescription>
            Browse the tournaments that are already open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/tournaments" />}
          >
            Browse tournaments
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
