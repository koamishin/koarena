import type { GameModeEnum } from '@koarena/game'

import type { JsonValue } from '../../lib/json'

export type TournamentStatusValue =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'REGISTRATION'
  | 'LIVE'
  | 'PAUSED'
  | 'FINISHED'
  | 'CANCELLED'

export interface TournamentSummary {
  id: string
  slug: string
  name: string
  tagline: string | null
  gameMode: GameModeEnum
  gameModeLabel: string
  status: TournamentStatusValue
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
  startsAt: string
  endsAt: string
  teamCount: number
  participantCount: number
  maxTeams: number | null
  teamSizeMin: number
  teamSizeMax: number
}

export interface TournamentLanguage {
  id: string
  slug: string
  name: string
  difficultyWeight: number
}

export interface TournamentDetail extends TournamentSummary {
  description: string | null
  rules: string | null
  config: JsonValue
  languages: TournamentLanguage[]
  registrationClosesAt: string | null
  requireVerifiedEmail: boolean
  joinCode: string | null
  createdById: string
  isRegistered: boolean
  registeredTeamId: string | null
}

export interface AvailableLanguage {
  id: string
  slug: string
  name: string
  category: string
  difficultyWeight: number
}

export interface RegistrationTeam {
  id: string
  name: string
  memberCount: number
  role: string
}
