// @vitest-environment node

import { getPrisma } from '@koarena/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestUser,
  hasDatabase,
  uniqueSuffix,
} from '../../test/db'
import { createTournamentFor } from '../tournaments/tournaments.server'
import {
  getStandings,
  recordScoreEvent,
  rerankStandings,
} from './scoring.server'

const suite = hasDatabase ? describe : describe.skip

suite('the score ledger', () => {
  const createdUsers: string[] = []
  let tournamentId = ''
  let gameMode = 'CTF'

  beforeAll(async () => {
    if (!hasDatabase) return
    const user = await createTestUser('ORGANIZER')
    createdUsers.push(user.id)

    const tournament = await createTournamentFor(user.id, {
      name: 'Ledger Test',
      slug: `ledger-${uniqueSuffix()}`,
      gameMode: 'CTF',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      languageIds: [],
      config: {},
    })

    tournamentId = tournament.id
    gameMode = 'CTF'
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers)
  })

  it('records a score event and reflects it in the snapshot', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const event = await recordScoreEvent({
      tournamentId,
      teamId: null,
      userId: user.id,
      type: 'CHALLENGE_SOLVED',
      points: 500,
      delta: 525,
      idempotencyKey: `test:${uniqueSuffix()}`,
    })

    expect(event).not.toBeNull()
    expect(event?.delta).toBe(525)

    const standings = await getStandings(tournamentId, gameMode)
    const mine = standings.find((row) => row.id === user.id)
    expect(mine?.score).toBe(525)
    expect(mine?.solves).toBe(1)
  })

  it('is append-only — the same idempotency key is ignored', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)
    const key = `dupe:${uniqueSuffix()}`

    const first = await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'CHALLENGE_SOLVED',
      points: 100,
      delta: 100,
      idempotencyKey: key,
    })
    const second = await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'CHALLENGE_SOLVED',
      points: 100,
      delta: 100,
      idempotencyKey: key,
    })

    expect(first).not.toBeNull()
    expect(second).toBeNull()

    const prisma = getPrisma()
    const events = await prisma.scoreEvent.count({
      where: { idempotencyKey: key },
    })
    expect(events).toBe(1)
  })

  it('sums a penalty into the standing without moving the score', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'PROBLEM_SOLVED',
      points: 1,
      delta: 1,
      idempotencyKey: `p:${uniqueSuffix()}`,
    })
    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'SUBMISSION_PENALTY',
      points: 40,
      delta: 0,
      metadata: { penaltyMinutes: 40 },
      idempotencyKey: `pen:${uniqueSuffix()}`,
    })

    const standings = await getStandings(tournamentId, gameMode)
    const mine = standings.find((row) => row.id === user.id)

    expect(mine?.solves).toBe(1)
    expect(mine?.penalty).toBe(40)
  })

  it('ranks by score, then by solves', async () => {
    const low = await createTestUser()
    const high = await createTestUser()
    createdUsers.push(low.id, high.id)

    await recordScoreEvent({
      tournamentId,
      userId: high.id,
      type: 'CHALLENGE_SOLVED',
      points: 1000,
      delta: 1000,
      idempotencyKey: `hi:${uniqueSuffix()}`,
    })
    await recordScoreEvent({
      tournamentId,
      userId: low.id,
      type: 'CHALLENGE_SOLVED',
      points: 100,
      delta: 100,
      idempotencyKey: `lo:${uniqueSuffix()}`,
    })

    const standings = await rerankStandings(tournamentId, gameMode)
    const top = standings[0]
    expect(top?.score).toBeGreaterThan(standings[1]?.score ?? 0)
  })

  it('never writes a score without a ledger event', async () => {
    const prisma = getPrisma()
    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { tournamentId },
      select: { teamId: true, userId: true, score: true, solves: true },
    })

    for (const snapshot of snapshots) {
      const events = await prisma.scoreEvent.findMany({
        where: snapshot.teamId
          ? { tournamentId, teamId: snapshot.teamId }
          : { tournamentId, teamId: null, userId: snapshot.userId },
        select: { delta: true },
      })
      const total = events.reduce((sum, event) => sum + event.delta, 0)
      expect(snapshot.score).toBe(total)
    }
  })
})
