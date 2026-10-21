/**
 * The runner contract.
 *
 * A runner takes source code and runs it. The app never talks to Judge0
 * directly — it enqueues a job and the worker asks a runner. That keeps the
 * sandbox details on the worker host, where they belong.
 */

export type Verdict =
  | 'QUEUED'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'

export const TERMINAL_VERDICTS: Verdict[] = [
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'MEMORY_LIMIT_EXCEEDED',
  'INTERNAL_ERROR',
]

export function isTerminal(verdict: Verdict): boolean {
  return TERMINAL_VERDICTS.includes(verdict)
}

export interface RunRequest {
  sourceCode: string
  /** The Judge0 language id, from the `languages` table. */
  languageId: number
  stdin?: string
  expectedOutput?: string
  cpuTimeLimitSec?: number
  memoryLimitKb?: number
  /** How much stdout to keep before truncating. */
  maxOutputBytes?: number
}

export interface RunResult {
  verdict: Verdict
  stdout: string
  stderr: string
  compileOutput: string
  message: string
  /** The program's run time. */
  timeMs: number | null
  memoryKb: number | null
  exitCode: number | null
}

export interface RunStatus extends RunResult {
  token: string
}

export interface Runner {
  readonly name: string
  /** Hand a program to the sandbox and get a token back. */
  submit(request: RunRequest): Promise<{ token: string }>
  /** Ask the sandbox how the program is doing. */
  status(token: string): Promise<RunStatus>
}

export interface RunnerLanguage {
  id: number
  name: string
}

/** Normalise the output a program produced for comparison. */
export function normaliseOutput(value: string): string {
  // Judges compare line by line and ignore trailing whitespace.
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normaliseOutput(actual) === normaliseOutput(expected)
}
