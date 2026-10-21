import type { LiveEvent } from '@koarena/realtime'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Loader2, PlayIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CodeEditor } from '../../../../../features/editor/CodeEditor'
import { useLiveEvents } from '../../../../../features/live/useLiveEvents'
import {
  createSubmissionFn,
  getProblemFn,
  listSubmissionsFn,
} from '../../../../../features/problems/problems.functions'
import { getTournamentBySlug } from '../../../../../features/tournaments/tournaments.functions'

export const Route = createFileRoute('/tournaments/$slug/problems/$problemId/')(
  {
    loader: async ({ params }) => {
      const tournament = await getTournamentBySlug({
        data: { slug: params.slug },
      })
      if (!tournament)
        return { tournament: null, problem: null, submissions: [] }

      const problem = await getProblemFn({
        data: { tournamentId: tournament.id, problemId: params.problemId },
      })

      const submissions = problem
        ? await listSubmissionsFn({
            data: { tournamentId: tournament.id, problemId: problem.id },
          })
        : []

      return { tournament, problem, submissions }
    },
    component: ProblemPage,
  },
)

const STARTER: Record<string, string> = {
  python:
    'import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    print(" ".join(data))\n\nsolve()\n',
  javascript:
    "const fs = require('fs')\nconst data = fs.readFileSync(0, 'utf8').split(/\\s+/)\nconsole.log(data.join(' '))\n",
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << "\\n";\n  return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main(void) {\n  int a, b;\n  scanf("%d %d", &a, &b);\n  printf("%d\\n", a + b);\n  return 0;\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  var a, b int\n  fmt.Scan(&a, &b)\n  fmt.Println(a + b)\n}\n',
  rust: 'use std::io::Read;\n\nfn main() {\n    let mut s = String::new();\n    std::io::stdin().read_to_string(&mut s).unwrap();\n    let v: i64 = s.trim().parse().unwrap();\n    println!("{}", v);\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    System.out.println(sc.nextInt() + sc.nextInt());\n  }\n}\n',
}

const VERDICT_VARIANT: Record<
  string,
  | 'success-light'
  | 'destructive-light'
  | 'warning-light'
  | 'info-light'
  | 'outline'
> = {
  ACCEPTED: 'success-light',
  WRONG_ANSWER: 'destructive-light',
  TIME_LIMIT_EXCEEDED: 'warning-light',
  COMPILE_ERROR: 'destructive-light',
  RUNTIME_ERROR: 'destructive-light',
  MEMORY_LIMIT_EXCEEDED: 'warning-light',
  ERROR: 'destructive-light',
  QUEUED: 'info-light',
  RUNNING: 'info-light',
  JUDGING: 'info-light',
  COMPILING: 'info-light',
}

