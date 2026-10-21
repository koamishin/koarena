import { getPrisma } from '@koarena/db'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getStandings } from './scoring.server'

export const getStandingsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tournamentId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const prisma = getPrisma()

    const tournament = await prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: { id: true, gameMode: true },
    })

    if (!tournament) return []

    return getStandings(tournament.id, tournament.gameMode)
  })
