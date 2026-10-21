import { describe, expect, it } from 'vitest'
import { deriveEvents, parseConfig } from '../index'

describe('ctf mode', () => {
  it('awards base points for the first solve', () => {
    const drafts = deriveEvents('ctf', {}, [
      {
        kind: 'challenge:solved',
        teamId: 'a',
        at: 1,
        payload: { challengeId: 'c1' },
      },
    ])

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.delta).toBe(525) // 500 base + 25 first blood
    expect(drafts[0]?.points).toBe(500)
    expect(drafts[0]?.metadata?.isFirstBlood).toBe(true)
  })

  it('decays points for each later solve of the same challenge', () => {
    const drafts = deriveEvents(
      'ctf',
      { basePoints: 500, decayPerSolve: 50, firstBloodBonus: 0 },
      [
        {
          kind: 'challenge:solved',
          teamId: 'a',
          at: 1,
          payload: { challengeId: 'c1' },
        },
        {
          kind: 'challenge:solved',
          teamId: 'b',
          at: 2,
          payload: { challengeId: 'c1' },
        },
        {
          kind: 'challenge:solved',
          teamId: 'c',
          at: 3,
          payload: { challengeId: 'c1' },
        },
      ],
    )

    expect(drafts.map((d) => d.delta)).toEqual([500, 450, 400])
  })

  it('never drops below minPoints', () => {
    const drafts = deriveEvents(
      'ctf',
      {
        basePoints: 200,
        decayPerSolve: 100,
        minPoints: 100,
        firstBloodBonus: 0,
      },
      [
        {
          kind: 'challenge:solved',
          teamId: 'a',
          at: 1,
          payload: { challengeId: 'c1' },
        },
        {
          kind: 'challenge:solved',
          teamId: 'b',
          at: 2,
          payload: { challengeId: 'c1' },
        },
        {
          kind: 'challenge:solved',
          teamId: 'c',
          at: 3,
          payload: { challengeId: 'c1' },
        },
      ],
    )

    expect(drafts.map((d) => d.delta)).toEqual([200, 100, 100])
  })

  it('decays per challenge, not globally', () => {
    const drafts = deriveEvents(
      'ctf',
      { basePoints: 500, decayPerSolve: 50, firstBloodBonus: 0 },
      [
        {
          kind: 'challenge:solved',
          teamId: 'a',
          at: 1,
          payload: { challengeId: 'c1' },
        },
        {
          kind: 'challenge:solved',
          teamId: 'a',
          at: 2,
          payload: { challengeId: 'c2' },
        },
      ],
    )

    expect(drafts.map((d) => d.delta)).toEqual([500, 500])
  })

  it('is order independent — events are sorted by time first', () => {
    const ordered = deriveEvents('ctf', { firstBloodBonus: 0 }, [
      {
        kind: 'challenge:solved',
        teamId: 'a',
        at: 1,
        payload: { challengeId: 'c1' },
      },
      {
        kind: 'challenge:solved',
        teamId: 'b',
        at: 2,
        payload: { challengeId: 'c1' },
      },
    ])
    const shuffled = deriveEvents('ctf', { firstBloodBonus: 0 }, [
      {
        kind: 'challenge:solved',
        teamId: 'b',
        at: 2,
        payload: { challengeId: 'c1' },
      },
      {
        kind: 'challenge:solved',
        teamId: 'a',
        at: 1,
        payload: { challengeId: 'c1' },
      },
    ])

    expect(shuffled.map((d) => d.delta)).toEqual(ordered.map((d) => d.delta))
  })

  it('fills in defaults for a partial config', () => {
    const config = parseConfig('ctf', { basePoints: 750 })
    expect(config).toMatchObject({
      basePoints: 750,
      minPoints: 100,
      decayPerSolve: 50,
    })
  })

  it('rejects a config with a negative base', () => {
    expect(() => parseConfig('ctf', { basePoints: -1 })).toThrow()
  })
})
