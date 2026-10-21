import { describe, expect, it } from 'vitest'
import {
  decryptFlag,
  encryptFlag,
  flagsMatch,
  hashAttempt,
  normaliseFlag,
  readFlagKey,
} from '../src/index'

const key = readFlagKey(Buffer.alloc(32, 7).toString('base64'))

describe('flag encryption', () => {
  it('round-trips a flag', () => {
    const encrypted = encryptFlag('koarena{not-so-secret}', key)
    expect(decryptFlag(encrypted, key)).toBe('koarena{not-so-secret}')
  })

  it('never stores the plaintext', () => {
    const encrypted = encryptFlag('koarena{not-so-secret}', key)
    const serialised = JSON.stringify(encrypted)
    expect(serialised).not.toContain('not-so-secret')
    expect(
      Buffer.from(encrypted.value, 'base64').toString('utf8'),
    ).not.toContain('not-so-secret')
  })

  it('uses a fresh IV every time', () => {
    const a = encryptFlag('same', key)
    const b = encryptFlag('same', key)
    expect(a.iv).not.toBe(b.iv)
    expect(a.value).not.toBe(b.value)
  })

  it('rejects a tampered ciphertext', () => {
    const encrypted = encryptFlag('koarena{flag}', key)
    const tampered = {
      ...encrypted,
      value: Buffer.from('koarena{flgg}', 'utf8').toString('base64'),
    }
    expect(() => decryptFlag(tampered, key)).toThrow()
  })

  it('rejects a key of the wrong length', () => {
    expect(() => readFlagKey(Buffer.alloc(16, 1).toString('base64'))).toThrow(
      /32 bytes/,
    )
    expect(() => readFlagKey('')).toThrow(/not set/)
  })
})

describe('flag comparison', () => {
  it('matches identical flags', () => {
    expect(flagsMatch('koarena{x}', 'koarena{x}')).toBe(true)
  })

  it('rejects different flags', () => {
    expect(flagsMatch('koarena{x}', 'koarena{y}')).toBe(false)
  })

  it('rejects a different length without throwing', () => {
    expect(flagsMatch('short', 'much longer flag')).toBe(false)
  })

  it('handles empty strings', () => {
    expect(flagsMatch('', '')).toBe(true)
    expect(flagsMatch('', 'x')).toBe(false)
  })
})

describe('attempt hashing', () => {
  it('is stable and does not contain the attempt', () => {
    const hash = hashAttempt('koarena{guess}')
    expect(hash).toBe(hashAttempt('koarena{guess}'))
    expect(hash).not.toContain('guess')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('normalisation', () => {
  it('trims whitespace', () => {
    expect(normaliseFlag('  koarena{x}  ', 'STATIC')).toBe('koarena{x}')
  })

  it('lower-cases only for case-insensitive flags', () => {
    expect(normaliseFlag('KoArena{X}', 'CASE_INSENSITIVE')).toBe('koarena{x}')
    expect(normaliseFlag('KoArena{X}', 'STATIC')).toBe('KoArena{X}')
  })
})
