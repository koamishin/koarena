import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and point it at Postgres.',
  )
}

/**
 * Prisma 7 requires a driver adapter for every database.
 *
 * The pooled URL is what keeps Postgres alive under serverless concurrency:
 * - Neon    -> the `-pooler` region host
 * - Supabase-> the session pooler (port 5432), NOT the transaction pooler (6543),
 *              because Prisma needs prepared statements
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  }),
})

export type { PrismaClient } from '../generated/prisma/client'
