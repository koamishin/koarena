import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft, Standing } from '../types'

export const ctfConfigSchema = z.object({
  basePoints: z.number().int().nonnegative().default(500),
  minPoints: z.number().int().nonnegative().default(100),
  decayPerSolve: z.number().int().nonnegative().default(50),
  firstBloodBonus: z.number().int().nonnegative().default(25),
  hintsEnabled: z.boolean().default(true),
  hintPointCost: z.number().int().nonnegative().default(50),
  flagFormat: z.enum(['static', 'regex', 'case-insensitive']).default('static'),
  allowTeamSize: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .default([1, 5]),
})

export type CtfConfig = z.infer<typeof ctfConfigSchema>

export const ctfDefaultConfig: CtfConfig = ctfConfigSchema.parse({})

/**
 * CTF (Jeopardy) scoring.
 *
 * Points decay as more teams solve the same challenge:
 *
 *   points = max(minPoints, basePoints - decayPerSolve * solvesBefore)
 *
 * The first team to solve a challenge also earns a first-blood bonus.
 */
export const ctfMode: GameMode<typeof ctfConfigSchema> = {
  id: 'ctf',
  label: 'Capture The Flag',
  schema: ctfConfigSchema,
  defaultConfig: ctfDefaultConfig,
  tieBreakers: ['score', 'solves', 'lastEventAt', 'id'],

  deriveEvents({ config, events }) {
    const parsed = ctfConfigSchema.parse(config ?? {})
    const ordered = sortEvents(events)

    /** challengeId -> how many teams already solved it. */
    const solveCounts = new Map<string, number>()
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'challenge:solved') continue

      const challengeId = String(event.payload?.challengeId ?? '')
      const solvedBefore = solveCounts.get(challengeId) ?? 0

      const award = ctfSolveAward(
        config,
        {
          initialPoints: parsed.basePoints,
          minPoints: parsed.minPoints,
          decayPerSolve: parsed.decayPerSolve,
        },
        solvedBefore,
        solvedBefore === 0,
      )

      drafts.push({
        type: 'CHALLENGE_SOLVED',
        points: award.points,
        weight: 1,
        delta: award.delta,
        refType: 'challenge',
        refId: challengeId,
        metadata: {
          solvedBefore,
          isFirstBlood: solvedBefore === 0,
          bonus: award.bonus,
        },
      })

      solveCounts.set(challengeId, solvedBefore + 1)
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, ctfMode.tieBreakers)
  },
}

/**
 * The points a solve is worth right now.
 *
 * The same formula the derivation uses, exposed so the UI can show "currently
 * worth N" without duplicating the rule.
 */
export function ctfPointsAt(config: unknown, solveCount: number): number {
  const parsed = ctfConfigSchema.parse(config ?? {})
  return Math.max(
    parsed.minPoints,
    parsed.basePoints - parsed.decayPerSolve * solveCount,
  )
}

/**
 * The points rule a challenge carries.
 *
 * A challenge's own values win over the mode's defaults — an organizer can
 * make one challenge worth more than another.
 */
export interface CtfPointsRule {
  initialPoints: number
  minPoints: number
  decayPerSolve: number
}

/**
 * What one solve is worth, given how many teams solved it before.
 *
 * This is the single implementation of the rule: `deriveEvents` calls it, and
 * the live solve path calls it too, so the board, the card and the award can
 * never disagree.
 *
 * The points come from the challenge's own rule; the mode config only supplies
 * the first-blood bonus.
 */
export function ctfSolveAward(
  config: unknown,
  rule: CtfPointsRule,
  solveCountBefore: number,
  isFirstBlood: boolean,
): { points: number; bonus: number; delta: number } {
  const parsed = ctfConfigSchema.parse(config ?? {})
  const points = Math.max(
    rule.minPoints,
    rule.initialPoints - rule.decayPerSolve * solveCountBefore,
  )
  const bonus = isFirstBlood ? parsed.firstBloodBonus : 0
  return { points, bonus, delta: points + bonus }
}

/** Recompute a team's CTF standing from its score events. */
export function ctfStanding(
  id: string,
  score: number,
  solves: number,
  lastEventAt: number | null,
): Standing {
  return { rank: 0, id, score, solves, penalty: 0, lastEventAt }
}
