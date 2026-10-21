import { getPrisma, SubmissionStatus } from '@koarena/db'
import { deriveEvents, toGameModeId } from '@koarena/game'
import { recordScoreEvent, rerankStandings } from '@koarena/ledger'
import type { JudgeJob } from '@koarena/queue'
import { publishLiveEvent } from '@koarena/realtime'
import {
  createRunner,
  type Runner,
  type RunRequest,
  type RunResult,
  type Verdict,
} from '@koarena/runner'

/**
 * Judge one submission.
 *
 * The submission is the only thing the job carries; everything else is read
 * from the database, so a job can be replayed by hand and the database stays
 * the source of truth.
 */

/** Our verdicts mapped onto the statuses the app stores. */
const STATUS_BY_VERDICT: Record<Verdict, SubmissionStatus> = {
  QUEUED: SubmissionStatus.QUEUED,
  PROCESSING: SubmissionStatus.RUNNING,
  ACCEPTED: SubmissionStatus.ACCEPTED,
  WRONG_ANSWER: SubmissionStatus.WRONG_ANSWER,
  TIME_LIMIT_EXCEEDED: SubmissionStatus.TIME_LIMIT_EXCEEDED,
  COMPILE_ERROR: SubmissionStatus.COMPILE_ERROR,
  RUNTIME_ERROR: SubmissionStatus.RUNTIME_ERROR,
  MEMORY_LIMIT_EXCEEDED: SubmissionStatus.MEMORY_LIMIT_EXCEEDED,
  INTERNAL_ERROR: SubmissionStatus.ERROR,
}

export async function judgeSubmission({
  submissionId,
}: JudgeJob): Promise<void> {
  const prisma = getPrisma()
  const runner = createRunner()

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        include: { testCases: { orderBy: { order: 'asc' } } },
      },
      language: true,
      user: { select: { id: true } },
    },
  })

  if (!submission) {
    throw new Error(`Submission ${submissionId} does not exist.`)
  }

  if (submission.status === SubmissionStatus.ACCEPTED) {
    // Already judged — a replayed job must not score again.
    return
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: SubmissionStatus.RUNNING },
  })

  await publishLiveEvent(submission.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'judge:progress',
    payload: { submissionId: submission.id, status: 'RUNNING' },
  })

  const problem = submission.problem
  const timeLimitSec = (problem?.timeLimitMs ?? 2_000) / 1_000
  const memoryLimitKb = problem?.memoryLimitKb ?? 262_144

  let verdict: Verdict = 'ACCEPTED'
  let stdout = ''
  let stderr = ''
  let compileOutput = ''
  let message = ''
  let timeMs: number | null = null
  let memoryKb: number | null = null
  let exitCode: number | null = null
  let failedTestCaseId: string | null = null

  const testCases = problem?.testCases ?? []

  if (testCases.length === 0) {
    // Nothing to check against: the program still has to run without error.
    const result = await runOnce(runner, {
      sourceCode: submission.sourceCode,
      languageId: submission.language.judge0Id,
      stdin: '',
      cpuTimeLimitSec: timeLimitSec,
      memoryLimitKb,
    })
    verdict = result.verdict === 'ACCEPTED' ? 'ACCEPTED' : result.verdict
    stdout = result.stdout
    stderr = result.stderr
    compileOutput = result.compileOutput
    message = result.message
    timeMs = result.timeMs
    memoryKb = result.memoryKb
    exitCode = result.exitCode
  } else {
    for (const testCase of testCases) {
      const result = await runOnce(runner, {
        sourceCode: submission.sourceCode,
        languageId: submission.language.judge0Id,
        stdin: testCase.input,
        cpuTimeLimitSec: timeLimitSec,
        memoryLimitKb,
      })

      if (result.verdict !== 'ACCEPTED') {
        verdict = result.verdict
        stdout = result.stdout
        stderr = result.stderr
        compileOutput = result.compileOutput
        message = result.message
        timeMs = result.timeMs
        memoryKb = result.memoryKb
        exitCode = result.exitCode
        failedTestCaseId = testCase.id
        break
      }
    }
  }

  const status = STATUS_BY_VERDICT[verdict]

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        status,
        verdict,
        stdout: stdout.slice(0, 16_384),
        // A compile error is the most useful thing to show, so it wins the
        // stderr slot; the runner's own message is the fallback.
        stderr: (compileOutput || stderr || message).slice(0, 16_384),
        exitCode,
        timeMs,
        memoryKb,
        judgedAt: new Date(),
      },
    }),
    ...(failedTestCaseId
      ? [
          prisma.submissionTestResult.create({
            data: {
              submissionId: submission.id,
              testCaseId: failedTestCaseId,
              status,
              timeMs,
              memoryKb,
              output: stdout.slice(0, 4_096),
            },
          }),
        ]
      : []),
  ])

  if (verdict === 'ACCEPTED' && problem) {
    await awardAcceptedProblem(submission, problem.id)
  }

  await publishLiveEvent(submission.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'judge:progress',
    payload: { submissionId: submission.id, status },
  })
}

