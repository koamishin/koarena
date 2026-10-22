import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The Prisma client.
 *
 * `packages/db/generated/` is gitignored, so a fresh clone has no client and
 * every import of `@koarena/db` fails with a bare
 * `ERR_MODULE_NOT_FOUND: Cannot find module .../generated/prisma/client`.
 *
 * The binary lives in the package that owns the schema, so it is resolved
 * there rather than at the root: pnpm's strict layout does not hoist it.
 *
 * @param {{ quiet?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(here, '..', '..')

// Prisma 7 generates a set of TypeScript files, not a directory: the entry
// point is `generated/prisma/client.ts`.
const CLIENT_MARKER = join(
  repoRoot,
  'packages',
  'db',
  'generated',
  'prisma',
  'client.ts',
)

const PRISMA_BINARIES = [
  join(repoRoot, 'packages', 'db', 'node_modules', '.bin', 'prisma'),
  join(repoRoot, 'node_modules', '.bin', 'prisma'),
]

/** Is the generated client there? */
export function hasPrismaClient() {
  return existsSync(CLIENT_MARKER)
}

function findPrismaBinary() {
  return PRISMA_BINARIES.find((path) => existsSync(path)) ?? null
}

/**
 * Generate the Prisma client if it is missing.
 *
 * Never throws: a failed generate is reported, but it must not take the
 * install or the dev server down with it.
 */
export async function ensurePrismaClient({ quiet = false } = {}) {
  if (hasPrismaClient()) {
    return { ok: true }
  }

  const binary = findPrismaBinary()

  if (!binary) {
    return {
      ok: false,
      message:
        'The Prisma CLI is not installed. Run an install (pnpm install / bun install) first.',
    }
  }

  if (!quiet) {
    console.log('› Generating the Prisma client (it is not in the repository)…')
  }

  const code = await new Promise((resolvePromise) => {
    const child = spawn(
      binary,
      [
        'generate',
        '--schema',
        join(repoRoot, 'packages', 'db', 'prisma', 'schema.prisma'),
      ],
      { cwd: join(repoRoot, 'packages', 'db'), stdio: 'inherit' },
    )

    child.on('error', () => resolvePromise(1))
    child.on('close', (exitCode) => resolvePromise(exitCode ?? 1))
  })

  if (code !== 0) {
    return {
      ok: false,
      message: 'prisma generate failed. Run `pnpm db:generate` to see why.',
    }
  }

  return { ok: true }
}
