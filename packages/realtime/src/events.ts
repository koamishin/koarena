/**
 * The live event contract.
 *
 * Every realtime message is one of these. The transport (SSE today, WebSocket
 * if it is ever needed) is not part of the contract — a client only depends on
 * `type` and `payload`.
 */
export interface LiveEventBase {
  /** Monotonic id per tournament, so a client can resume with Last-Event-ID. */
  id: number
  /** Epoch milliseconds. */
  at: number
}

export interface ScoreUpdateEvent extends LiveEventBase {
  type: 'score:update'
  payload: {
    teamId: string | null
    teamName: string | null
    score: number
    rank: number
    delta: number
    reason: string
  }
}

export interface ScoreboardEvent extends LiveEventBase {
  type: 'scoreboard:full'
  payload: {
    standings: Array<{
      rank: number
      teamId: string | null
      teamName: string | null
      score: number
      solves: number
      penalty: number
    }>
  }
}

export interface ChallengeSolvedEvent extends LiveEventBase {
  type: 'challenge:solved'
  payload: {
    challengeId: string
    challengeTitle: string
    teamName: string | null
    points: number
    firstBlood: boolean
  }
}

export interface AnnouncementEvent extends LiveEventBase {
  type: 'announce'
  payload: {
    title: string
    body: string
    authorName: string | null
  }
}

export interface ChatMessageEvent extends LiveEventBase {
  type: 'chat:message'
  payload: {
    channel: string
    userId: string
    userName: string | null
    body: string
  }
}

export interface JudgeProgressEvent extends LiveEventBase {
  type: 'judge:progress'
  payload: {
    submissionId: string
    status: string
  }
}

export type LiveEvent =
  | ScoreUpdateEvent
  | ScoreboardEvent
  | ChallengeSolvedEvent
  | AnnouncementEvent
  | ChatMessageEvent
  | JudgeProgressEvent

export type LiveEventType = LiveEvent['type']

/** The channel prefix a tournament's events travel on. */
export function liveChannel(tournamentId: string): string {
  return `live:${tournamentId}`
}