async function runOnce(
  runner: Runner,
  request: RunRequest,
): Promise<RunResult> {
  const { token } = await runner.submit(request)

  // Judge0 queues the program; poll until it finishes.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await runner.status(token)

    if (status.verdict !== 'QUEUED' && status.verdict !== 'PROCESSING') {
      const { token: _token, ...result } = status
      return result
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  return {
    verdict: 'INTERNAL_ERROR',
    stdout: '',
    stderr: '',
    compileOutput: '',
    message: 'The runner did not finish in time.',
    timeMs: null,
    memoryKb: null,
    exitCode: null,
  }
}

/**
 * Award an accepted problem.
 *
 * The award comes from the scoring engine, so the ACM rules — points, the
 * penalty for the wrong attempts before the first acceptance — live in one
 * place and the worker does not re-implement them.
 */
async function awardAcceptedProblem(
  submission: {
    id: string
    tournamentId: string
    teamId: string | null
    userId: string
    problemId: string | null
  },
  problemId: string,
): Promise<void> {
  const prisma = getPrisma()

  const tournament = await prisma.tournament.findUnique({
    where: { id: submission.tournamentId },
    select: { id: true, gameMode: true, config: true },
  })

  if (!tournament) return

  // The wrong attempts that count are the ones made before this acceptance.
  // Only the player's own failures count: a submission the judge could not
  // run is not the player's mistake and must not cost them penalty time.
  const wrongSubmissions = await prisma.submission.count({
    where: {
      tournamentId: submission.tournamentId,
      problemId,
      ...(submission.teamId
        ? { teamId: submission.teamId }
        : { userId: submission.userId }),
      status: {
        in: [
          SubmissionStatus.WRONG_ANSWER,
          SubmissionStatus.TIME_LIMIT_EXCEEDED,
          SubmissionStatus.COMPILE_ERROR,
          SubmissionStatus.RUNTIME_ERROR,
        ],
      },
    },
  })

  const events = deriveEvents(
    toGameModeId(tournament.gameMode),
    tournament.config,
    [
      {
        kind: 'problem:accepted',
        teamId: submission.teamId ?? submission.userId,
        at: Date.now(),
        payload: { problemId, wrongSubmissions },
      },
    ],
  )

  for (const event of events) {
    const recorded = await recordScoreEvent({
      tournamentId: submission.tournamentId,
      teamId: submission.teamId,
      userId: submission.userId,
      type: event.type,
      points: event.points,
      weight: event.weight,
      delta: event.delta,
      refType: event.refType,
      refId: event.refId,
      metadata: event.metadata,
      // The key is per event type: one acceptance produces both a solve event
      // and a penalty event, and they are different rows.
      idempotencyKey: `accept:${submission.tournamentId}:${problemId}:${submission.teamId ?? submission.userId}:${event.type}`,
    })

    // The solve counter counts participants, not submissions: it only moves
    // when the solve is new.
    if (recorded && event.type === 'PROBLEM_SOLVED') {
      await prisma.problem.update({
        where: { id: problemId },
        data: { solveCount: { increment: 1 } },
      })
    }
  }

  const standings = await rerankStandings(
    submission.tournamentId,
    tournament.gameMode,
  )

  const standing = standings.find((row) =>
    submission.teamId
      ? row.teamId === submission.teamId
      : row.userId === submission.userId,
  )

  await publishLiveEvent(submission.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'score:update',
    payload: {
      teamId: submission.teamId,
      teamName: standing?.teamName ?? standing?.userName ?? null,
      score: standing?.score ?? 0,
      rank: standing?.rank ?? 0,
      delta: events.reduce((sum, event) => sum + event.delta, 0),
      reason: 'solved a problem',
    },
  })

  await publishLiveEvent(submission.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'scoreboard:full',
    payload: { standings },
  })
}
