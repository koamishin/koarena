import type { z } from 'zod'
import { acmConfigSchema, acmDefaultConfig, acmMode } from './modes/acm'
import {
  attackDefenseConfigSchema,
  attackDefenseDefaultConfig,
  attackDefenseMode,
} from './modes/attackDefense'
import {
  bugHuntConfigSchema,
  bugHuntDefaultConfig,
  bugHuntMode,
} from './modes/bugHunt'
import { ctfConfigSchema, ctfDefaultConfig, ctfMode } from './modes/ctf'
import { golfConfigSchema, golfDefaultConfig, golfMode } from './modes/golf'
import {
  hackathonConfigSchema,
  hackathonDefaultConfig,
  hackathonMode,
} from './modes/hackathon'
import {
  knockoutConfigSchema,
  knockoutDefaultConfig,
  knockoutMode,
} from './modes/knockout'
import {
  polyglotConfigSchema,
  polyglotDefaultConfig,
  polyglotMode,
} from './modes/polyglot'
import { rankStandings, sortEvents } from './rank'
import type {
  GameEventInput,
  GameMode,
  GameModeId,
  ScoreEventDraft,
  Standing,
} from './types'

/** A mode with its config schema erased — the shape the registry holds. */
export type AnyGameMode = GameMode<z.ZodType>

export const modes = {
  ctf: ctfMode,
  attackDefense: attackDefenseMode,
  hackathon: hackathonMode,
  acm: acmMode,
  polyglot: polyglotMode,
  golf: golfMode,
  bugHunt: bugHuntMode,
  knockout: knockoutMode,
} as const satisfies Record<GameModeId, AnyGameMode>

export function getMode(id: GameModeId): AnyGameMode {
  const mode = modes[id]
  if (!mode) throw new Error(`Unknown game mode: ${id}`)
  return mode
}

/**
 * Validate a mode's config against its schema, filling in the mode's defaults
 * for anything the organizer left out.
 */
export function parseConfig(id: GameModeId, config: unknown): unknown {
  return getMode(id).schema.parse(config ?? {})
}

/** Derive the score events for a set of domain events under a mode. */
export function deriveEvents(
  id: GameModeId,
  config: unknown,
  events: GameEventInput[],
): ScoreEventDraft[] {
  return getMode(id).deriveEvents({
    config: parseConfig(id, config),
    events: sortEvents(events),
  })
}

/** Rank a set of standings under a mode. */
export function rank(id: GameModeId, standings: Standing[]): Standing[] {
  return getMode(id).rank({ config: {}, events: [], standings })
}

export type { AcmConfig } from './modes/acm'
export type { AttackDefenseConfig } from './modes/attackDefense'
export type { BugHuntConfig } from './modes/bugHunt'
export type { CtfConfig } from './modes/ctf'
export type { GolfConfig } from './modes/golf'
export type { HackathonConfig } from './modes/hackathon'
export type { KnockoutConfig } from './modes/knockout'
export type { PolyglotConfig } from './modes/polyglot'

/**
 * The database enum value for each mode.
 *
 * The enum values match Prisma's `GameMode` enum, so the mapping lives here
 * rather than in the app: the engine is the only place that knows what a mode
 * is called.
 */
export const GAME_MODE_IDS_BY_ENUM = {
  CTF: 'ctf',
  ATTACK_DEFENSE: 'attackDefense',
  HACKATHON: 'hackathon',
  ACM: 'acm',
  POLYGLOT_BATTLE: 'polyglot',
  CODE_GOLF: 'golf',
  BUG_HUNT: 'bugHunt',
  KNOCKOUT: 'knockout',
} as const satisfies Record<string, GameModeId>

export type GameModeEnum = keyof typeof GAME_MODE_IDS_BY_ENUM

export function toGameModeId(enumValue: string): GameModeId {
  const id = GAME_MODE_IDS_BY_ENUM[enumValue as GameModeEnum]
  if (!id) throw new Error(`Unknown game mode: ${enumValue}`)
  return id
}

/** Every mode, with the label and the config an organizer starts from. */
export function listModes(): Array<{
  id: GameModeId
  enum: GameModeEnum
  label: string
  defaultConfig: unknown
}> {
  return Object.entries(GAME_MODE_IDS_BY_ENUM).map(([enumValue, id]) => ({
    id,
    enum: enumValue as GameModeEnum,
    label: getMode(id).label,
    defaultConfig: getMode(id).defaultConfig,
  }))
}

export { ctfPointsAt, ctfSolveAward } from './modes/ctf'
export * from './types'
export {
  acmConfigSchema,
  acmDefaultConfig,
  attackDefenseConfigSchema,
  attackDefenseDefaultConfig,
  bugHuntConfigSchema,
  bugHuntDefaultConfig,
  ctfConfigSchema,
  ctfDefaultConfig,
  golfConfigSchema,
  golfDefaultConfig,
  hackathonConfigSchema,
  hackathonDefaultConfig,
  knockoutConfigSchema,
  knockoutDefaultConfig,
  polyglotConfigSchema,
  polyglotDefaultConfig,
  rankStandings,
  sortEvents,
}
