import { afterEach, describe, expect, it, vi } from 'vitest'

import { Judge0Runner, judge0Verdict } from './judge0'
import { verdictFromMarkers } from './simulated'
import { normaliseOutput, outputsMatch } from './types'

describe('judge0 verdicts', () => {
  it('maps the status ids', () => {
    expect(judge0Verdict(1)).toBe('QUEUED')
    expect(judge0Verdict(2)).toBe('PROCESSING')
    expect(judge0Verdict(3)).toBe('ACCEPTED')
    expect(judge0Verdict(4)).toBe('WRONG_ANSWER')
    expect(judge0Verdict(5)).toBe('TIME_LIMIT_EXCEEDED')
    expect(judge0Verdict(6)).toBe('COMPILE_ERROR')
    expect(judge0Verdict(13)).toBe('INTERNAL_ERROR')
  })

  it('treats an unknown status as an internal error', () => {
    expect(judge0Verdict(99)).toBe('INTERNAL_ERROR')
  })
})

describe('the simulated runner', () => {
  it('accepts a program with no marker', () => {
    expect(verdictFromMarkers('print("hello")')).toBe('ACCEPTED')
  })

  it('reads the verdict markers', () => {
    expect(verdictFromMarkers('/* verdict:wrong-answer */')).toBe(
      'WRONG_ANSWER',
    )
    expect(verdictFromMarkers('/* verdict:time-limit */')).toBe(
      'TIME_LIMIT_EXCEEDED',
    )
    expect(verdictFromMarkers('// verdict:compile-error')).toBe('COMPILE_ERROR')
  })
})

describe('output comparison', () => {
  it('ignores trailing whitespace and line endings', () => {
    expect(outputsMatch('hello\n', 'hello')).toBe(true)
    expect(outputsMatch('hello  \r\n', 'hello')).toBe(true)
  })

  it('sees a real difference', () => {
    expect(outputsMatch('hello\n', 'goodbye')).toBe(false)
  })

  it('normalises line endings', () => {
    expect(normaliseOutput('a\r\nb')).toBe('a\nb')
  })
})

describe('the judge0 client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('base64-encodes the program on the way out', async () => {
    let body: Record<string, unknown> = {}

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body))
        return new Response(JSON.stringify({ token: 'tok-1' }), { status: 201 })
      }),
    )

    const runner = new Judge0Runner({ baseUrl: 'http://judge0:2357' })
    const { token } = await runner.submit({
      sourceCode: 'print("hi")',
      languageId: 63,
      stdin: '3\n',
    })

    expect(token).toBe('tok-1')
    expect(body.source_code).toBe(
      Buffer.from('print("hi")', 'utf8').toString('base64'),
    )
    expect(body.stdin).toBe(Buffer.from('3\n', 'utf8').toString('base64'))
    expect(body.language_id).toBe(63)
  })

  it('sends the api key as a header when one is set', async () => {
    let headers: HeadersInit | undefined

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        headers = init.headers
        return new Response(JSON.stringify({ token: 'tok-2' }), { status: 201 })
      }),
    )

    const runner = new Judge0Runner({
      baseUrl: 'http://judge0:2357',
      apiKey: 'secret',
    })
    await runner.submit({ sourceCode: 'x', languageId: 63 })

    expect(headers).toMatchObject({ 'X-Auth-Token': 'secret' })
  })

  it('decodes the result and maps the verdict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              stdout: Buffer.from('42\n', 'utf8').toString('base64'),
              stderr: null,
              compile_output: null,
              message: null,
              exit_code: 0,
              time: '0.031',
              memory: 4096,
              status: { id: 3, description: 'Accepted' },
              token: 'tok-3',
            }),
            { status: 200 },
          ),
      ),
    )

    const runner = new Judge0Runner({ baseUrl: 'http://judge0:2357' })
    const status = await runner.status('tok-3')

    expect(status.verdict).toBe('ACCEPTED')
    expect(status.stdout).toBe('42\n')
    expect(status.timeMs).toBe(31)
    expect(status.memoryKb).toBe(4096)
  })

  it('reports a rejected submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 400 })),
    )

    const runner = new Judge0Runner({ baseUrl: 'http://judge0:2357' })

    await expect(
      runner.submit({ sourceCode: 'x', languageId: 63 }),
    ).rejects.toThrow(/rejected the submission/)
  })
})
