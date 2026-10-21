import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const polyglotConfigSchema = z.object({
  basePoints: z.number().int().positive().default(1000),
  /** language slug -> difficulty weight. Lower weight = harder language. */
  languageWeights: z.record(z.string(), z.number().positive()).default({}),
  rounds: z.number().int().positive().default(1),
  banLanguagesPerRound: z.number().int().nonnegative().default(0),
  headToHead: z.boolean().default(false),
  roundPoints: z.number().int().positive().default(100),
  consolationPoints: z.number().int().nonnegative().default(25),
})

export type PolyglotConfig = z.infer<typeof polyglotConfigSchema>

export const polyglotDefaultConfig: PolyglotConfig = polyglotConfigSchema.parse(
  {},
)

/**
 * Polyglot Battle (Language Arena).
 *
 * Every team gets the same problem and picks its language. Languages differ in
 * difficulty, so points are normalised:
 *
 *   delta = round(basePoints / language.weight)
 *
 * A Rust solution (weight 0.6) is worth more than a Python one (weight 1.0).
 */
export const polyglotMode: GameMode<typeof polyglotConfigSchema> = {
  id: 'polyglot',
  label: 'Polyglot Battle',
  schema: polyglotConfigSchema,
  defaultConfig: polyglotDefaultConfig,
  tieBreakers: ['score', 'lastEventAt', 'id'],

  deriveEvents({ config, events }) {
    const parsed = polyglotConfigSchema.parse(config)
    const ordered = sortEvents(events)
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'submission:accepted') continue

      const language = String(event.payload?.language ?? '')
      const weight = parsed.languageWeights[language] ?? 1
      const delta = Math.round(parsed.basePoints / weight)

      drafts.push({
        type: 'SUBMISSION_ACCEPTED',
        points: parsed.basePoints,
        weight,
        delta,
        refType: 'submission',
        refId: String(event.payload?.submissionId ?? ''),
        metadata: { language, weight },
      })
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, polyglotMode.tieBreakers)
  },
}
