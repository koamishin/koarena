import { getPrisma } from '@koarena/db'

import type { ProblemDto, SubmissionDto } from './types'

/**
 * Server-only: the ACM problem board and the submission list.
 */

export interface ProblemViewer {
  id: string
  teamId: string | null
}

export async function listProblems(
  tournamentId: string,
  viewer: ProblemViewer | null,
): Promise<ProblemDto[]> {
  const prisma = getPrisma()

  const problems = await prisma.problem.findMany({
    where: { tournamentId },
    orderBy: [{ points: 'asc' }, { title: 'asc' }],
    include: {
      languages: { include: { language: true } },
      testCases: { orderBy: { order: 'asc' } },
    },
  })

  const solves = viewer
    ? await prisma.submission.findMany({
        where: {
          tournamentId,
          status: 'ACCEPTED',
          ...(viewer.teamId
            ? { teamId: viewer.teamId }
            : { userId: viewer.id }),
        },
        select: { problemId: true, submittedAt: true, score: true },
      })
    : []

  const solvedBy = new Map(
    solves.map((solve) => [
      solve.problemId,
      { solvedAt: solve.submittedAt.toISOString(), points: solve.score },
    ]),
  )

  return problems.map((problem) => {
    const sampleCases = problem.testCases.filter(
      (testCase) => testCase.isSample,
    )
    const solve = solvedBy.get(problem.id)

    return {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      statement: problem.statement,
      difficulty: problem.difficulty,
      points: problem.points,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitKb: problem.memoryLimitKb,
      solveCount: problem.solveCount,
      maxSolves: problem.maxSolves,
      languages: problem.languages.map((entry) => ({
        id: entry.language.id,
        slug: entry.language.slug,
        name: entry.language.name,
        editorMode: entry.language.editorMode,
      })),
      testCases: sampleCases.map((testCase) => ({
        id: testCase.id,
        order: testCase.order,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        isSample: true,
        points: testCase.points,
      })),
      hiddenTestCaseCount: problem.testCases.length - sampleCases.length,
      solved: Boolean(solve),
      solvedAt: solve?.solvedAt ?? null,
      pointsAwarded: solve?.points ?? null,
    }
  })
}

export async function getProblem(
  tournamentId: string,
  problemId: string,
  viewer: ProblemViewer | null,
): Promise<ProblemDto | null> {
  const problems = await listProblems(tournamentId, viewer)
  return problems.find((problem) => problem.id === problemId) ?? null
}

export async function listSubmissions(
  tournamentId: string,
  problemId: string,
  viewer: ProblemViewer,
): Promise<SubmissionDto[]> {
  const prisma = getPrisma()

  const submissions = await prisma.submission.findMany({
    where: {
      tournamentId,
      problemId,
      ...(viewer.teamId ? { teamId: viewer.teamId } : { userId: viewer.id }),
    },
    orderBy: { submittedAt: 'desc' },
    take: 50,
    include: { language: { select: { slug: true, name: true } } },
  })

  return submissions.map((submission) => ({
    id: submission.id,
    status: submission.status,
    verdict: submission.verdict,
    stdout: submission.stdout,
    stderr: submission.stderr,
    timeMs: submission.timeMs,
    memoryKb: submission.memoryKb,
    exitCode: submission.exitCode,
    sourceCode: submission.sourceCode,
    languageSlug: submission.language.slug,
    languageName: submission.language.name,
    submittedAt: submission.submittedAt.toISOString(),
    judgedAt: submission.judgedAt?.toISOString() ?? null,
  }))
}

export async function getSubmission(
  submissionId: string,
  viewer: ProblemViewer,
): Promise<SubmissionDto | null> {
  const prisma = getPrisma()

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { language: { select: { slug: true, name: true } } },
  })

  if (!submission) return null

  const owns =
    viewer.teamId !== null
      ? submission.teamId === viewer.teamId
      : submission.userId === viewer.id

  if (!owns) return null

  return {
    id: submission.id,
    status: submission.status,
    verdict: submission.verdict,
    stdout: submission.stdout,
    stderr: submission.stderr,
    timeMs: submission.timeMs,
    memoryKb: submission.memoryKb,
    exitCode: submission.exitCode,
    sourceCode: submission.sourceCode,
    languageSlug: submission.language.slug,
    languageName: submission.language.name,
    submittedAt: submission.submittedAt.toISOString(),
    judgedAt: submission.judgedAt?.toISOString() ?? null,
  }
}

export interface OrganizerProblemDto {
  id: string
  slug: string
  title: string
  difficulty: string
  points: number
  solveCount: number
  testCases: Array<{
    id: string
    order: number
    input: string
    expectedOutput: string
    isSample: boolean
  }>
  languageCount: number
}

/** Every problem of a tournament, with its test cases — the organizer's view. */
export async function listOrganizerProblems(
  tournamentId: string,
): Promise<OrganizerProblemDto[]> {
  const prisma = getPrisma()

  const problems = await prisma.problem.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' },
    include: {
      testCases: { orderBy: { order: 'asc' } },
      _count: { select: { languages: true } },
    },
  })

  return problems.map((problem) => ({
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    points: problem.points,
    solveCount: problem.solveCount,
    testCases: problem.testCases.map((testCase) => ({
      id: testCase.id,
      order: testCase.order,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isSample: testCase.isSample,
    })),
    languageCount: problem._count.languages,
  }))
}
