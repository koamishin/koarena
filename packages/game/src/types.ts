import type { z } from 'zod'

export const GAME_MODE_IDS = [
  'ctf',
  'attackDefense',
  'hackathon',
  'acm',
  'polyglot',
  'golf',
  'bugHunt',
  'knockout',
] as const

export type GameModeId = (typeof GAME_MODE_IDS)[number]

export const SCORE_EVENT_TYPES = [
  'FLAG_CAPTURE',
  'CHALLENGE_SOLVED',
  'PROBLEM_SOLVED',
  'SUBMISSION_ACCEPTED',
  'SUBMISSION_PENALTY',
  'HACKATHON_SCORED',
  'ATTACK_CAPTURED',
  'SERVICE_PATCHED',
  'SERVICE_DOWN',
  'SERVICE_KILLED',
  'BRACKET_WIN',
  'BRACKET_LOSS',
  'BRACKET_ADVANCE',
  'BONUS',
  'PENALTY',
  'MANUAL_ADJUSTMENT',
] as const

export type ScoreEventType = (typeof SCORE_EVENT_TYPES)[number]

/**
 * A score event before it reaches the database.
 *
 * `points` is the base value of whatever was scored, `weight` is the multiplier
 * (language handicap, rubric weight), and `delta` is the signed change applied
 * to the team's total. Nothing else in the system writes a score.
 */
export interface ScoreEventDraft {
  type: ScoreEventType
  points: number
  weight: number
  delta: number
  refType?: string
  refId?: string
  metadata?: Record<string, unknown>
}

/** A raw domain event fed into a mode. */
export interface GameEventInput {
  /** e.g. `challenge:solved`, `submission:accepted`, `project:scored`. */
  kind: string
  teamId: string
  /** Epoch milliseconds. */
  at: number
  payload?: Record<string, unknown>
}

/** One row of a leaderboard. */
export interface Standing {
  rank: number
  /**
   * The participant's stable identity: a team id, or a user id when the
   * participant is playing solo. Two solo players are two standings.
   */
  id: string
  score: number
  solves: number
  penalty: number
  /** Epoch ms of the team's most recent scoring event, used as a tie-breaker. */
  lastEventAt: number | null
}

export type TieBreaker = 'score' | 'solves' | 'penalty' | 'lastEventAt' | 'id'

export interface DeriveInput {
  /** The mode's validated config. */
  config: unknown
  events: GameEventInput[]
}

export interface RankInput {
  config: unknown
  events: GameEventInput[]
  standings: Standing[]
}

export interface GameMode<TSchema extends z.ZodType = z.ZodType> {
  readonly id: GameModeId
  readonly label: string
  readonly schema: TSchema
  /** The config a new tournament of this mode starts with. */
  readonly defaultConfig: z.infer<TSchema>
  /** Turn domain events into score events. Pure and deterministic. */
  deriveEvents(input: DeriveInput): ScoreEventDraft[]
  /** Rank the teams. Pure and deterministic. */
  rank(input: RankInput): Standing[]
  /** Tie-breakers, applied in order. */
  readonly tieBreakers: readonly TieBreaker[]
}
