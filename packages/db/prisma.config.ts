import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * The fallback keeps `prisma generate` working in CI and in a fresh clone
 * where no database is reachable yet. `migrate` and `db seed` still need a real
 * DATABASE_URL — they will fail loudly if the fallback is in use.
 */
const datasourceUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/koarena'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
})
