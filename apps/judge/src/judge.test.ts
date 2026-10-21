// @vitest-environment node

import { getPrisma, SubmissionStatus } from '@koarena/db'
import {
  cleanup,
  createTestTournament,
  createTestUser,
} from '@koarena/ledger/test-support'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { judgeSubmission } from './judge'
import { reapStaleSubmissions } from './reaper'

/**
 * The judging path, end to end against the real database.
 *
 * The runner is the simulated one: it decides the verdict from a marker in the
 * source, which is enough to exercise the whole path — the queue hand-off, the
 * verdict write, the score event and the standings.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL)
const suite = hasDatabase ? describe : describe.skip

suite('judging a submission', () => {
  const createdUsers: string[] = []
  let tournamentId = ''
  let problemId = ''
  let languageId = ''

  beforeAll(async () => {
    if (!hasDatabase) return

    const organizer = await createTestUser('ORGANIZER')
    createdUsers.push(organizer.id)

    const tournament = await createTestTournament(organizer.id, {
      gameMode: 'ACM',
      config: {
        problemPoints: 1,
        penaltyMinutes: 20,
        wrongSubmissionCap: 3,
      },
    })
    tournamentId = tournament.id

    const language = await getPrisma().language.findFirstOrThrow({
      where: { slug: 'python' },
      select: { id: true },
    })
    languageId = language.id

    const problem = await getPrisma().problem.create({
      data: {
        tournamentId,
        authorId: organizer.id,
        slug: `judge-${Date.now().toString(36)}`,
        title: 'Sum of two integers',
        statement: 'Print the sum.',
        points: 1,
        timeLimitMs: 2000,
        memoryLimitKb: 262_144,
        testCases: {
          create: [
            { order: 1, input: '3 4\n', expectedOutput: '7\n', points: 1 },
            { order: 2, input: '10 -2\n', expectedOutput: '8\n', points: 1 },
          ],
        },
      },
      select: { id: true },
    })
    problemId = problem.id
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers)
  })

  async function submit(sourceCode: string, userId: string) {
    const prisma = getPrisma()
    return prisma.submission.create({
      data: {
        tournamentId,
        problemId,
        userId,
        languageId,
        sourceCode,
        status: SubmissionStatus.QUEUED,
      },
      select: { id: true },
    })
  }

  it('accepts a correct program and scores it', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const submission = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: submission.id })

    const prisma = getPrisma()
    const judged = await prisma.submission.findUniqueOrThrow({
      where: { id: submission.id },
    })

    expect(judged.status).toBe(SubmissionStatus.ACCEPTED)
    expect(judged.verdict).toBe('ACCEPTED')
    expect(judged.judgedAt).not.toBeNull()

    const events = await prisma.scoreEvent.findMany({
      where: { tournamentId, userId: player.id },
    })
    expect(events.length).toBeGreaterThan(0)

    const total = events.reduce((sum, event) => sum + event.delta, 0)
    expect(total).toBe(1)
  })

  it('records a wrong answer without scoring it', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const submission = await submit('/* verdict:wrong-answer */', player.id)
    await judgeSubmission({ submissionId: submission.id })

    const prisma = getPrisma()
    const judged = await prisma.submission.findUniqueOrThrow({
      where: { id: submission.id },
    })

    expect(judged.status).toBe(SubmissionStatus.WRONG_ANSWER)

    const events = await prisma.scoreEvent.findMany({
      where: { tournamentId, userId: player.id },
    })
    expect(events).toHaveLength(0)
  })

  it('does not score the same submission twice', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const submission = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: submission.id })
    await judgeSubmission({ submissionId: submission.id })

    const prisma = getPrisma()
    const events = await prisma.scoreEvent.findMany({
      where: { tournamentId, userId: player.id },
    })
    expect(events).toHaveLength(1)
  })

  it('counts the wrong attempts before the first acceptance', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const wrong = await submit('/* verdict:wrong-answer */', player.id)
    await judgeSubmission({ submissionId: wrong.id })

    const right = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: right.id })

    const prisma = getPrisma()
    const penalty = await prisma.scoreEvent.findFirst({
      where: { tournamentId, userId: player.id, type: 'SUBMISSION_PENALTY' },
    })

    // One wrong attempt, twenty minutes of penalty.
    expect(penalty?.metadata).toMatchObject({ penaltyMinutes: 20 })
  })

  it('does not count a judge failure as a wrong attempt', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const prisma = getPrisma()

    // A submission the judge could not run: the player's fault is nothing.
    await prisma.submission.create({
      data: {
        tournamentId,
        problemId,
        userId: player.id,
        languageId,
        sourceCode: 'print(sum)',
        status: SubmissionStatus.ERROR,
        verdict: 'INTERNAL_ERROR',
      },
    })

    const right = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: right.id })

    const penalty = await prisma.scoreEvent.findFirst({
      where: { tournamentId, userId: player.id, type: 'SUBMISSION_PENALTY' },
    })

    expect(penalty).toBeNull()
  })

  it('counts the problem as solved once, not once per submission', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const prisma = getPrisma()
    const before = await prisma.problem.findUniqueOrThrow({
      where: { id: problemId },
      select: { solveCount: true },
    })

    const first = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: first.id })

    // A second accepted submission for the same problem must not count twice.
    const second = await submit('print(sum)', player.id)
    await judgeSubmission({ submissionId: second.id })

    const after = await prisma.problem.findUniqueOrThrow({
      where: { id: problemId },
      select: { solveCount: true },
    })

    expect(after.solveCount).toBe(before.solveCount + 1)
  })

  it('reaps a submission that was never judged', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const prisma = getPrisma()
    const stale = await prisma.submission.create({
      data: {
        tournamentId,
        problemId,
        userId: player.id,
        languageId,
        sourceCode: 'print(sum)',
        status: SubmissionStatus.QUEUED,
        submittedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      select: { id: true },
    })

    const reaped = await reapStaleSubmissions()
    expect(reaped).toBeGreaterThan(0)

    const judged = await prisma.submission.findUniqueOrThrow({
      where: { id: stale.id },
    })
    expect(judged.status).toBe(SubmissionStatus.ERROR)
  })
})
