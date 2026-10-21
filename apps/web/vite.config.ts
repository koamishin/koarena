import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Vite only exposes .env files through import.meta.env. Server code reads
  // process.env, so copy them across — otherwise the Prisma client cannot
  // find DATABASE_URL during SSR.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart({
        // Fail the build when server-only code (the Prisma client, Clerk's
        // backend SDK, Redis) would end up in the browser bundle.
        importProtection: {
          behavior: { dev: 'mock', build: 'error' },
          client: {
            specifiers: [
              '@tanstack/react-start/server',
              '@koarena/db',
              '@koarena/crypto',
              '@koarena/realtime',
            ],
          },
        },
      }),
      viteReact(),
    ],
  }
})
