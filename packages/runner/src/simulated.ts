import type { Runner, RunRequest, RunResult, RunStatus, Verdict } from './types'

/**
 * A runner that does not run anything.
 *
 * It exists so the whole pipeline — queue, worker, verdict, penalty, scoreboard
 * — can be exercised without a sandbox. The verdict is decided by a marker in
 * the source, which is a documented development convention:
 *
 *   /* verdict:wrong-answer *\/
 *   /* verdict:time-limit *\/
 *   /* verdict:compile-error *\/
 *   /* verdict:runtime-error *\/
 *
 * Without a marker the program is accepted.
 */
export class SimulatedRunner implements Runner {
  readonly name = 'simulated'

  /**
   * The request behind each token.
   *
   * The source is kept here rather than encoded into the token: a token has to
   * stay short, and a truncated source would hide the verdict marker.
   */
  private readonly pending = new Map<string, RunRequest>()

  async submit(request: RunRequest): Promise<{ token: string }> {
    const token = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.pending.set(token, request)
    return { token }
  }

  async status(token: string): Promise<RunStatus> {
    const request = this.pending.get(token)
    this.pending.delete(token)

    const sourceCode = request?.sourceCode ?? ''

    const verdict = verdictFromMarkers(sourceCode)

    return {
      token,
      verdict,
      stdout: verdict === 'ACCEPTED' ? 'simulated output\n' : '',
      stderr: '',
      compileOutput:
        verdict === 'COMPILE_ERROR' ? 'simulated compile error\n' : '',
      message: '',
      timeMs: 12,
      memoryKb: 2048,
      exitCode: verdict === 'ACCEPTED' ? 0 : 1,
    }
  }
}

/** Read the verdict marker out of a source file. */
export function verdictFromMarkers(sourceCode: string): Verdict {
  const markers: Record<string, Verdict> = {
    'wrong-answer': 'WRONG_ANSWER',
    'time-limit': 'TIME_LIMIT_EXCEEDED',
    'compile-error': 'COMPILE_ERROR',
    'runtime-error': 'RUNTIME_ERROR',
    'memory-limit': 'MEMORY_LIMIT_EXCEEDED',
  }

  for (const [marker, verdict] of Object.entries(markers)) {
    if (sourceCode.includes(`verdict:${marker}`)) return verdict
  }

  return 'ACCEPTED'
}

/** A runner that returns one fixed verdict — used by tests. */
export class FixedRunner implements Runner {
  readonly name = 'fixed'

  constructor(private readonly result: RunResult) {}

  async submit(): Promise<{ token: string }> {
    return { token: `fixed_${Date.now()}` }
  }

  async status(token: string): Promise<RunStatus> {
    return { token, ...this.result }
  }
}
