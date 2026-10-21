import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

/**
 * Flag encryption.
 *
 * A CTF flag is a secret that must survive a database dump without leaking.
 * Every flag is stored as AES-256-GCM ciphertext: the value, the IV and the
 * auth tag are separate columns, so a partial leak of the table is not a leak
 * of the flags.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

export interface EncryptedFlag {
  /** base64 ciphertext */
  value: string
  /** base64 initialisation vector */
  iv: string
  /** base64 GCM authentication tag */
  authTag: string
}

export interface FlagKey {
  key: Buffer
}

/**
 * Read the flag encryption key from the environment.
 *
 * 32 bytes, base64. Generate with `openssl rand -base64 32`.
 */
export function readFlagKey(raw = process.env.FLAG_ENCRYPTION_KEY): FlagKey {
  if (!raw) {
    throw new Error(
      'FLAG_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.',
    )
  }

  const key = Buffer.from(raw, 'base64')

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `FLAG_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    )
  }

  return { key }
}

export function encryptFlag(plaintext: string, key: FlagKey): EncryptedFlag {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key.key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  return {
    value: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptFlag(encrypted: EncryptedFlag, key: FlagKey): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key.key,
    Buffer.from(encrypted.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.value, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Compare a submitted flag against the stored one without leaking timing.
 *
 * A plain `===` on strings leaks how many leading characters matched, which is
 * enough to brute-force a flag character by character.
 */
export function flagsMatch(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted, 'utf8')
  const b = Buffer.from(expected, 'utf8')

  if (a.length !== b.length) {
    // Still burn a comparison so the failure does not return early.
    timingSafeEqual(b, b)
    return false
  }

  return timingSafeEqual(a, b)
}

/**
 * Hash a flag attempt.
 *
 * Only the hash of a wrong attempt is stored — never the attempt itself. A
 * correct attempt is hashed too, so the table never contains a usable flag.
 */
export function hashAttempt(attempt: string): string {
  return createHash('sha256').update(attempt, 'utf8').digest('hex')
}

/** Normalise a submitted flag according to the flag's format. */
export function normaliseFlag(
  attempt: string,
  format: 'STATIC' | 'REGEX' | 'CASE_INSENSITIVE',
): string {
  const trimmed = attempt.trim()
  return format === 'CASE_INSENSITIVE' ? trimmed.toLowerCase() : trimmed
}
