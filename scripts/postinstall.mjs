import { ensurePrismaClient } from './lib/prisma.mjs'

/**
 * The post-install hook.
 *
 * The generated Prisma client is not in the repository, so a fresh clone
 * cannot start until it has been generated. Generating it here means an
 * install is enough — under pnpm, bun or npm.
 *
 * A failure is a warning, not an error: the install itself succeeded, and
 * `pnpm db:generate` can be run by hand.
 */

const result = await ensurePrismaClient({ quiet: true })

if (!result.ok) {
  console.warn(`[koarena] ${result.message}`)
}
