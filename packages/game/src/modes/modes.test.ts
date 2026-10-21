import { describe, expect, it } from 'vitest'
import { deriveEvents, rank } from '../index'

const rubric = [
  { name: 'Impact', weight: 2, maxScore: 10 },
  { name: 'Craft', weight: 1, maxScore: 10 },
]

describe('hackathon mode', () => {
  it('normalises a raw score onto the leaderboard scale', () => {
    // maxRaw = 10*2 + 10*1 = 30; raw = 15 -> 15/30 * 1000 = 500
    const drafts = deriveEvents('hackathon', { rubric, scale: 1000 }, [
      {
        kind: 'project:scored',
        teamId: 'a',
        at: 1,
        payload: { projectId: 'p1', rawScore: 15 },
      },
    ])

    expect(drafts[0]?.delta).toBe(500)
  })

  it('produces the same scale for a rubric that totals a different number of points', () => {
    const smallRubric = [{ name: 'Only', weight: 1, maxScore: 100 }]
    const drafts = deriveEvents(
      'hackathon',
      { rubric: smallRubric, scale: 1000 },
      [
        {
          kind: 'project:scored',
          teamId: 'a',
          at: 1,
          payload: { projectId: 'p1', rawScore: 50 },
        },
      ],
    )

    expect(drafts[0]?.delta).toBe(500)
  })

  it('never produces a negative score', () => {
    const drafts = deriveEvents('hackathon', { rubric }, [
      {
        kind: 'project:scored',
        teamId: 'a',
        at: 1,
        payload: { projectId: 'p1', rawScore: -20 },
      },
    ])

    expect(drafts[0]?.delta).toBe(0)
  })

  it('skips scoring when the rubric has no criteria yet', () => {
    const drafts = deriveEvents('hackathon', { rubric: [] }, [
      {
        kind: 'project:scored',
        teamId: 'a',
        at: 1,
        payload: { projectId: 'p1', rawScore: 10 },
      },
    ])

    expect(drafts).toHaveLength(0)
  })
})

describe('polyglot mode', () => {
  it('divides base points by the language difficulty weight', () => {
    const drafts = deriveEvents(
      'polyglot',
      { basePoints: 1000, languageWeights: { rust: 0.5, python: 1 } },
      [
        {
          kind: 'submission:accepted',
          teamId: 'a',
          at: 1,
          payload: { language: 'rust' },
        },
        {
          kind: 'submission:accepted',
          teamId: 'b',
          at: 2,
          payload: { language: 'python' },
        },
      ],
    )

    expect(drafts[0]?.delta).toBe(2000)
    expect(drafts[1]?.delta).toBe(1000)
  })

  it('treats an unknown language as weight 1', () => {
    const drafts = deriveEvents('polyglot', { basePoints: 1000 }, [
      {
        kind: 'submission:accepted',
        teamId: 'a',
        at: 1,
        payload: { language: 'cobol' },
      },
    ])

    expect(drafts[0]?.delta).toBe(1000)
  })
})

describe('golf mode', () => {
  it('subtracts one point per byte', () => {
    const drafts = deriveEvents('golf', { basePoints: 1000 }, [
      {
        kind: 'submission:accepted',
        teamId: 'a',
        at: 1,
        payload: { bytes: 250 },
      },
    ])

    expect(drafts[0]?.delta).toBe(750)
  })

  it('never goes below zero', () => {
    const drafts = deriveEvents('golf', { basePoints: 100 }, [
      {
        kind: 'submission:accepted',
        teamId: 'a',
        at: 1,
        payload: { bytes: 5000 },
      },
    ])

    expect(drafts[0]?.delta).toBe(0)
  })
})

describe('bug hunt mode', () => {
  it('adds a speed bonus for finishing early', () => {
    const drafts = deriveEvents(
      'bugHunt',
      { basePoints: 1000, speedBonusPerMinute: 20 },
      [
        {
          kind: 'submission:accepted',
          teamId: 'a',
          at: 1,
          payload: { minutesRemaining: 10 },
        },
      ],
    )

    expect(drafts[0]?.delta).toBe(1200)
  })

  it('scales by the share of hidden tests passed when partial credit is on', () => {
    const drafts = deriveEvents(
      'bugHunt',
      { basePoints: 1000, speedBonusPerMinute: 0, partialCredit: true },
      [
        {
          kind: 'submission:accepted',
          teamId: 'a',
          at: 1,
          payload: { passedTests: 3, totalTests: 4 },
        },
      ],
    )

    expect(drafts[0]?.delta).toBe(750)
  })
})

describe('attack and defense mode', () => {
  it('awards attack points for a captured flag', () => {
    const drafts = deriveEvents('attackDefense', { attackPoints: 100 }, [
      {
        kind: 'attack:captured',
        teamId: 'a',
        at: 1,
        payload: { serviceId: 's1' },
      },
    ])

    expect(drafts[0]?.type).toBe('ATTACK_CAPTURED')
    expect(drafts[0]?.delta).toBe(100)
  })

  it('deducts points when a service is down', () => {
    const drafts = deriveEvents('attackDefense', { serviceDownPoints: 10 }, [
      {
        kind: 'service:down',
        teamId: 'a',
        at: 1,
        payload: { serviceId: 's1' },
      },
    ])

    expect(drafts[0]?.delta).toBe(-10)
  })
})

describe('knockout mode', () => {
  it('awards points per round won and consolation to the loser', () => {
    const drafts = deriveEvents(
      'knockout',
      { pointsPerRound: 100, consolationPoints: 25 },
      [
        {
          kind: 'match:finished',
          teamId: 'a',
          at: 1,
          payload: {
            matchId: 'm1',
            winnerTeamId: 'a',
            loserTeamId: 'b',
            roundsWon: 2,
          },
        },
      ],
    )

    expect(drafts[0]?.type).toBe('BRACKET_WIN')
    expect(drafts[0]?.delta).toBe(200)
    expect(drafts[1]?.type).toBe('BRACKET_LOSS')
    expect(drafts[1]?.delta).toBe(25)
  })
})

describe('ranking', () => {
  it('breaks a full tie with the team id so the order is stable', () => {
    const standings = rank('ctf', [
      {
        rank: 0,
        id: 'zebra',
        score: 100,
        solves: 1,
        penalty: 0,
        lastEventAt: 5,
      },
      {
        rank: 0,
        id: 'alpha',
        score: 100,
        solves: 1,
        penalty: 0,
        lastEventAt: 5,
      },
    ])

    expect(standings.map((s) => s.id)).toEqual(['alpha', 'zebra'])
  })
})
