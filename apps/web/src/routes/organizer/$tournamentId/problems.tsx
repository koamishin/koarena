import { createFileRoute, useRouter } from '@tanstack/react-router'
import { PlusIcon, TrashIcon } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

import {
  addTestCaseFn,
  createProblemFn,
  deleteTestCaseFn,
  listOrganizerProblemsFn,
} from '../../../features/problems/problems.functions'
import { getOrganizerTournament } from '../../../features/tournaments/tournaments.functions'
import { slugify } from '../../../lib/slug'

export const Route = createFileRoute('/organizer/$tournamentId/problems')({
  loader: async ({ params }) => {
    const tournament = await getOrganizerTournament({
      data: { tournamentId: params.tournamentId },
    })
    if (!tournament) return { tournament: null, problems: [] }

    const problems = await listOrganizerProblemsFn({
      data: { tournamentId: tournament.id },
    })

    return { tournament, problems }
  },
  component: OrganizerProblemsPage,
})

function OrganizerProblemsPage() {
  const { tournament, problems } = Route.useLoaderData()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [statement, setStatement] = useState('')
  const [busy, setBusy] = useState(false)
  const [testCaseFor, setTestCaseFor] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState('')

  if (!tournament) {
    return (
      <p className="text-sm text-muted-foreground">
        That tournament does not exist.
      </p>
    )
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await createProblemFn({
        data: {
          tournamentId: tournament.id,
          title,
          slug: slugify(title),
          statement,
          difficulty: 'medium',
          points: 1,
          timeLimitMs: 2000,
          memoryLimitKb: 262_144,
          languageIds: [],
        },
      })
      toast.success('Problem created.')
      setTitle('')
      setStatement('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not create it.',
      )
    } finally {
      setBusy(false)
    }
  }

  const addTestCase = async (problemId: string) => {
    try {
      await addTestCaseFn({
        data: {
          problemId,
          input: testInput,
          expectedOutput: testOutput,
          isSample: false,
          points: 1,
        },
      })
      toast.success('Test case added.')
      setTestCaseFor(null)
      setTestInput('')
      setTestOutput('')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not add it.',
      )
    }
  }

  const removeTestCase = async (testCaseId: string) => {
    try {
      await deleteTestCaseFn({ data: { testCaseId } })
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not remove it.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="text-sm text-muted-foreground">
          {tournament.name} · {problems.length} problem
          {problems.length === 1 ? '' : 's'} · each one is judged against its
          test cases
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New problem</CardTitle>
          <CardDescription>
            A problem starts with no test cases; add them before it goes live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={create}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="problem-title">Title</Label>
              <Input
                id="problem-title"
                value={title}
                placeholder="Sum of two numbers"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="problem-statement">Statement</Label>
              <Textarea
                id="problem-statement"
                rows={4}
                value={statement}
                placeholder="Read two integers and print their sum."
                onChange={(event) => setStatement(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || title.trim().length < 3}
              className="self-start"
            >
              <PlusIcon />
              Create problem
            </Button>
          </form>
        </CardContent>
      </Card>

      {problems.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-border px-4 py-8">
          <p className="text-sm font-medium">No problems yet</p>
          <p className="text-sm text-muted-foreground">
            Create one above to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {problems.map((problem) => (
            <Card key={problem.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{problem.title}</CardTitle>
                    <CardDescription>
                      {problem.testCases.length} test case
                      {problem.testCases.length === 1 ? '' : 's'} ·{' '}
                      {problem.solveCount} solve
                      {problem.solveCount === 1 ? '' : 's'} · /{problem.slug}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" size="sm">
                    {problem.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {problem.testCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        Input
                      </span>
                      <pre className="max-h-20 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
                        {testCase.input || '(empty)'}
                      </pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        Expected output
                      </span>
                      <pre className="max-h-20 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
                        {testCase.expectedOutput || '(empty)'}
                      </pre>
                    </div>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTestCase(testCase.id)}
                      >
                        <TrashIcon />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                {testCaseFor === problem.id ? (
                  <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`input-${problem.id}`}>Input</Label>
                      <Textarea
                        id={`input-${problem.id}`}
                        rows={2}
                        value={testInput}
                        className="font-mono text-xs"
                        onChange={(event) => setTestInput(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`output-${problem.id}`}>
                        Expected output
                      </Label>
                      <Textarea
                        id={`output-${problem.id}`}
                        rows={2}
                        value={testOutput}
                        className="font-mono text-xs"
                        onChange={(event) => setTestOutput(event.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="sm" onClick={() => addTestCase(problem.id)}>
                        Save test case
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTestCaseFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTestCaseFor(problem.id)}
                    >
                      <PlusIcon />
                      Add a test case
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
