import { describe, expect, it } from 'vitest'
import { deriveEvents, rank } from '../index'

describe('acm mode', () => {
  it('awards one point per solved problem', () => {
    const drafts = deriveEvents('acm', {}, [
      {
        kind: 'problem:accepted',
        teamId: 'a',
        at: 1,
        payload: { problemId: 'p1' },
      },
    ])

    expect(drafts[0]?.type).toBe('PROBLEM_SOLVED')
    expect(drafts[0]?.delta).toBe(1)
  })

  it('records penalty time for wrong submissions before the first AC', () => {
    const drafts = deriveEvents('acm', { penaltyMinutes: 20 }, [
      {
        kind: 'problem:accepted',
        teamId: 'a',
        at: 1,
        payload: { problemId: 'p1', wrongSubmissions: 3 },
      },
    ])

    const penalty = drafts.find((d) => d.type === 'SUBMISSION_PENALTY')
    expect(penalty?.metadata?.penaltyMinutes).toBe(60)
    // The penalty does not move the score, it only feeds the tie-break.
    expect(penalty?.delta).toBe(0)
  })

  it('caps the number of penalised wrong submissions', () => {
    const drafts = deriveEvents(
      'acm',
      { penaltyMinutes: 20, wrongSubmissionCap: 3 },
      [
        {
          kind: 'problem:accepted',
          teamId: 'a',
          at: 1,
          payload: { problemId: 'p1', wrongSubmissions: 99 },
        },
      ],
    )

    const penalty = drafts.find((d) => d.type === 'SUBMISSION_PENALTY')
    expect(penalty?.metadata?.penaltyMinutes).toBe(60)
  })

  it('ignores problems that were never solved', () => {
    const drafts = deriveEvents('acm', {}, [
      {
        kind: 'submission:wrong',
        teamId: 'a',
        at: 1,
        payload: { problemId: 'p1' },
      },
    ])

    expect(drafts).toHaveLength(0)
  })

  it('ranks by solves, then by lowest penalty', () => {
    const standings = rank('acm', [
      {
        rank: 0,
        teamId: 'slow',
        score: 1,
        solves: 1,
        penalty: 40,
        lastEventAt: 10,
      },
      {
        rank: 0,
        teamId: 'fast',
        score: 1,
        solves: 1,
        penalty: 20,
        lastEventAt: 30,
      },
      {
        rank: 0,
        teamId: 'best',
        score: 3,
        solves: 3,
        penalty: 60,
        lastEventAt: 40,
      },
    ])

    expect(standings.map((s) => s.teamId)).toEqual(['best', 'fast', 'slow'])
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3])
  })
})
