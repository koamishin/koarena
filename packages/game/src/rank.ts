import type { Standing, TieBreaker } from './types'

/**
 * Rank teams with a deterministic, total ordering.
 *
 * Every mode ends with `id` as the final tie-breaker so two participants with
 * identical numbers always come out in the same order — otherwise the
 * leaderboard would flicker between renders.
 */
export function rankStandings(
  standings: Standing[],
  tieBreakers: readonly TieBreaker[],
): Standing[] {
  const ordered = [...standings].sort((a, b) => {
    for (const breaker of tieBreakers) {
      const result = compareBy(a, b, breaker)
      if (result !== 0) return result
    }
    return 0
  })

  return ordered.map((standing, index) => ({ ...standing, rank: index + 1 }))
}

function compareBy(a: Standing, b: Standing, breaker: TieBreaker): number {
  switch (breaker) {
    case 'score':
      return b.score - a.score
    case 'solves':
      return b.solves - a.solves
    case 'penalty':
      // Lower penalty is better (ACM), but a mode that uses penalty as a
      // tie-breaker always wants ascending.
      return a.penalty - b.penalty
    case 'lastEventAt': {
      // Earliest last event wins (the team that got there first).
      const left = a.lastEventAt ?? Number.POSITIVE_INFINITY
      const right = b.lastEventAt ?? Number.POSITIVE_INFINITY
      return left - right
    }
    case 'id':
      return a.id.localeCompare(b.id)
    default: {
      const exhaustive: never = breaker
      throw new Error(`Unknown tie-breaker: ${String(exhaustive)}`)
    }
  }
}

/** Sort events oldest-first so derivations are order-independent. */
export function sortEvents<T extends { at: number }>(events: T[]): T[] {
  return [...events].sort((a, b) => a.at - b.at)
}
