import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

import { ensurePrismaClient, repoRoot } from './lib/prisma.mjs'

/**
 * The dev server, with a preflight.
 *
 * Two things stop a fresh clone from starting, and neither error says what
 * to do about it:
 *
 *   1. The Prisma client is generated, not committed. Without it every
 *      import of `@koarena/db` dies with a bare `ERR_MODULE_NOT_FOUND`.
 *   2. The web app is pinned to port 3100 (`--strictPort`) because Clerk ties
 *      its sign-in redirect to the origin. A second dev server then fails
 *      with "Port 3100 is already in use".
 *
 * So: generate the client if it is missing, say something useful if the port
 * is taken, and then hand over to turbo.
 */

const PORT = 3100

/** Is the port free? Resolves to the reason it is not, if it is taken. */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', (error) => {
      resolve({
        free: false,
        message:
          error.code === 'EACCES'
            ? `port ${port} is not available to this user`
            : `port ${port} is already in use`,
      })
    })

    server.once('listening', () => {
      server.close(() => resolve({ free: true }))
    })

    server.listen(port, '127.0.0.1')
  })
}

/** The process holding the port, if we can find it. */
function findHolder(port) {
  for (const [command, args] of [
    ['lsof', ['-ti', `:${port}`]],
    ['ss', ['-ltnp', `sport = :${port}`]],
  ]) {
    try {
      const out = execFileSync(command, args, { encoding: 'utf8' })
      const pid =
        out.match(/pid=(\d+)/)?.[1] ?? out.trim().split('\n')[0]?.trim()
      if (pid && /^\d+$/.test(pid)) return pid
    } catch {
      // lsof or ss is not installed; carry on without the pid.
    }
  }
  return null
}

async function main() {
  // 1. the Prisma client
  const client = await ensurePrismaClient()
  if (!client.ok) {
    console.error(`[koarena] ${client.message}`)
    process.exit(1)
  }

  // 2. the port
  const port = await checkPort(PORT)
  if (!port.free) {
    const pid = findHolder(PORT)
    console.error(
      `[koarena] ${port.message}.\n` +
        (pid
          ? `        The process holding it is PID ${pid}:\n          kill ${pid}\n`
          : '        Stop the other dev server, or free the port.\n') +
        '        The app is pinned to 3100 because Clerk ties its sign-in\n' +
        '        redirect to the origin. Changing the port means changing the\n' +
        '        Clerk redirect too.',
    )
    process.exit(1)
  }

  // 3. hand over to turbo
  const turbo = join(repoRoot, 'node_modules', '.bin', 'turbo')
  const child = spawn(existsSync(turbo) ? turbo : 'turbo', ['run', 'dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  const forward = (signal) => () => child.kill(signal)
  process.on('SIGINT', forward('SIGINT'))
  process.on('SIGTERM', forward('SIGTERM'))

  child.on('close', (code) => process.exit(code ?? 0))
}

await main()
