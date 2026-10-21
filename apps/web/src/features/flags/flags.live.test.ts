// @vitest-environment node

import { getPrisma } from '@koarena/db'
import {
  closeLiveBus,
  type LiveEvent,
  publishLiveEvent,
  subscribeLiveEvents,
} from '@koarena/realtime'
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

const hasRedis = Boolean(process.env.REDIS_URL)
// This suite needs both a database and Redis: without them the bus has nothing
// to publish to, and half a suite is worse than none.
const suite = hasDatabase && hasRedis ? describe : describe.skip

/** Wait for a condition, polling — Redis delivery is asynchronous. */
async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

suite('the live bus', () => {
  const createdUsers: string[] = []
  let tournamentId = ''

  beforeAll(async () => {
    if (!hasDatabase) return

    process.env.FLAG_ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString('base64')

    const organizer = await createTestUser('ORGANIZER')
    createdUsers.push(organizer.id)

    const tournament = await createTournamentFor(organizer.id, {
      name: 'Live Test',
      slug: `live-${uniqueSuffix()}`,
      gameMode: 'CTF',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      languageIds: [],
      config: { basePoints: 500, firstBloodBonus: 25 },
    })
    tournamentId = tournament.id
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers)
    await closeLiveBus()
  })

  it('delivers a published event to a subscriber', async () => {
    const received: LiveEvent[] = []
    const unsubscribe = await subscribeLiveEvents(tournamentId, (event) => {
      received.push(event)
    })

    // Give the subscriber a moment to finish its psubscribe.
    await new Promise((resolve) => setTimeout(resolve, 300))

    const published = await publishLiveEvent(tournamentId, {
      id: 0,
      at: Date.now(),
      type: 'announce',
      payload: { title: 'Probe', body: 'hello', authorName: null },
    })

    expect(published).toBe(true)
    // Redis delivers asynchronously: a message published a moment ago can still
    // be in flight.
    expect(await waitFor(() => received.length > 0)).toBe(true)
    unsubscribe()
    expect(received).toHaveLength(1)
    expect(received[0]?.type).toBe('announce')
  })

  it('publishes a solve event to the live channel', async () => {
    const organizer = createdUsers[0]
    if (!organizer) throw new Error('expected an organizer')
    const challenge = await createChallengeFor(organizer, {
      title: 'Live challenge',
      slug: `live-challenge-${uniqueSuffix()}`,
      description: 'Solve it.',
    })
    await updateChallenge(challenge.id, { state: 'PUBLISHED' })
    await createFlag(tournamentId, challenge.id, { value: 'koarena{live}' })

    const player = await createTestUser()
    createdUsers.push(player.id)

    const received: LiveEvent[] = []
    const unsubscribe = await subscribeLiveEvents(tournamentId, (event) => {
      received.push(event)
    })
    await new Promise((resolve) => setTimeout(resolve, 300))

    const result = await submitFlag(
      { id: player.id, teamId: null },
      { tournamentId, challengeId: challenge.id, flag: 'koarena{live}' },
    )

    expect(result.correct).toBe(true)

    // All three events are published before submitFlag returns, but they arrive
    // asynchronously — wait for the last one before reading the list.
    expect(await waitFor(() => received.length >= 3)).toBe(true)
    unsubscribe()

    const types = received.map((event) => event.type)
    expect(types).toContain('challenge:solved')
    expect(types).toContain('score:update')
    expect(types).toContain('scoreboard:full')

    const solved = received.find((event) => event.type === 'challenge:solved')
    expect(solved?.payload).toMatchObject({
      challengeTitle: 'Live challenge',
      points: 525,
      firstBlood: true,
    })
  })

  it('does not deliver another tournament’s events', async () => {
    const received: LiveEvent[] = []
    const unsubscribe = await subscribeLiveEvents(
      'some-other-tournament',
      (event) => {
        received.push(event)
      },
    )
    await new Promise((resolve) => setTimeout(resolve, 300))

    await publishLiveEvent(tournamentId, {
      id: 0,
      at: Date.now(),
      type: 'announce',
      payload: { title: 'Elsewhere', body: 'not for you', authorName: null },
    })

    // Give a stray event time to arrive before deciding it did not.
    await new Promise((resolve) => setTimeout(resolve, 400))
    unsubscribe()

    expect(received).toHaveLength(0)
  })
})

/** A tiny helper so the test above can create a challenge in one call. */
async function createChallengeFor(
  organizerId: string,
  input: { title: string; slug: string; description: string },
) {
  const prisma = getPrisma()
  const tournament = await prisma.tournament.findFirst({
    where: { createdById: organizerId },
    select: { id: true },
  })

  if (!tournament) throw new Error('expected a tournament')
  return createChallenge(tournament.id, organizerId, input)
}
