import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Runner, RunRequest, RunResult, RunStatus, Verdict } from './types'

/**
 * A runner that executes the program on this machine.
 *
 * It is a development convenience: it makes the submission pipeline work
 * without a Judge0 container, at the cost of running the submitted code with
 * the worker's own privileges. It is therefore **off unless
 * RUNNER_ALLOW_LOCAL_EXECUTION is set**, and it is not for production.
 */

interface LocalLanguage {
  command: string[]
  extension: string
}

/** Judge0 language ids this runner can execute locally. */
const LOCAL_LANGUAGES: Record<number, LocalLanguage> = {
  // Python (3.8.1)
  63: { command: ['python3'], extension: '.py' },
  // JavaScript (Node.js 12.14)
  60: { command: ['node'], extension: '.js' },
  // Bash (5.0.0)
  1: { command: ['bash'], extension: '.sh' },
}

export interface LocalRunnerOptions {
  /** How long a program may run before it is killed. */
  timeoutMs?: number
  /** How much output to keep. */
  maxOutputBytes?: number
}

export class LocalRunner implements Runner {
  readonly name = 'local'

  private readonly timeoutMs: number
  private readonly maxOutputBytes: number
  /** token -> the request it belongs to. */
  private readonly pending = new Map<string, RunRequest>()

  constructor(options: LocalRunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.maxOutputBytes = options.maxOutputBytes ?? 64 * 1024
  }

  async submit(request: RunRequest): Promise<{ token: string }> {
    const token = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.pending.set(token, request)
    return { token }
  }

  async status(token: string): Promise<RunStatus> {
    const request = this.pending.get(token)
    if (!request) {
      throw new Error(`Unknown local run: ${token}`)
    }
    this.pending.delete(token)

    const result = await this.execute(request)

    return { token, ...result }
  }

  private async execute(request: RunRequest): Promise<RunResult> {
    const language = LOCAL_LANGUAGES[request.languageId]
    if (!language) {
      return {
        verdict: 'INTERNAL_ERROR',
        stdout: '',
        stderr: '',
        compileOutput: '',
        message: `The local runner cannot execute language ${request.languageId}.`,
        timeMs: null,
        memoryKb: null,
        exitCode: null,
      }
    }

    const directory = await mkdtemp(join(tmpdir(), 'koarena-run-'))
    const file = join(directory, `main${language.extension}`)

    try {
      await writeFile(file, request.sourceCode, 'utf8')

      const started = Date.now()
      const outcome = await this.spawn(
        language.command,
        file,
        request.stdin ?? '',
      )
      const timeMs = Date.now() - started

      let verdict: Verdict = 'RUNTIME_ERROR'
      if (outcome.timedOut) {
        verdict = 'TIME_LIMIT_EXCEEDED'
      } else if (outcome.code === 0) {
        verdict = 'ACCEPTED'
      } else if (outcome.stderr.includes('SyntaxError')) {
        verdict = 'COMPILE_ERROR'
      }

      return {
        verdict,
        stdout: outcome.stdout.slice(0, this.maxOutputBytes),
        stderr: outcome.stderr.slice(0, this.maxOutputBytes),
        compileOutput:
          verdict === 'COMPILE_ERROR'
            ? outcome.stderr.slice(0, this.maxOutputBytes)
            : '',
        message: outcome.timedOut ? 'The program exceeded the time limit.' : '',
        timeMs,
        memoryKb: null,
        exitCode: outcome.code,
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }

  private spawn(
    command: string[],
    file: string,
    stdin: string,
  ): Promise<{
    stdout: string
    stderr: string
    code: number | null
    timedOut: boolean
  }> {
    return new Promise((resolve) => {
      const child = spawn(command[0]!, [...command.slice(1), file], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, this.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({
          stdout,
          stderr: `${stderr}${error.message}`,
          code: null,
          timedOut,
        })
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, code, timedOut })
      })

      if (stdin) child.stdin.write(stdin)
      child.stdin.end()
    })
  }
}
