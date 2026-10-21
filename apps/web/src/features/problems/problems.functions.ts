import { getPrisma, SubmissionStatus } from '@koarena/db'
import { getJudgeQueue } from '@koarena/queue'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireOrganizer, requireUser } from '../auth/auth.functions'
import { resolveParticipant } from '../tournaments/tournaments.server'
import {
  getProblem,
  getSubmission,
  listOrganizerProblems,
  listProblems,
  listSubmissions,
} from './problems.server'

export const listProblemsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const viewer = await resolveParticipant(data.tournamentId, user.id)
    return listProblems(data.tournamentId, viewer)
  })

export const getProblemFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      problemId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const viewer = await resolveParticipant(data.tournamentId, user.id)
    return getProblem(data.tournamentId, data.problemId, viewer)
  })

export const listSubmissionsFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      problemId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const viewer = await resolveParticipant(data.tournamentId, user.id)
    return listSubmissions(data.tournamentId, data.problemId, viewer)
  })

export const getSubmissionFn = createServerFn({ method: 'GET' })
  .validator(z.object({ submissionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const prisma = getPrisma()

    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId },
      select: { tournamentId: true },
    })

    if (!submission) return null

    const viewer = await resolveParticipant(submission.tournamentId, user.id)
    return getSubmission(data.submissionId, viewer)
  })

/**
 * Submit code for a problem.
 *
 * The submission is recorded immediately and handed to the judging queue; the
 * worker runs it and writes the verdict. The player sees the status change over
 * the live channel.
 */
export const createSubmissionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      problemId: z.string().min(1),
      languageId: z.string().min(1),
      sourceCode: z.string().min(1).max(200_000),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const prisma = getPrisma()

    const tournament = await prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: { id: true, status: true },
    })

    if (!tournament) throw new Error('Tournament not found.')
    if (tournament.status !== 'LIVE' && tournament.status !== 'REGISTRATION') {
      throw new Error('This tournament is not accepting submissions.')
    }

    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
      include: { languages: true },
    })

    if (!problem || problem.tournamentId !== tournament.id) {
      throw new Error('Problem not found.')
    }

    const language = await prisma.language.findUnique({
      where: { id: data.languageId },
    })

    if (!language || !language.enabled) {
      throw new Error('That language is not available.')
    }

    if (problem.languages.length > 0) {
      const allowed = problem.languages.some(
        (entry) => entry.languageId === language.id,
      )
      if (!allowed) {
        throw new Error(
          `This problem cannot be solved in ${language.name}. Allowed: ${problem.languages
            .map((entry) => entry.languageId)
            .join(', ')}.`,
        )
      }
    }

    const participant = await resolveParticipant(tournament.id, user.id)
    if (!participant.teamId && !participant.id) {
      throw new Error('Register for the tournament before submitting.')
    }

    const submission = await prisma.submission.create({
      data: {
        tournamentId: tournament.id,
        problemId: problem.id,
        teamId: participant.teamId,
        userId: user.id,
        languageId: language.id,
        sourceCode: data.sourceCode,
        status: SubmissionStatus.QUEUED,
      },
      select: { id: true },
    })

    await prisma.judgeRun.create({
      data: {
        submissionId: submission.id,
        languageId: language.id,
        runner: process.env.RUNNER_MODE ?? 'simulated',
        status: 'QUEUED',
      },
    })

    await getJudgeQueue().add(
      'judge',
      { submissionId: submission.id },
      { jobId: submission.id },
    )

    return { submissionId: submission.id }
  })

/** The organizer's problem manager. */
export const createProblemFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tournamentId: z.string().min(1),
      title: z.string().trim().min(3).max(120),
      slug: z.string().trim().min(1).max(80),
      statement: z.string().trim().min(1).max(40_000),
      difficulty: z
        .enum(['easy', 'medium', 'hard', 'insane'])
        .default('medium'),
      points: z.number().int().min(1).max(1000).default(1),
      timeLimitMs: z.number().int().min(100).max(60_000).default(2_000),
      memoryLimitKb: z
        .number()
        .int()
        .min(16_384)
        .max(2_048_000)
        .default(262_144),
      languageIds: z.array(z.string().min(1)).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const organizer = await requireOrganizer()
    const prisma = getPrisma()

    const clash = await prisma.problem.findUnique({
      where: {
        tournamentId_slug: { tournamentId: data.tournamentId, slug: data.slug },
      },
      select: { id: true },
    })

    if (clash) throw new Error('A problem with that URL already exists.')

    const problem = await prisma.problem.create({
      data: {
        tournamentId: data.tournamentId,
        authorId: organizer.id,
        title: data.title,
        slug: data.slug,
        statement: data.statement,
        difficulty: data.difficulty,
        points: data.points,
        timeLimitMs: data.timeLimitMs,
        memoryLimitKb: data.memoryLimitKb,
      },
      select: { id: true },
    })

    if (data.languageIds.length > 0) {
      await prisma.problemLanguage.createMany({
        data: data.languageIds.map((languageId) => ({
          problemId: problem.id,
          languageId,
        })),
      })
    }

    return problem
  })

export const addTestCaseFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      problemId: z.string().min(1),
      input: z.string().max(20_000),
      expectedOutput: z.string().max(20_000),
      isSample: z.boolean().default(false),
      points: z.number().int().min(0).max(1000).default(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireOrganizer()
    const prisma = getPrisma()

    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
      select: { id: true, testCases: { select: { order: true } } },
    })

    if (!problem) throw new Error('Problem not found.')

    const nextOrder =
      Math.max(0, ...problem.testCases.map((testCase) => testCase.order)) + 1

    const testCase = await prisma.problemTestCase.create({
      data: {
        problemId: data.problemId,
        order: nextOrder,
        input: data.input,
        expectedOutput: data.expectedOutput,
        isSample: data.isSample,
        points: data.points,
      },
      select: { id: true, order: true },
    })

    return testCase
  })

export const deleteTestCaseFn = createServerFn({ method: 'POST' })
  .validator(z.object({ testCaseId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    const prisma = getPrisma()
    await prisma.problemTestCase.delete({ where: { id: data.testCaseId } })
    return { deleted: true }
  })

/** The organizer's problem list, with the test cases. */
export const listOrganizerProblemsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireOrganizer()
    return listOrganizerProblems(data.tournamentId)
  })
