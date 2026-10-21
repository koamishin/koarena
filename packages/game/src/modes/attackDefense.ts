import { z } from 'zod'
import { rankStandings, sortEvents } from '../rank'
import type { GameMode, ScoreEventDraft } from '../types'

export const attackDefenseConfigSchema = z.object({
  attackPoints: z.number().int().nonnegative().default(100),
  patchPoints: z.number().int().nonnegative().default(50),
  serviceDownPoints: z.number().int().nonnegative().default(10),
  checkIntervalSec: z.number().int().positive().default(30),
  flagRotationSec: z.number().int().positive().default(300),
})

export type AttackDefenseConfig = z.infer<typeof attackDefenseConfigSchema>

export const attackDefenseDefaultConfig: AttackDefenseConfig =
  attackDefenseConfigSchema.parse({})

/**
 * Attack & Defense scoring.
 *
 *   flag captured on a rival's service  ->  +attackPoints
 *   own service survived a bot check     ->  +patchPoints
 *   own service failed a bot check       ->  -serviceDownPoints
 */
export const attackDefenseMode: GameMode<typeof attackDefenseConfigSchema> = {
  id: 'attackDefense',
  label: 'Attack & Defense',
  schema: attackDefenseConfigSchema,
  defaultConfig: attackDefenseDefaultConfig,
  tieBreakers: ['score', 'solves', 'lastEventAt', 'teamId'],

  deriveEvents({ config, events }) {
    const parsed = attackDefenseConfigSchema.parse(config)
    const ordered = sortEvents(events)
    const drafts: ScoreEventDraft[] = []

    for (const event of ordered) {
      if (event.kind === 'attack:captured') {
        const points = Number(event.payload?.points ?? parsed.attackPoints)
        drafts.push({
          type: 'ATTACK_CAPTURED',
          points,
          weight: 1,
          delta: points,
          refType: 'service',
          refId: String(event.payload?.serviceId ?? ''),
          metadata: { defenderTeamId: event.payload?.defenderTeamId ?? null },
        })
        continue
      }

      if (event.kind === 'service:patched') {
        const points = Number(event.payload?.points ?? parsed.patchPoints)
        drafts.push({
          type: 'SERVICE_PATCHED',
          points,
          weight: 1,
          delta: points,
          refType: 'service',
          refId: String(event.payload?.serviceId ?? ''),
        })
        continue
      }

      if (event.kind === 'service:down') {
        const points = parsed.serviceDownPoints
        drafts.push({
          type: 'SERVICE_DOWN',
          points,
          weight: 1,
          delta: -points,
          refType: 'service',
          refId: String(event.payload?.serviceId ?? ''),
        })
      }
    }

    return drafts
  },

  rank({ standings }) {
    return rankStandings(standings, attackDefenseMode.tieBreakers)
  },
}