function ProblemPage() {
  const { tournament, problem, submissions } = Route.useLoaderData()
  const router = useRouter()

  const [languageId, setLanguageId] = useState<string>('')
  const [sourceCode, setSourceCode] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [latest, setLatest] = useState(submissions[0] ?? null)

  // The language list comes from the problem, so the picker waits for it.
  useEffect(() => {
    if (!problem) return
    const first = problem.languages[0]
    if (first) {
      setLanguageId((current) => current || first.id)
    }
  }, [problem])

  // The starter code follows the chosen language until the player edits it.
  useEffect(() => {
    if (!problem || sourceCode.length > 0) return
    const chosen = problem.languages.find((entry) => entry.id === languageId)
    if (chosen) setSourceCode(STARTER[chosen.editorMode] ?? '')
  }, [problem, languageId, sourceCode.length])

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type !== 'judge:progress') return
      if (!latest || event.payload.submissionId !== latest.id) return
      // The verdict changed on the server; pull the fresh row.
      void router.invalidate()
    },
    [latest, router],
  )

  useLiveEvents(tournament?.slug, onEvent)

  useEffect(() => {
    if (submissions[0]) setLatest(submissions[0])
  }, [submissions])

  if (!tournament || !problem) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          That problem does not exist.
        </p>
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    try {
      const result = await createSubmissionFn({
        data: {
          tournamentId: tournament.id,
          problemId: problem.id,
          languageId,
          sourceCode,
        },
      })
      toast.success('Submitted. The judge is looking at it.')
      await router.invalidate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not submit.',
      )
    } finally {
      setBusy(false)
    }
  }

  const judged = latest && latest.judgedAt !== null
  const pending = latest && !judged

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {problem.title}
          </h1>
          <Badge variant="outline" size="sm">
            {problem.difficulty}
          </Badge>
          <Badge variant="primary-light" size="sm">
            {problem.points} point{problem.points === 1 ? '' : 's'}
          </Badge>
          {problem.solved ? (
            <Badge variant="success-light" size="sm">
              Solved
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {problem.timeLimitMs} ms · {Math.round(problem.memoryLimitKb / 1024)}{' '}
          MB · {problem.hiddenTestCaseCount} hidden test case
          {problem.hiddenTestCaseCount === 1 ? '' : 's'} ·{' '}
          <Link
            to="/tournaments/$slug/problems"
            params={{ slug: tournament.slug }}
            className="hover:text-foreground hover:underline"
          >
            all problems
          </Link>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Statement</CardTitle>
            <CardDescription>What the program has to do.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {problem.statement}
            </p>

            {problem.testCases.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">
                  Sample input and output
                </span>
                {problem.testCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        Input
                      </span>
                      <Textarea
                        readOnly
                        rows={2}
                        value={testCase.input}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        Output
                      </span>
                      <Textarea
                        readOnly
                        rows={2}
                        value={testCase.expectedOutput}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Your solution</CardTitle>
                  <CardDescription>
                    Judge against the hidden test cases.
                  </CardDescription>
                </div>
                <Select
                  items={problem.languages.map((language) => ({
                    value: language.id,
                    label: language.name,
                  }))}
                  value={languageId}
                  onValueChange={(value) => setLanguageId(value ?? '')}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {problem.languages.map((language) => (
                      <SelectItem key={language.id} value={language.id}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CodeEditor
                value={sourceCode}
                onChange={setSourceCode}
                language={
                  problem.languages.find((entry) => entry.id === languageId)
                    ?.editorMode ?? 'plaintext'
                }
              />
              <Button
                onClick={submit}
                disabled={busy || !languageId || sourceCode.trim().length === 0}
                className="self-start"
              >
                {busy ? <Loader2 className="animate-spin" /> : <PlayIcon />}
                Submit
              </Button>
            </CardContent>
          </Card>

          {latest ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Last submission</CardTitle>
                  <Badge
                    variant={
                      VERDICT_VARIANT[latest.verdict ?? latest.status] ??
                      'outline'
                    }
                    size="sm"
                  >
                    {latest.verdict ?? latest.status}
                  </Badge>
                </div>
                <CardDescription>
                  {latest.languageName} ·{' '}
                  {new Date(latest.submittedAt).toLocaleTimeString()}
                  {latest.timeMs !== null ? ` · ${latest.timeMs} ms` : ''}
                  {latest.memoryKb !== null
                    ? ` · ${Math.round(latest.memoryKb / 1024)} MB`
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {pending ? (
                  <Alert>
                    <Loader2 className="animate-spin" />
                    <AlertTitle>Judging</AlertTitle>
                    <AlertDescription>
                      The worker is running your program. The result appears
                      here the moment it lands.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {latest.stdout ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Output
                    </span>
                    <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                      {latest.stdout}
                    </pre>
                  </div>
                ) : null}

                {latest.stderr ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Errors
                    </span>
                    <pre className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2 font-mono text-xs text-destructive">
                      {latest.stderr}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {submissions.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Earlier submissions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {submissions.slice(1, 8).map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(submission.submittedAt).toLocaleTimeString()} ·{' '}
                      {submission.languageName}
                    </span>
                    <Badge
                      variant={
                        VERDICT_VARIANT[
                          submission.verdict ?? submission.status
                        ] ?? 'outline'
                      }
                      size="sm"
                    >
                      {submission.verdict ?? submission.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
