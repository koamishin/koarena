import { getPrisma, type ScoreEventType } from '@koarena/db'
import { rank as rankStandings, toGameModeId } from '@koarena/game'

/**
 * The score ledger.
 *
 * Nothing but a `ScoreEvent` ever changes a team's score. The snapshot table
 * is a materialised view of that log — it can always be rebuilt from the
 * events, which is what makes disputes, anti-cheat adjudication and "the cache
 * died" recoverable rather than fatal.
 */

export interface ScoreEventInput {
  tournamentId: string
  teamId?: string | null
  userId?: string | null
  type: ScoreEventType
  /** The base value of whatever was scored. */
  points: number
  /** The multiplier applied to it (language handicap, rubric weight). */
  weight?: number
  /** The signed change to the team's total. */
  delta: number
  refType?: string
  refId?: string
  metadata?: Record<string, unknown>
  /** Unique per logical event — replaying the same key is a no-op. */
  idempotencyKey: string
}

export interface ScoreEventRecord {
  id: string
  teamId: string | null
  type: ScoreEventType
  points: number
  delta: number
  createdAt: string
}

/**
 * Append a score event and refresh the team's snapshot.
 *
 * The insert and the snapshot update happen in one transaction, and the
 * transaction takes a Postgres advisory lock keyed on the team — two solves at
 * the same instant cannot interleave and lose a point.
 *
 * Returns null when the idempotency key has already been used.
 */
export async function recordScoreEvent(
  input: ScoreEventInput,
): Promise<ScoreEventRecord | null> {
  const prisma = getPrisma()
  const teamId = input.teamId ?? null

  const event = await prisma.$transaction(async (tx) => {
    if (teamId) {
      // Serialise score changes for one team. hashtext gives a stable int4.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${teamId}))`
    }

    const existing = await tx.scoreEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    })

    if (existing) return null

    const created = await tx.scoreEvent.create({
      data: {
        tournamentId: input.tournamentId,
        teamId,
        userId: input.userId ?? null,
        type: input.type,
        points: input.points,
        weight: input.weight ?? 1,
        delta: input.delta,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        metadata: (input.metadata ?? undefined) as never,
        idempotencyKey: input.idempotencyKey,
      },
    })

    await refreshSnapshot(tx, input.tournamentId, teamId, input.userId ?? null)

    return created
  })

  if (!event) return null

  return {
    id: event.id,
    teamId: event.teamId,
    type: event.type,
    points: event.points,
    delta: event.delta,
    createdAt: event.createdAt.toISOString(),
  }
}

type Tx = Parameters<
  Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]
>[0]

/**
 * Recompute one team's snapshot from its events.
 *
 * The snapshot is derived state, so this is safe to run at any time.
 */
async function refreshSnapshot(
  tx: Tx,
  tournamentId: string,
  teamId: string | null,
  userId: string | null,
): Promise<void> {
  const events = await tx.scoreEvent.findMany({
    where: teamId
      ? { tournamentId, teamId }
      : { tournamentId, teamId: null, userId },
    select: { delta: true, type: true, metadata: true, createdAt: true },
  })

  let score = 0
  let solves = 0
  let penalty = 0
  let lastEventAt: Date | null = null

  for (const event of events) {
    score += event.delta

    if (event.type === 'CHALLENGE_SOLVED' || event.type === 'PROBLEM_SOLVED') {
      solves += 1
    }

    if (event.type === 'SUBMISSION_PENALTY') {
      const metadata = event.metadata as { penaltyMinutes?: number } | null
      penalty += metadata?.penaltyMinutes ?? 0
    }

    if (!lastEventAt || event.createdAt > lastEventAt) {
      lastEventAt = event.createdAt
    }
  }

  const data = {
    score,
    solves,
    penalty,
    lastEventAt,
  }

  // A snapshot belongs to one participant: a team, or a solo player. The
  // compound unique index cannot be used as a where clause because `teamId` is
  // nullable, so find it instead.
  const existing = await tx.scoreSnapshot.findFirst({
    where: teamId
      ? { tournamentId, teamId }
      : { tournamentId, teamId: null, userId },
    select: { id: true },
  })

  if (existing) {
    await tx.scoreSnapshot.update({ where: { id: existing.id }, data })
  } else {
    await tx.scoreSnapshot.create({
      data: { tournamentId, teamId, userId, ...data, rank: 0 },
    })
  }
}

