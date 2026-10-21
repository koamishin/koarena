import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  Braces,
  Flag,
  Swords,
  Terminal,
  Trophy,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/')({ component: LandingPage })

const modes = [
  {
    icon: Flag,
    name: 'CTF',
    blurb:
      'Challenges across categories, flags, and points that decay per solve.',
    runner: false,
    service: false,
  },
  {
    icon: Swords,
    name: 'Attack & Defense',
    blurb:
      'Run a vulnerable service, attack your rivals, patch your own to survive.',
    runner: false,
    service: true,
  },
  {
    icon: Trophy,
    name: 'Hackathon',
    blurb: 'Ship a project, judges score it against a weighted rubric.',
    runner: false,
    service: false,
  },
  {
    icon: Terminal,
    name: 'ACM',
    blurb: 'Algorithmic problems against hidden test cases, with penalty time.',
    runner: true,
    service: false,
  },
  {
    icon: Braces,
    name: 'Polyglot Battle',
    blurb: 'One problem, pick your language, win on the difficulty handicap.',
    runner: true,
    service: false,
  },
  {
    icon: Activity,
    name: 'Bug Hunt',
    blurb: 'Fix the seeded bug, fastest passing hidden tests wins.',
    runner: true,
    service: false,
  },
] as const

const pillars = [
  {
    title: 'One scoring ledger',
    body: 'Every point comes from an append-only event. Any leaderboard can be rebuilt from the log.',
  },
  {
    title: 'Languages are first class',
    body: 'Pick the languages a tournament allows; the editor, the runner and the scoring adapt to them.',
  },
  {
    title: 'Live by default',
    body: 'The scoreboard streams over server-sent events, so a solve shows up the moment it lands.',
  },
] as const

function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12">
      <section className="flex flex-col items-start gap-5">
        <Badge variant="primary-light">Eight game modes · one platform</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Tournaments for programmers, run end to end.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          KoArena runs CTFs, hackathons, attack &amp; defense, algorithmic
          rounds and language-driven game modes. Organizers pick a mode and a
          set of languages; the platform adapts the player experience, the
          scoring and the judging pipeline.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button nativeButton={false} render={<Link to="/tournaments" />}>
            Browse tournaments
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/sign-up/$" params={{ _splat: '' }} />}
          >
            Create an account
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Game modes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((mode) => {
            const Icon = mode.icon
            return (
              <Card key={mode.name}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <CardTitle>{mode.name}</CardTitle>
                  </div>
                  <CardDescription>{mode.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {mode.runner ? 'code runner' : 'no runner'}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {mode.service ? 'service host' : 'no service'}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          How it holds together
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {pillars.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription>{pillar.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-6 rounded-lg border border-border bg-muted/50 px-6 py-8">
        <Users className="size-8 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Organising something?</p>
          <p className="text-sm text-muted-foreground">
            The setup wizard asks for what your mode needs and nothing else.
          </p>
        </div>
        <Button
          variant="outline"
          className="ml-auto shrink-0"
          nativeButton={false}
          render={<Link to="/organizer" />}
        >
          Open the organizer view
        </Button>
      </section>
    </div>
  )
}
