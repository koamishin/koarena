import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const golfConfigSchema = z.object({
  basePoints: z.number().int().positive().default(1000),
  bytesPenaltyPerByte: z.number().int().nonnegative().default(1),
  minBytes: z.number().int().nonnegative().default(1),
  tieBreaker: z
    .enum(['first-submitted', 'fewest-warnings'])
    .default('first-submitted'),
})

export type GolfConfig = z.infer<typeof golfConfigSchema>

export const golfDefaultConfig: GolfConfig = golfConfigSchema.parse({})

/**
 * Golf Royale (code golf).
 *
 *   delta = max(0, basePoints - bytes * bytesPenaltyPerByte)
 *
 * `bytes` is measured after stripping comments and trailing whitespace, using
 * one shared normaliser so every client and the server agree.
 */
export const golfMode: GameMode<typeof golfConfigSchema> = {
  id: 'golf',
  label: 'Golf Royale',
  schema: golfConfigSchema,
  defaultConfig: golfDefaultConfig,
  tieBreakers: ['score', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = golfConfigSchema.parse(config)
    const ordered = sortEvents(events)
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'submission:accepted') continue

      const bytes = Math.max(parsed.minBytes, Number(event.payload?.bytes ?? 0))
      const delta = Math.max(
        0,
        parsed.basePoints - bytes * parsed.bytesPenaltyPerByte,
      )

      drafts.push({
        type: 'SUBMISSION_ACCEPTED',
        points: parsed.basePoints,
        weight: 1,
        delta,
        refType: 'submission',
        refId: String(event.payload?.submissionId ?? ''),
        metadata: { bytes },
      })
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, golfMode.tieBreakers)
  },
}
