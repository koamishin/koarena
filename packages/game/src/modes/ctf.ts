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
  tieBreakers: ['score', 'solves', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = ctfConfigSchema.parse(config)
    const ordered = sortEvents(events)

    /** challengeId -> how many teams already solved it. */
    const solveCounts = new Map<string, number>()
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'challenge:solved') continue

      const challengeId = String(event.payload?.challengeId ?? '')
      const solvedBefore = solveCounts.get(challengeId) ?? 0

      const base = Math.max(
        parsed.minPoints,
        parsed.basePoints - parsed.decayPerSolve * solvedBefore,
      )
      const isFirstBlood = solvedBefore === 0
      const bonus = isFirstBlood ? parsed.firstBloodBonus : 0

      drafts.push({
        type: 'CHALLENGE_SOLVED',
        points: base,
        weight: 1,
        delta: base + bonus,
        refType: 'challenge',
        refId: challengeId,
        metadata: { solvedBefore, isFirstBlood },
      })

      solveCounts.set(challengeId, solvedBefore + 1)
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, ctfMode.tieBreakers)
  },
}

/** Recompute a team's CTF standing from its score events. */
export function ctfStanding(
  teamId: string,
  score: number,
  solves: number,
  lastEventAt: number | null,
): Standing {
  return { rank: 0, teamId, score, solves, penalty: 0, lastEventAt }
}
