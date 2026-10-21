import type { GameModeEnum } from '@koarena/game'

export interface ConfigFieldSpec {
  key: string
  label: string
  hint?: string
  type: 'number' | 'boolean' | 'text'
  min?: number
  max?: number
  step?: number
}

/**
 * The form fields for each mode's scoring config.
 *
 * The values themselves come from the mode's schema defaults, so this file
 * only describes how to label and edit them — the engine stays the single
 * source of truth for what a valid config is.
 */
export const MODE_CONFIG_FIELDS: Record<GameModeEnum, ConfigFieldSpec[]> = {
  CTF: [
    {
      key: 'basePoints',
      label: 'Base points',
      type: 'number',
      min: 0,
      step: 25,
    },
    {
      key: 'minPoints',
      label: 'Floor',
      type: 'number',
      min: 0,
      step: 25,
      hint: 'The lowest a solve is ever worth.',
    },
    {
      key: 'decayPerSolve',
      label: 'Decay per solve',
      type: 'number',
      min: 0,
      step: 10,
      hint: 'Deducted for every team that solved it first.',
    },
    {
      key: 'firstBloodBonus',
      label: 'First blood bonus',
      type: 'number',
      min: 0,
      step: 25,
    },
    { key: 'hintsEnabled', label: 'Allow hints', type: 'boolean' },
    {
      key: 'hintPointCost',
      label: 'Hint point cost',
      type: 'number',
      min: 0,
      step: 10,
    },
  ],
  ATTACK_DEFENSE: [
    {
      key: 'attackPoints',
      label: 'Points per flag captured',
      type: 'number',
      min: 0,
      step: 10,
    },
    {
      key: 'patchPoints',
      label: 'Points per successful patch',
      type: 'number',
      min: 0,
      step: 10,
    },
    {
      key: 'serviceDownPoints',
      label: 'Penalty per failed check',
      type: 'number',
      min: 0,
      step: 5,
    },
    {
      key: 'checkIntervalSec',
      label: 'Check interval (seconds)',
      type: 'number',
      min: 5,
      step: 5,
    },
    {
      key: 'flagRotationSec',
      label: 'Flag rotation (seconds)',
      type: 'number',
      min: 30,
      step: 30,
    },
  ],
  HACKATHON: [
    {
      key: 'minTeamSize',
      label: 'Minimum team size',
      type: 'number',
      min: 1,
      step: 1,
    },
    {
      key: 'maxSubmissions',
      label: 'Revisions allowed',
      type: 'number',
      min: 1,
      step: 1,
    },
    {
      key: 'judgingMode',
      label: 'Judging mode',
      type: 'text',
      hint: 'blind or open',
    },
    {
      key: 'scale',
      label: 'Leaderboard scale',
      type: 'number',
      min: 100,
      step: 100,
    },
    { key: 'requireRepo', label: 'Require a repository link', type: 'boolean' },
    { key: 'requireDemo', label: 'Require a demo link', type: 'boolean' },
    { key: 'requireWriteup', label: 'Require a writeup', type: 'boolean' },
  ],
  ACM: [
    {
      key: 'problemPoints',
      label: 'Points per problem',
      type: 'number',
      min: 1,
      step: 1,
    },
    {
      key: 'penaltyMinutes',
      label: 'Penalty minutes per wrong attempt',
      type: 'number',
      min: 0,
      step: 5,
    },
    {
      key: 'wrongSubmissionCap',
      label: 'Wrong attempts counted',
      type: 'number',
      min: 1,
      step: 1,
    },
    {
      key: 'penaltyAfterFirstWrong',
      label: 'Penalty after the first wrong attempt',
      type: 'boolean',
    },
    {
      key: 'freezeScoreboard',
      label: 'Freeze the scoreboard',
      type: 'boolean',
    },
  ],
  POLYGLOT_BATTLE: [
    {
      key: 'basePoints',
      label: 'Base points',
      type: 'number',
      min: 1,
      step: 100,
    },
    { key: 'rounds', label: 'Rounds', type: 'number', min: 1, step: 1 },
    {
      key: 'banLanguagesPerRound',
      label: 'Languages banned per round',
      type: 'number',
      min: 0,
      step: 1,
    },
    { key: 'headToHead', label: 'Head to head rounds', type: 'boolean' },
    {
      key: 'roundPoints',
      label: 'Points per round won',
      type: 'number',
      min: 1,
      step: 25,
    },
    {
      key: 'consolationPoints',
      label: 'Consolation points',
      type: 'number',
      min: 0,
      step: 25,
    },
  ],
  CODE_GOLF: [
    {
      key: 'basePoints',
      label: 'Base points',
      type: 'number',
      min: 1,
      step: 100,
    },
    {
      key: 'bytesPenaltyPerByte',
      label: 'Points deducted per byte',
      type: 'number',
      min: 0,
      step: 1,
    },
    {
      key: 'minBytes',
      label: 'Minimum byte count',
      type: 'number',
      min: 1,
      step: 1,
    },
  ],
  BUG_HUNT: [
    {
      key: 'basePoints',
      label: 'Base points',
      type: 'number',
      min: 1,
      step: 100,
    },
    {
      key: 'speedBonusPerMinute',
      label: 'Speed bonus per minute left',
      type: 'number',
      min: 0,
      step: 5,
    },
    {
      key: 'partialCredit',
      label: 'Partial credit for partial passes',
      type: 'boolean',
    },
    {
      key: 'roundDurationMinutes',
      label: 'Round length (minutes)',
      type: 'number',
      min: 5,
      step: 5,
    },
  ],
  KNOCKOUT: [
    {
      key: 'roundsPerMatch',
      label: 'Rounds per match',
      type: 'number',
      min: 1,
      step: 1,
    },
    {
      key: 'pointsPerRound',
      label: 'Points per round won',
      type: 'number',
      min: 1,
      step: 25,
    },
    {
      key: 'consolationPoints',
      label: 'Consolation points',
      type: 'number',
      min: 0,
      step: 25,
    },
  ],
}

/** The rubric editor for hackathon mode, kept out of the generic field list. */
export const RUBRIC_FIELD: ConfigFieldSpec = {
  key: 'rubric',
  label: 'Rubric criteria',
  type: 'text',
  hint: 'One per line, as "name | weight | max score".',
}
