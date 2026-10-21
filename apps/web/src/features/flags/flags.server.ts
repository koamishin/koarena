import {
  decryptFlag,
  encryptFlag,
  flagsMatch,
  hashAttempt,
  normaliseFlag,
  readFlagKey,
} from '@koarena/crypto'
import { getPrisma, ScoreEventType } from '@koarena/db'
import { ctfSolveAward } from '@koarena/game'
import { recordScoreEvent, rerankStandings } from '@koarena/ledger'
import { publishLiveEvent } from '@koarena/realtime'

/**
 * Server-only: flag storage and the solve path.
 *
 * The flag value never leaves the server. A submission is compared against the
 * decrypted flag and the *hash* of the attempt is what gets stored.
 */

const MAX_ATTEMPTS_PER_MINUTE = 10

export interface SolveResult {
  correct: boolean
  points: number
  firstBlood: boolean
  message: string
}

/** Store a flag, encrypted. */
export async function createFlag(
  tournamentId: string,
  challengeId: string,
  input: {
    value: string
    format?: 'STATIC' | 'REGEX' | 'CASE_INSENSITIVE'
    points?: number
  },
): Promise<{ id: string }> {
  const prisma = getPrisma()
  const key = readFlagKey()

  const encrypted = encryptFlag(input.value, key)

  const flag = await prisma.flag.create({
    data: {
      tournamentId,
      challengeId,
      value: encrypted.value,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      format: input.format ?? 'STATIC',
      points: input.points ?? 0,
    },
    select: { id: true },
  })

  return flag
}

export async function deleteFlag(flagId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.flag.delete({ where: { id: flagId } })
}

/**
 * Try a flag against a challenge.
 *
 * On a correct flag this is the whole scoring path: derive the award with the
 * engine, append one `ScoreEvent`, refresh the snapshot, re-rank, and publish
 * to the live channel.
 */
export async function submitFlag(
  actor: { id: string; teamId: string | null },
  input: { tournamentId: string; challengeId: string; flag: string },
): Promise<SolveResult> {
  const prisma = getPrisma()

  const challenge = await prisma.challenge.findFirst({
    where: {
      id: input.challengeId,
      tournamentId: input.tournamentId,
    },
    include: {
      flags: true,
      tournament: { select: { id: true, config: true, gameMode: true } },
    },
  })

  if (!challenge) {
    throw new Error('That challenge does not exist.')
  }

  if (challenge.state !== 'PUBLISHED') {
    throw new Error('That challenge is not open yet.')
  }

  if (challenge.flags.length === 0) {
    throw new Error('That challenge has no flag yet.')
  }

  // A team that already solved it is not scored twice.
  const alreadySolved = await prisma.challengeSolve.findFirst({
    where: {
      challengeId: challenge.id,
      ...(actor.teamId ? { teamId: actor.teamId } : { userId: actor.id }),
    },
    select: { id: true },
  })

  if (alreadySolved) {
    return {
      correct: true,
      points: 0,
      firstBlood: false,
      message: 'You already solved this one.',
    }
  }

  // Rate limit wrong attempts.
  const recentAttempts = await prisma.flagSubmission.count({
    where: {
      tournamentId: input.tournamentId,
      correct: false,
      createdAt: { gte: new Date(Date.now() - 60_000) },
      ...(actor.teamId ? { teamId: actor.teamId } : { userId: actor.id }),
    },
  })

  if (recentAttempts >= MAX_ATTEMPTS_PER_MINUTE) {
    throw new Error(
      'Too many attempts. Wait a minute before trying that challenge again.',
    )
  }

  // Compare against every flag on the challenge.
  const key = readFlagKey()
  let matchedFlagId: string | null = null

  for (const flag of challenge.flags) {
    const expected = decryptFlag(
      { value: flag.value, iv: flag.iv, authTag: flag.authTag },
      key,
    )
    const attempt = normaliseFlag(input.flag, flag.format)
    const expectedNormalised = normaliseFlag(expected, flag.format)

    if (flagsMatch(attempt, expectedNormalised)) {
      matchedFlagId = flag.id
      break
    }
  }

  const firstFlag = challenge.flags[0]
  if (!firstFlag) {
    throw new Error('That challenge has no flag yet.')
  }

  await prisma.flagSubmission.create({
    data: {
      tournamentId: input.tournamentId,
      flagId: firstFlag.id,
      teamId: actor.teamId,
      userId: actor.id,
      attemptHash: hashAttempt(input.flag),
      correct: matchedFlagId !== null,
    },
  })

  if (!matchedFlagId) {
    return {
      correct: false,
      points: 0,
      firstBlood: false,
      message: 'That is not the flag.',
    }
  }

  // The award comes from the engine, using the solve count as it stands.
  const solveCountBefore = challenge.solveCount
  const isFirstBlood = !challenge.firstBloodClaimed
  // The challenge carries its own points rule; the mode config only supplies
  // the first-blood bonus. Using the mode config here would award a challenge
  // more than the board says it is worth.
  const award = ctfSolveAward(
    challenge.tournament.config,
    {
      initialPoints: challenge.initialPoints,
      minPoints: challenge.minPoints,
      decayPerSolve: challenge.decayPerSolve,
    },
    solveCountBefore,
    isFirstBlood,
  )

  const idempotencyKey = `solve:${input.tournamentId}:${challenge.id}:${actor.teamId ?? actor.id}`

  const event = await recordScoreEvent({
    tournamentId: input.tournamentId,
    teamId: actor.teamId,
    userId: actor.id,
    type: ScoreEventType.CHALLENGE_SOLVED,
    points: award.points,
    weight: 1,
    delta: award.delta,
    refType: 'challenge',
    refId: challenge.id,
    metadata: {
      solvedBefore: solveCountBefore,
      isFirstBlood,
      bonus: award.bonus,
      challengeTitle: challenge.title,
    },
    idempotencyKey,
  })

  if (!event) {
    // The idempotency key was already used — someone solved it concurrently.
    return {
      correct: true,
      points: 0,
      firstBlood: false,
      message: 'You already solved this one.',
    }
  }

  await prisma.$transaction([
    prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        solveCount: { increment: 1 },
        firstBloodClaimed: true,
      },
    }),
    prisma.challengeSolve.create({
      data: {
        challengeId: challenge.id,
        teamId: actor.teamId,
        userId: actor.id,
        pointsAwarded: award.delta,
        isFirstBlood,
      },
    }),
  ])

  const standings = await rerankStandings(
    input.tournamentId,
    challenge.tournament.gameMode,
  )

  const standing = standings.find((row) =>
    actor.teamId ? row.teamId === actor.teamId : row.teamId === null,
  )

  await publishLiveEvent(input.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'challenge:solved',
    payload: {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      teamName: standing?.teamName ?? null,
      points: award.delta,
      firstBlood: isFirstBlood,
    },
  })

  await publishLiveEvent(input.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'score:update',
    payload: {
      teamId: actor.teamId,
      teamName: standing?.teamName ?? null,
      score: standing?.score ?? award.delta,
      rank: standing?.rank ?? 0,
      delta: award.delta,
      reason: `solved ${challenge.title}`,
    },
  })

  await publishLiveEvent(input.tournamentId, {
    id: 0,
    at: Date.now(),
    type: 'scoreboard:full',
    payload: { standings },
  })

  return {
    correct: true,
    points: award.delta,
    firstBlood: isFirstBlood,
    message: isFirstBlood
      ? `First blood! +${award.delta} points.`
      : `Correct. +${award.delta} points.`,
  }
}
