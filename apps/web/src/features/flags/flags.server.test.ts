// @vitest-environment node

import { getPrisma } from '@koarena/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestUser,
  hasDatabase,
  uniqueSuffix,
} from '../../test/db'
import {
  createChallenge,
  updateChallenge,
} from '../challenges/challenges.server'
import { createTournamentFor } from '../tournaments/tournaments.server'
import { createFlag, submitFlag } from './flags.server'

const suite = hasDatabase ? describe : describe.skip

const FLAG = 'koarena{the-first-flag}'
const FLAG_KEY = Buffer.alloc(32, 9).toString('base64')

suite('the solve path', () => {
  const createdUsers: string[] = []
  let tournamentId = ''
  let challengeId = ''

  beforeAll(async () => {
    if (!hasDatabase) return

    process.env.FLAG_ENCRYPTION_KEY = FLAG_KEY

    const organizer = await createTestUser('ORGANIZER')
    createdUsers.push(organizer.id)

    const tournament = await createTournamentFor(organizer.id, {
      name: 'Solve Test',
      slug: `solve-${uniqueSuffix()}`,
      gameMode: 'CTF',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      languageIds: [],
      config: {
        basePoints: 500,
        minPoints: 100,
        decayPerSolve: 50,
        firstBloodBonus: 25,
      },
    })
    tournamentId = tournament.id

    const challenge = await createChallenge(tournament.id, organizer.id, {
      title: 'Warmup',
      slug: `warmup-${uniqueSuffix()}`,
      description: 'Find the flag.',
      initialPoints: 500,
      minPoints: 100,
      decayPerSolve: 50,
    })
    challengeId = challenge.id

    // A challenge is only playable once it is published.
    await updateChallenge(challenge.id, { state: 'PUBLISHED' })

    await createFlag(tournament.id, challenge.id, { value: FLAG })
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers)
  })

  it('rejects a wrong flag and stores only its hash', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const result = await submitFlag(
      { id: player.id, teamId: null },
      { tournamentId, challengeId, flag: 'koarena{nope}' },
    )

    expect(result.correct).toBe(false)
    expect(result.points).toBe(0)

    const prisma = getPrisma()
    const submissions = await prisma.flagSubmission.findMany({
      where: { userId: player.id },
    })

    expect(submissions).toHaveLength(1)
    expect(submissions[0]?.correct).toBe(false)
    // The attempt itself is never stored.
    expect(submissions[0]?.attemptHash).not.toContain('nope')
  })

  it('accepts the right flag, awards points and first blood', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const result = await submitFlag(
      { id: player.id, teamId: null },
      { tournamentId, challengeId, flag: FLAG },
    )

    expect(result.correct).toBe(true)
    expect(result.firstBlood).toBe(true)
    // 500 base + 25 first blood
    expect(result.points).toBe(525)
  })

  it('does not award the same challenge twice', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    const first = await submitFlag(
      { id: player.id, teamId: null },
      { tournamentId, challengeId, flag: FLAG },
    )
    const second = await submitFlag(
      { id: player.id, teamId: null },
      { tournamentId, challengeId, flag: FLAG },
    )

    expect(first.correct).toBe(true)
    expect(first.points).toBeGreaterThan(0)
    expect(second.correct).toBe(true)
    expect(second.points).toBe(0)
    expect(second.message).toMatch(/already solved/i)
  })

  it('writes exactly one score event per solve', async () => {
    const prisma = getPrisma()

    // Every player who solves the challenge gets their own event.
    const events = await prisma.scoreEvent.findMany({
      where: { tournamentId, type: 'CHALLENGE_SOLVED' },
      select: { userId: true, idempotencyKey: true },
    })

    const keys = events.map((event) => event.idempotencyKey)
    expect(new Set(keys).size).toBe(keys.length)

    const perUser = new Map<string, number>()
    for (const event of events) {
      const key = event.userId ?? 'unknown'
      perUser.set(key, (perUser.get(key) ?? 0) + 1)
    }
    for (const count of perUser.values()) {
      expect(count).toBe(1)
    }
  })

  it('never stores the flag in plaintext', async () => {
    const prisma = getPrisma()
    const flags = await prisma.flag.findMany({ where: { tournamentId } })

    expect(flags.length).toBeGreaterThan(0)
    for (const flag of flags) {
      expect(flag.value).not.toContain('the-first-flag')
      expect(flag.iv).not.toBe('')
      expect(flag.authTag).not.toBe('')
    }
  })

  it('rate limits wrong attempts', async () => {
    const player = await createTestUser()
    createdUsers.push(player.id)

    // Eleven wrong attempts in a row: the eleventh must be refused.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await submitFlag(
        { id: player.id, teamId: null },
        { tournamentId, challengeId, flag: `wrong-${attempt}` },
      )
      expect(result.correct).toBe(false)
    }

    await expect(
      submitFlag(
        { id: player.id, teamId: null },
        { tournamentId, challengeId, flag: 'wrong-again' },
      ),
    ).rejects.toThrow(/too many attempts/i)
  })
})
