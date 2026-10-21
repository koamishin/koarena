import type {
  Runner,
  RunnerLanguage,
  RunRequest,
  RunResult,
  RunStatus,
  Verdict,
} from './types'

/**
 * The Judge0 client.
 *
 * Judge0 is a self-hosted code execution service: it runs untrusted programs
 * in isolated containers. Everything is base64 encoded in both directions —
 * a program's output can contain bytes that are not valid UTF-8.
 */

export interface Judge0Options {
  /** The base URL of the Judge0 API, e.g. `http://judge0:2357`. */
  baseUrl: string
  /** Sent as `X-Auth-Token`. Judge0 ignores it when auth is off. */
  apiKey?: string
  /** How long to wait for a single request. */
  timeoutMs?: number
}

interface Judge0Submission {
  source_code?: string
  language_id?: number
  stdin?: string
  expected_output?: string
  cpu_time_limit?: number
  memory_limit?: number
  max_file_size?: number
}

interface Judge0Result {
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  message?: string | null
  exit_code?: number | null
  time?: string | null
  memory?: number | null
  status?: { id: number; description: string }
  token?: string
}

/** Judge0's status ids, mapped onto our verdicts. */
const STATUS_BY_ID: Record<number, Verdict> = {
  1: 'QUEUED',
  2: 'PROCESSING',
  3: 'ACCEPTED',
  4: 'WRONG_ANSWER',
  5: 'TIME_LIMIT_EXCEEDED',
  6: 'COMPILE_ERROR',
  7: 'RUNTIME_ERROR',
  8: 'RUNTIME_ERROR',
  9: 'RUNTIME_ERROR',
  10: 'RUNTIME_ERROR',
  11: 'RUNTIME_ERROR',
  12: 'RUNTIME_ERROR',
  13: 'INTERNAL_ERROR',
  14: 'RUNTIME_ERROR',
}

export function judge0Verdict(statusId: number, description?: string): Verdict {
  const known = STATUS_BY_ID[statusId]
  if (known) return known
  // An unknown status means Judge0 grew a new one; treat it as an internal
  // error rather than pretending it passed.
  void description
  return 'INTERNAL_ERROR'
}

function encode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return Buffer.from(value, 'utf8').toString('base64')
}

function decode(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

export class Judge0Runner implements Runner {
  readonly name = 'judge0'

  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly timeoutMs: number

  constructor(options: Judge0Options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.timeoutMs = options.timeoutMs ?? 15_000
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'X-Auth-Token': this.apiKey } : {}),
    }
  }

  async listLanguages(): Promise<RunnerLanguage[]> {
    const response = await fetch(`${this.baseUrl}/languages`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Judge0 /languages failed with ${response.status}`)
    }

    return (await response.json()) as RunnerLanguage[]
  }

  async submit(request: RunRequest): Promise<{ token: string }> {
    const body: Judge0Submission = {
      source_code: encode(request.sourceCode),
      language_id: request.languageId,
      stdin: encode(request.stdin ?? ''),
      cpu_time_limit: request.cpuTimeLimitSec ?? 2,
      memory_limit: request.memoryLimitKb ?? 262_144,
      max_file_size: request.maxOutputBytes ?? 1_024,
    }

    if (request.expectedOutput !== undefined) {
      body.expected_output = encode(request.expectedOutput)
    }

    const response = await fetch(
      `${this.baseUrl}/submissions?base64_encoded=true&wait=false`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Judge0 rejected the submission (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      )
    }

    const result = (await response.json()) as { token: string }
    return { token: result.token }
  }

  async status(token: string): Promise<RunStatus> {
    const response = await fetch(
      `${this.baseUrl}/submissions/${token}?base64_encoded=true&fields=*`,
      {
        headers: this.headers(),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    )

    if (!response.ok) {
      throw new Error(
        `Judge0 /submissions/${token} failed with ${response.status}`,
      )
    }

    const result = (await response.json()) as Judge0Result
    const statusId = result.status?.id ?? 1

    return {
      token,
      verdict: judge0Verdict(statusId, result.status?.description),
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
      compileOutput: decode(result.compile_output),
      message: result.message ?? '',
      timeMs: result.time ? Math.round(Number(result.time) * 1000) : null,
      memoryKb: result.memory ?? null,
      exitCode: result.exit_code ?? null,
    }
  }
}

export function toRunResult(status: RunStatus): RunResult {
  const { token: _token, ...result } = status
  return result
}
