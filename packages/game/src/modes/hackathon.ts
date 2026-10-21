import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const hackathonConfigSchema = z.object({
  rubric: z
    .array(
      z.object({
        name: z.string().min(1),
        weight: z.number().positive().default(1),
        maxScore: z.number().int().positive().default(10),
      }),
    )
    .default([]),
  minTeamSize: z.number().int().positive().default(1),
  maxSubmissions: z.number().int().positive().default(5),
  judgingMode: z.enum(['blind', 'open']).default('blind'),
  requireRepo: z.boolean().default(true),
  requireDemo: z.boolean().default(false),
  requireWriteup: z.boolean().default(false),
  /** The leaderboard scale. Scores are normalised onto it. */
  scale: z.number().int().positive().default(1000),
})

export type HackathonConfig = z.infer<typeof hackathonConfigSchema>

export const hackathonDefaultConfig: HackathonConfig =
  hackathonConfigSchema.parse({})

/**
 * Hackathon scoring.
 *
 * Judges score each criterion; the rubric weights are normalised so a rubric
 * totalling 100 points and one totalling 10 produce comparable numbers:
 *
 *   raw       = sum(criterionScore * criterion.weight)
 *   maxRaw    = sum(criterion.maxScore * criterion.weight)
 *   delta     = (raw / maxRaw) * scale
 */
export const hackathonMode: GameMode<typeof hackathonConfigSchema> = {
  id: 'hackathon',
  label: 'Hackathon',
  schema: hackathonConfigSchema,
  defaultConfig: hackathonDefaultConfig,
  tieBreakers: ['score', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = hackathonConfigSchema.parse(config)
    const ordered = sortEvents(events)

    const maxRaw = parsed.rubric.reduce(
      (sum, criterion) => sum + criterion.maxScore * criterion.weight,
      0,
    )

    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind !== 'project:scored') continue

      const raw = Number(event.payload?.rawScore ?? 0)
      // A rubric with no criteria yet cannot normalise — skip instead of
      // producing NaN.
      if (maxRaw <= 0) continue

      const normalised = Math.round((raw / maxRaw) * parsed.scale)
      const delta = Math.max(0, normalised)

      drafts.push({
        type: 'HACKATHON_SCORED',
        points: normalised,
        weight: 1,
        delta,
        refType: 'project',
        refId: String(event.payload?.projectId ?? ''),
        metadata: { rawScore: raw, maxRaw, scale: parsed.scale },
      })
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, hackathonMode.tieBreakers)
  },
}
