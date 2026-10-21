import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

let client: PrismaClient | undefined

/**
 * The Prisma client, created on first use.
 *
 * Lazy on purpose: importing this module must not require a DATABASE_URL, so
 * the app can boot (and the build can run) without a reachable database.
 */
export function getPrisma(): PrismaClient {
  if (client) return client

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and point it at Postgres.',
    )
  }

  client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    }),
  })

  return client
}

export type { PrismaClient } from '../generated/prisma/client'
