import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const bugHuntConfigSchema = z.object({
  basePoints: z.number().int().positive().default(1000),
  speedBonusPerMinute: z.number().int().nonnegative().default(20),
  partialCredit: z.boolean().default(false),
  roundDurationMinutes: z.number().int().positive().default(60),
})

export type BugHuntConfig = z.infer<typeof bugHuntConfigSchema>

export const bugHuntDefaultConfig: BugHuntConfig = bugHuntConfigSchema.parse({})

/**
 * Bug Hunt (Patch Race).
 *
 *   delta = basePoints + speedBonusPerMinute * minutesRemaining
 *
 * With `partialCredit`, points scale with the share of hidden tests that pass.
 */
export const bugHuntMode: GameMode<typeof bugHuntConfigSchema> = {
  id: 'bugHunt',
  label: 'Bug Hunt',
  schema: bugHuntConfigSchema,
  defaultConfig: bugHuntDefaultConfig,
  tieBreakers: ['score', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = bugHuntConfigSchema.parse(config)
    const ordered = sortEvents(events)
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'submission:accepted') continue

      const minutesRemaining = Math.max(
        0,
        Number(event.payload?.minutesRemaining ?? parsed.roundDurationMinutes),
      )
      const speedBonus = minutesRemaining * parsed.speedBonusPerMinute

      let factor = 1
      if (parsed.partialCredit) {
        const passed = Number(event.payload?.passedTests ?? 0)
        const total = Math.max(1, Number(event.payload?.totalTests ?? 1))
        factor = Math.min(1, passed / total)
      }

      const delta = Math.round((parsed.basePoints + speedBonus) * factor)

      drafts.push({
        type: 'SUBMISSION_ACCEPTED',
        points: parsed.basePoints + speedBonus,
        weight: factor,
        delta,
        refType: 'submission',
        refId: String(event.payload?.submissionId ?? ''),
        metadata: { minutesRemaining, speedBonus, factor },
      })
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, bugHuntMode.tieBreakers)
  },
}