export interface StandingRow {
  rank: number
  /**
   * The participant's stable identity: the team id, or the player id when the
   * participant plays solo. Two solo players are two standings.
   */
  id: string
  /** The team's id, or null when the participant plays solo. */
  teamId: string | null
  teamName: string | null
  /** The player's id, or null when the participant is a team. */
  userId: string | null
  userName: string | null
  score: number
  solves: number
  penalty: number
  lastEventAt: string | null
}

/**
 * The current standings, ranked with the mode's own tie-breakers.
 *
 * Reads the snapshots, then ranks them with `@koarena/game` so the board and
 * the engine can never disagree about the order.
 */
export async function getStandings(
  tournamentId: string,
  gameMode: string,
): Promise<StandingRow[]> {
  const prisma = getPrisma()

  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { tournamentId },
    orderBy: [{ score: 'desc' }, { solves: 'desc' }],
  })

  if (snapshots.length === 0) return []

  const teamIds = snapshots
    .map((snapshot) => snapshot.teamId)
    .filter((id): id is string => Boolean(id))

  const userIds = snapshots
    .map((snapshot) => snapshot.userId)
    .filter((id): id is string => Boolean(id))

  const [teams, users] = await Promise.all([
    teamIds.length
      ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true },
        })
      : Promise.resolve([]),
  ])

  const teamNames = new Map(teams.map((team) => [team.id, team.name]))
  const userNames = new Map(
    users.map((user) => [user.id, user.firstName ?? user.email]),
  )

  // The engine ranks by a stable participant id: the team id, or the player id
  // for a solo participant.
  const ranked = rankStandings(
    toGameModeId(gameMode),
    snapshots.map((snapshot) => ({
      rank: 0,
      id: snapshot.teamId ?? snapshot.userId ?? '',
      score: snapshot.score,
      solves: snapshot.solves,
      penalty: snapshot.penalty,
      lastEventAt: snapshot.lastEventAt ? snapshot.lastEventAt.getTime() : null,
    })),
  )

  const byId = new Map(
    snapshots.map((snapshot) => [
      snapshot.teamId ?? snapshot.userId ?? '',
      snapshot,
    ]),
  )

  return ranked.map((standing) => {
    const snapshot = byId.get(standing.id)
    return {
      rank: standing.rank,
      id: standing.id,
      teamId: snapshot?.teamId ?? null,
      teamName: snapshot?.teamId
        ? (teamNames.get(snapshot.teamId) ?? null)
        : null,
      userId: snapshot?.userId ?? null,
      userName: snapshot?.userId
        ? (userNames.get(snapshot.userId) ?? null)
        : null,
      score: standing.score,
      solves: standing.solves,
      penalty: standing.penalty,
      lastEventAt: standing.lastEventAt
        ? new Date(standing.lastEventAt).toISOString()
        : null,
    }
  })
}

/**
 * Re-rank every snapshot for a tournament.
 *
 * The rank column is a convenience for sorting; the authoritative order is
 * always the one the engine computes.
 */
export async function rerankStandings(
  tournamentId: string,
  gameMode: string,
): Promise<StandingRow[]> {
  const prisma = getPrisma()
  const standings = await getStandings(tournamentId, gameMode)

  await prisma.$transaction(
    standings.map((standing) =>
      prisma.scoreSnapshot.updateMany({
        where: {
          tournamentId,
          teamId: standing.teamId,
          ...(standing.teamId ? {} : { userId: standing.userId }),
        },
        data: { rank: standing.rank },
      }),
    ),
  )

  return standings
}
