import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const knockoutConfigSchema = z.object({
  bracketType: z
    .enum(['single-elim', 'double-elim', 'round-robin'])
    .default('single-elim'),
  roundsPerMatch: z.number().int().positive().default(3),
  pointsPerRound: z.number().int().positive().default(100),
  consolationPoints: z.number().int().nonnegative().default(25),
})

export type KnockoutConfig = z.infer<typeof knockoutConfigSchema>

export const knockoutDefaultConfig: KnockoutConfig = knockoutConfigSchema.parse(
  {},
)

/**
 * Knockout (King of the Hill).
 *
 *   winner of a match = pointsPerRound * roundsWon
 *   loser of a match   = consolationPoints
 *
 * The losing side is identified from the event payload; the winner is not
 * inferred, because a round can be drawn.
 */
export const knockoutMode: GameMode<typeof knockoutConfigSchema> = {
  id: 'knockout',
  label: 'Knockout',
  schema: knockoutConfigSchema,
  defaultConfig: knockoutDefaultConfig,
  tieBreakers: ['score', 'solves', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = knockoutConfigSchema.parse(config)
    const ordered = sortEvents(events)
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'match:finished') continue

      const winnerId = String(event.payload?.winnerTeamId ?? '')
      const loserId = String(event.payload?.loserTeamId ?? '')
      const roundsWon = Number(event.payload?.roundsWon ?? 0)
      const matchId = String(event.payload?.matchId ?? '')

      if (winnerId) {
        const points = roundsWon * parsed.pointsPerRound
        drafts.push({
          type: 'BRACKET_WIN',
          points,
          weight: 1,
          delta: points,
          refType: 'match',
          refId: matchId,
          metadata: { roundsWon },
        })
      }

      if (loserId) {
        drafts.push({
          type: 'BRACKET_LOSS',
          points: parsed.consolationPoints,
          weight: 1,
          delta: parsed.consolationPoints,
          refType: 'match',
          refId: matchId,
        })
      }
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, knockoutMode.tieBreakers)
  },
}
