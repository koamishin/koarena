// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestUser,
  hasDatabase,
  uniqueSuffix,
} from '../../test/db'
import { createTeamFor } from '../teams/teams.server'
import {
  createTournamentFor,
  fetchPublicTournaments,
  listTournamentsForOrganizer,
  registerForTournamentFor,
  updateTournamentFor,
  withdrawFromTournamentFor,
} from './tournaments.server'

const suite = hasDatabase ? describe : describe.skip

const baseInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'KoArena Autumn CTF',
  slug: `autumn-${uniqueSuffix()}`,
  tagline: 'Six hours, eight categories, one winner.',
  gameMode: 'CTF' as const,
  visibility: 'PUBLIC' as const,
  startsAt: new Date(Date.now() + 86_400_000),
  endsAt: new Date(Date.now() + 7 * 86_400_000),
  teamSizeMin: 1,
  teamSizeMax: 5,
  languageIds: [],
  config: {},
  ...overrides,
})

suite('tournaments data layer', () => {
  const createdUsers: string[] = []
  const createdTeams: string[] = []

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers, createdTeams)
  })

  it('creates a tournament as a draft', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const tournament = await createTournamentFor(user.id, baseInput())

    const mine = await listTournamentsForOrganizer(user.id)
    const created = mine.find((entry) => entry.id === tournament.id)

    expect(created?.status).toBe('DRAFT')
    expect(created?.gameModeLabel).toBe('Capture The Flag')
    expect(created?.visibility).toBe('PUBLIC')
  })

  it('fills in the mode defaults and rejects an impossible config', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const tournament = await createTournamentFor(
      user.id,
      baseInput({ config: { basePoints: 750 } }),
    )

    const detail = await updateTournamentFor(
      { id: user.id, role: 'ORGANIZER' },
      { id: tournament.id },
    )
    expect(detail.id).toBe(tournament.id)

    await expect(
      createTournamentFor(user.id, baseInput({ config: { basePoints: -5 } })),
    ).rejects.toThrow()
  })

  it('rejects a tournament that ends before it starts', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const now = Date.now()
    await expect(
      createTournamentFor(
        user.id,
        baseInput({
          startsAt: new Date(now + 86_400_000),
          endsAt: new Date(now),
        }),
      ),
    ).rejects.toThrow(/must end after it starts/i)
  })

  it('rejects a team size range that is inverted', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    await expect(
      createTournamentFor(
        user.id,
        baseInput({ teamSizeMin: 5, teamSizeMax: 2 }),
      ),
    ).rejects.toThrow(/team size/i)
  })

  it('refuses a duplicate slug', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const slug = `dupe-${uniqueSuffix()}`
    await createTournamentFor(user.id, baseInput({ slug }))

    await expect(
      createTournamentFor(user.id, baseInput({ slug })),
    ).rejects.toThrow(/already taken/i)
  })

  it('only lets the organizer change a tournament', async () => {
    const owner = await createTestUser('ORGANIZER')
    const stranger = await createTestUser('ORGANIZER')
    createdUsers.push(owner.id, stranger.id)

    const tournament = await createTournamentFor(owner.id, baseInput())

    await expect(
      updateTournamentFor(
        { id: stranger.id, role: 'ORGANIZER' },
        { id: tournament.id, name: 'Hijacked' },
      ),
    ).rejects.toThrow(/only the organizer/i)
  })

  it('opens a draft for registration and then joins it', async () => {
    const organizer = await createTestUser('ORGANIZER')
    const player = await createTestUser()
    createdUsers.push(organizer.id, player.id)

    const tournament = await createTournamentFor(organizer.id, baseInput())

    await updateTournamentFor(
      { id: organizer.id, role: 'ORGANIZER' },
      { id: tournament.id, status: 'REGISTRATION' },
    )

    await registerForTournamentFor(player.id, { tournamentId: tournament.id })

    const registered = await listTournamentsForOrganizer(organizer.id)
    expect(
      registered.find((entry) => entry.id === tournament.id)?.participantCount,
    ).toBe(1)

    await withdrawFromTournamentFor(player.id, tournament.id)
  })

  it('refuses to register for a draft', async () => {
    const organizer = await createTestUser('ORGANIZER')
    const player = await createTestUser()
    createdUsers.push(organizer.id, player.id)

    const tournament = await createTournamentFor(organizer.id, baseInput())

    await expect(
      registerForTournamentFor(player.id, { tournamentId: tournament.id }),
    ).rejects.toThrow(/not opened for registration/i)
  })

  it('refuses to register with a team the player is not on', async () => {
    const organizer = await createTestUser('ORGANIZER')
    const player = await createTestUser()
    const other = await createTestUser()
    createdUsers.push(organizer.id, player.id, other.id)

    const tournament = await createTournamentFor(organizer.id, baseInput())
    await updateTournamentFor(
      { id: organizer.id, role: 'ORGANIZER' },
      { id: tournament.id, status: 'REGISTRATION' },
    )

    const team = await createTeamFor(other.id, {
      name: 'Someone Elses',
      slug: `others-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    await expect(
      registerForTournamentFor(player.id, {
        tournamentId: tournament.id,
        teamId: team.id,
      }),
    ).rejects.toThrow(/not on that team/i)
  })

  it('registers a team and counts it once', async () => {
    const organizer = await createTestUser('ORGANIZER')
    const player = await createTestUser()
    createdUsers.push(organizer.id, player.id)

    const team = await createTeamFor(player.id, {
      name: 'Bit Busters',
      slug: `bits-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const tournament = await createTournamentFor(organizer.id, baseInput())
    await updateTournamentFor(
      { id: organizer.id, role: 'ORGANIZER' },
      { id: tournament.id, status: 'REGISTRATION' },
    )

    await registerForTournamentFor(player.id, {
      tournamentId: tournament.id,
      teamId: team.id,
    })
    await registerForTournamentFor(player.id, {
      tournamentId: tournament.id,
      teamId: team.id,
    })

    const mine = await listTournamentsForOrganizer(organizer.id)
    const created = mine.find((entry) => entry.id === tournament.id)

    expect(created?.teamCount).toBe(1)
    expect(created?.participantCount).toBe(1)
  })

  it('lists public tournaments and hides drafts', async () => {
    const user = await createTestUser('ORGANIZER')
    createdUsers.push(user.id)

    await createTournamentFor(user.id, baseInput({ name: 'Visible One' }))

    const publicList = await fetchPublicTournaments({ limit: 100 })
    const mine = publicList.filter((entry) => entry.name === 'Visible One')

    // A draft is not public yet.
    expect(mine.every((entry) => entry.status !== 'DRAFT')).toBe(true)
  })
})
