import { Link } from '@tanstack/react-router'
import {
  CircleDotIcon,
  HashIcon,
  SearchIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/reui/badge'
import { Filters } from '@/components/reui/filters/filters'
import {
  createFilterQuery,
  flattenFilterRules,
} from '@/components/reui/filters/filters-query'
import type {
  FilterField,
  FilterQuery,
  FilterRule,
} from '@/components/reui/filters/filters-types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import type { ChallengeBoard as Board, ChallengeDto } from '../types'

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'insane', label: 'Insane' },
]

const DIFFICULTY_VARIANT = {
  easy: 'success-light',
  medium: 'info-light',
  hard: 'warning-light',
  insane: 'destructive-light',
} as const

export interface ChallengeBoardProps {
  tournamentSlug: string
  tournamentName: string
  board: Board
}

export function ChallengeBoard({
  tournamentSlug,
  tournamentName,
  board,
}: ChallengeBoardProps) {
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery([]))

  const fields = useMemo<FilterField[]>(
    () => [
      {
        id: 'title',
        label: 'Title',
        type: 'text',
        icon: <SearchIcon />,
      },
      {
        id: 'category',
        label: 'Category',
        type: 'select',
        defaultOperator: 'is_any_of',
        icon: <CircleDotIcon />,
        options: board.categories.map((category) => ({
          value: category.slug,
          label: category.name,
        })),
      },
      {
        id: 'difficulty',
        label: 'Difficulty',
        type: 'select',
        defaultOperator: 'is_any_of',
        icon: <TriangleAlertIcon />,
        options: DIFFICULTIES,
      },
      {
        id: 'status',
        label: 'Status',
        type: 'select',
        defaultOperator: 'is',
        icon: <CircleDotIcon />,
        options: [
          { value: 'solved', label: 'Solved' },
          { value: 'unsolved', label: 'Unsolved' },
        ],
      },
      {
        id: 'points',
        label: 'Points',
        type: 'number',
        icon: <HashIcon />,
      },
    ],
    [board.categories],
  )

  const rules = useMemo(() => flattenFilterRules(query), [query])
  const visible = useMemo(
    () => board.challenges.filter((challenge) => matches(challenge, rules)),
    [board.challenges, rules],
  )

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-sm text-muted-foreground">
          {tournamentName} · {board.challenges.length} published ·{' '}
          {board.challenges.filter((challenge) => challenge.solved).length}{' '}
          solved
        </p>
      </div>

      <Filters
        fields={fields}
        query={query}
        onQueryChange={setQuery}
        showClear
      />

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-border px-4 py-10">
          <p className="text-sm font-medium">No challenges match</p>
          <p className="text-sm text-muted-foreground">
            {board.challenges.length === 0
              ? 'The organizer has not published any challenges yet.'
              : 'Clear the filters to see everything.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              tournamentSlug={tournamentSlug}
              challenge={challenge}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChallengeCard({
  tournamentSlug,
  challenge,
}: {
  tournamentSlug: string
  challenge: ChallengeDto
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {challenge.categoryName ? (
              <Badge variant="outline" size="sm">
                {challenge.categoryName}
              </Badge>
            ) : null}
            <Badge
              variant={
                DIFFICULTY_VARIANT[
                  challenge.difficulty as keyof typeof DIFFICULTY_VARIANT
                ] ?? 'outline'
              }
              size="sm"
            >
              {challenge.difficulty}
            </Badge>
          </div>
          {challenge.solved ? (
            <Badge variant="success-light" size="sm">
              Solved
            </Badge>
          ) : null}
        </div>
        <CardTitle>
          <Link
            to="/tournaments/$slug/challenges/$challengeId"
            params={{ slug: tournamentSlug, challengeId: challenge.id }}
            className="transition-colors hover:text-primary hover:underline"
          >
            {challenge.title}
          </Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {challenge.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {challenge.currentPoints} points
          {challenge.decayPerSolve > 0 && challenge.solveCount > 0
            ? ` (−${challenge.decayPerSolve * challenge.solveCount})`
            : ''}
        </span>
        <span className="tabular-nums">
          {challenge.solveCount} solve{challenge.solveCount === 1 ? '' : 's'}
        </span>
      </CardContent>
    </Card>
  )
}

/** Apply the filter rules to one challenge, client-side. */
function matches(challenge: ChallengeDto, rules: FilterRule[]): boolean {
  for (const rule of rules) {
    if (rule.value === undefined || rule.value === null) continue

    const [field] = rule.path
    let ok = true

    switch (field) {
      case 'title': {
        const needle = String(rule.value).toLowerCase()
        ok = challenge.title.toLowerCase().includes(needle)
        break
      }
      case 'category': {
        const wanted = asArray(rule.value)
        ok = wanted.includes(challenge.categorySlug ?? '')
        break
      }
      case 'difficulty': {
        const wanted = asArray(rule.value)
        ok = wanted.includes(challenge.difficulty)
        break
      }
      case 'status': {
        const wanted = asArray(rule.value)
        ok = wanted.includes(challenge.solved ? 'solved' : 'unsolved')
        break
      }
      case 'points': {
        ok = challenge.currentPoints >= Number(rule.value)
        break
      }
      default:
        ok = true
    }

    if (!ok) return false
  }

  return true
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry))
  if (value === undefined || value === null || value === '') return []
  return [String(value)]
}
