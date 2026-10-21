import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const acmConfigSchema = z.object({
  problemPoints: z.number().int().positive().default(1),
  penaltyMinutes: z.number().int().nonnegative().default(20),
  /** ICPC rule: only wrong submissions before the first AC count. */
  penaltyAfterFirstWrong: z.boolean().default(false),
  wrongSubmissionCap: z.number().int().positive().default(3),
  testFeedback: z.enum(['none', 'per-test', 'full']).default('none'),
  freezeScoreboard: z.boolean().default(false),
})

export type AcmConfig = z.infer<typeof acmConfigSchema>

export const acmDefaultConfig: AcmConfig = acmConfigSchema.parse({})

/**
 * ACM / ICPC scoring.
 *
 * A team is ranked by problems solved, then by penalty time:
 *
 *   penalty = sum over solved problems of (penaltyMinutes * wrongBeforeFirstAc)
 *
 * A problem that is never solved contributes nothing, even if the team burned
 * attempts on it.
 */
export const acmMode: GameMode<typeof acmConfigSchema> = {
  id: 'acm',
  label: 'Algorithmic Contest',
  schema: acmConfigSchema,
  defaultConfig: acmDefaultConfig,
  tieBreakers: ['solves', 'penalty', 'lastEventAt', 'id'],

  deriveEvents({ config, events }) {
    const parsed = acmConfigSchema.parse(config)
    const ordered = sortEvents(events)

    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'problem:accepted') continue

      const problemId = String(event.payload?.problemId ?? '')
      const rawWrong = Number(event.payload?.wrongSubmissions ?? 0)
      const wrong = Math.max(0, Math.min(rawWrong, parsed.wrongSubmissionCap))
      const penalty = wrong * parsed.penaltyMinutes

      drafts.push({
        type: 'PROBLEM_SOLVED',
        points: parsed.problemPoints,
        weight: 1,
        delta: parsed.problemPoints,
        refType: 'problem',
        refId: problemId,
        metadata: { wrongSubmissions: wrong, penaltyMinutes: penalty },
      })

      if (penalty > 0) {
        drafts.push({
          type: 'SUBMISSION_PENALTY',
          points: penalty,
          weight: 1,
          delta: 0,
          refType: 'problem',
          refId: problemId,
          metadata: { penaltyMinutes: penalty },
        })
      }
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, acmMode.tieBreakers)
  },
}
