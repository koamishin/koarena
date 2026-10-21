import { type Judge0Options, Judge0Runner } from './judge0'
import { LocalRunner } from './local'
import { SimulatedRunner } from './simulated'
import type { Runner } from './types'

export { Judge0Runner, judge0Verdict } from './judge0'
export { LocalRunner } from './local'
export { FixedRunner, SimulatedRunner, verdictFromMarkers } from './simulated'
export * from './types'

export type RunnerMode = 'judge0' | 'local' | 'simulated'

export interface RunnerEnvironment {
  RUNNER_MODE?: string
  JUDGE0_URL?: string
  JUDGE0_API_KEY?: string
  RUNNER_ALLOW_LOCAL_EXECUTION?: string
}

/**
 * Pick a runner from the environment.
 *
 * `simulated` is the default so a fresh clone can exercise the whole
 * submission pipeline without a sandbox. `judge0` is what production uses.
 * `local` really executes the program on this machine and refuses to start
 * unless `RUNNER_ALLOW_LOCAL_EXECUTION` is set.
 */
export function createRunner(env: RunnerEnvironment = process.env): Runner {
  const mode = (env.RUNNER_MODE ?? 'simulated') as RunnerMode

  switch (mode) {
    case 'judge0': {
      const options: Judge0Options = {
        baseUrl: env.JUDGE0_URL ?? 'http://localhost:2357',
        apiKey: env.JUDGE0_API_KEY,
      }
      return new Judge0Runner(options)
    }

    case 'local': {
      if (env.RUNNER_ALLOW_LOCAL_EXECUTION !== 'true') {
        throw new Error(
          "The local runner executes submitted code with this process's privileges. Set RUNNER_ALLOW_LOCAL_EXECUTION=true to use it, and never in production.",
        )
      }
      return new LocalRunner()
    }

    case 'simulated':
      return new SimulatedRunner()

    default:
      throw new Error(
        `Unknown RUNNER_MODE "${mode}". Use one of: judge0, local, simulated.`,
      )
  }
}
