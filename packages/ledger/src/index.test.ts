// @vitest-environment node

import { getPrisma } from '@koarena/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getStandings,
  rebuildSnapshots,
  rebuildSolveCounts,
  recordScoreEvent,
  rerankStandings,
} from './index'
import {
  cleanup,
  createTestTournament,
  createTestUser,
  hasDatabase,
  uniqueSuffix,
} from './test-support'

const suite = hasDatabase ? describe : describe.skip

suite('the score ledger', () => {
  const createdUsers: string[] = []
  let tournamentId = ''
  let gameMode = 'CTF'

  beforeAll(async () => {
    if (!hasDatabase) return
    const user = await createTestUser('ORGANIZER')
    createdUsers.push(user.id)

    const tournament = await createTestTournament(user.id, {
      name: 'Ledger Test',
      config: { basePoints: 500, firstBloodBonus: 25 },
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

  it('counts a solve once per thing solved, not once per event', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const problemId = `problem-${uniqueSuffix()}`

    // Two rows for the same problem: a duplicate, not two solves.
    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'PROBLEM_SOLVED',
      points: 1,
      delta: 1,
      refType: 'problem',
      refId: problemId,
      idempotencyKey: `a:${uniqueSuffix()}`,
    })
    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'PROBLEM_SOLVED',
      points: 1,
      delta: 1,
      refType: 'problem',
      refId: problemId,
      idempotencyKey: `b:${uniqueSuffix()}`,
    })

    const standings = await getStandings(tournamentId, gameMode)
    const mine = standings.find((row) => row.id === user.id)

    expect(mine?.solves).toBe(1)
  })

  it('rebuilds the snapshots from the events', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'CHALLENGE_SOLVED',
      points: 250,
      delta: 250,
      idempotencyKey: `rebuild:${uniqueSuffix()}`,
    })
    const prisma = getPrisma()
    await prisma.scoreSnapshot.deleteMany({
      where: { tournamentId, teamId: null, userId: user.id },
    })

    const before = await getStandings(tournamentId, gameMode)
    expect(before.find((row) => row.id === user.id)).toBeUndefined()

    await rebuildSnapshots(tournamentId)

    const after = await getStandings(tournamentId, gameMode)
    const mine = after.find((row) => row.id === user.id)

    expect(mine?.score).toBe(250)
    expect(mine?.solves).toBe(1)
  })

  it('drops the standing of a participant whose events are gone', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    await recordScoreEvent({
      tournamentId,
      userId: user.id,
      type: 'CHALLENGE_SOLVED',
      points: 75,
      delta: 75,
      idempotencyKey: `orphan:${uniqueSuffix()}`,
    })

    const prisma = getPrisma()
    expect(
      (await getStandings(tournamentId, gameMode)).find(
        (row) => row.id === user.id,
      ),
    ).toBeDefined()

    // The events are the source of truth: with them gone, the standing goes too.
    await prisma.scoreEvent.deleteMany({
      where: { tournamentId, teamId: null, userId: user.id },
    })
    await rebuildSnapshots(tournamentId)

    expect(
      (await getStandings(tournamentId, gameMode)).find(
        (row) => row.id === user.id,
      ),
    ).toBeUndefined()
  })

  it('rebuilds the problem solve counter from the ledger', async () => {
    if (!hasDatabase) return

    const prisma = getPrisma()
    const organizer = await createTestUser('ORGANIZER')
    createdUsers.push(organizer.id)

    const tournament = await createTestTournament(organizer.id, {
      gameMode: 'ACM',
    })

    const problem = await prisma.problem.create({
      data: {
        tournamentId: tournament.id,
        authorId: organizer.id,
        slug: `counter-${uniqueSuffix()}`,
        title: 'Counter',
        statement: 'Count the solves.',
        solveCount: 99,
      },
      select: { id: true },
    })

    const player = await createTestUser()
    createdUsers.push(player.id)

    await recordScoreEvent({
      tournamentId: tournament.id,
      userId: player.id,
      type: 'PROBLEM_SOLVED',
      points: 1,
      delta: 1,
      refType: 'problem',
      refId: problem.id,
      idempotencyKey: `counter:${uniqueSuffix()}`,
    })

    await rebuildSolveCounts(tournament.id)

    const after = await prisma.problem.findUniqueOrThrow({
      where: { id: problem.id },
      select: { solveCount: true },
    })

    expect(after.solveCount).toBe(1)
  })
})
