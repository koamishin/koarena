// @vitest-environment node

import { getPrisma } from '@koarena/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestUser,
  hasDatabase,
  uniqueSuffix,
} from '../../test/db'
import {
  acceptInviteFor,
  createTeamFor,
  getTeamForMember,
  inviteToTeamFor,
  listTeamsForUser,
  removeMemberFor,
  revokeInviteFor,
} from './teams.server'

const suite = hasDatabase ? describe : describe.skip

suite('teams data layer', () => {
  const createdUsers: string[] = []
  const createdTeams: string[] = []

  beforeAll(() => {
    if (!hasDatabase) return
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await cleanup(createdUsers, createdTeams)
  })

  it('creates a team with the creator as its captain', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const team = await createTeamFor(user.id, {
      name: 'Segfault Society',
      slug: `segfault-${uniqueSuffix()}`,
      description: 'We only debug in release builds.',
    })

    createdTeams.push(team.id)

    expect(team.name).toBe('Segfault Society')
    expect(team.role).toBe('LEADER')
    expect(team.memberCount).toBe(1)
    expect(team.ownerId).toBe(user.id)
  })

  it('refuses a second team with the same slug for the same owner', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const slug = `dupe-${uniqueSuffix()}`
    await createTeamFor(user.id, { name: 'First', slug })
    const created = (await listTeamsForUser(user.id)).find(
      (team) => team.slug === slug,
    )
    if (created) createdTeams.push(created.id)

    await expect(
      createTeamFor(user.id, { name: 'Second', slug }),
    ).rejects.toThrow(/already have a team/i)
  })

  it('lists the teams a user belongs to', async () => {
    const user = await createTestUser()
    createdUsers.push(user.id)

    const team = await createTeamFor(user.id, {
      name: 'Null Pointers',
      slug: `null-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const teams = await listTeamsForUser(user.id)
    expect(teams.map((entry) => entry.id)).toContain(team.id)
  })

  it('hides a team from someone who is not on it', async () => {
    const owner = await createTestUser()
    const stranger = await createTestUser()
    createdUsers.push(owner.id, stranger.id)

    const team = await createTeamFor(owner.id, {
      name: 'Bit Busters',
      slug: `bits-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    expect(await getTeamForMember(stranger.id, team.id)).toBeNull()
    expect(await getTeamForMember(owner.id, team.id)).not.toBeNull()
  })

  it('invites by email and accepts as the invited address', async () => {
    const owner = await createTestUser()
    const guest = await createTestUser()
    createdUsers.push(owner.id, guest.id)

    const team = await createTeamFor(owner.id, {
      name: 'The Recursion',
      slug: `recursion-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: guest.email,
    })

    expect(invite.token).toMatch(/^[0-9a-f]{24}$/)

    const result = await acceptInviteFor(
      { id: guest.id, email: guest.email },
      invite.token,
    )
    expect(result.teamId).toBe(team.id)

    const detail = await getTeamForMember(guest.id, team.id)
    expect(detail?.members).toHaveLength(2)
  })

  it('rejects an invite for a different email address', async () => {
    const owner = await createTestUser()
    const stranger = await createTestUser()
    const third = await createTestUser()
    createdUsers.push(owner.id, stranger.id, third.id)

    const team = await createTeamFor(owner.id, {
      name: 'Heap Overflow',
      slug: `heap-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    // The invite is addressed to someone else, but a third party tries to use it.
    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: third.email,
    })

    await expect(
      acceptInviteFor({ id: stranger.id, email: stranger.email }, invite.token),
    ).rejects.toThrow(/different email/i)
  })

  it('rejects an invite used twice', async () => {
    const owner = await createTestUser()
    const guest = await createTestUser()
    createdUsers.push(owner.id, guest.id)

    const team = await createTeamFor(owner.id, {
      name: 'Garbage Collectors',
      slug: `gc-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: guest.email,
    })

    await acceptInviteFor({ id: guest.id, email: guest.email }, invite.token)

    await expect(
      acceptInviteFor({ id: guest.id, email: guest.email }, invite.token),
    ).rejects.toThrow(/already been used/i)
  })

  it('lets only the owner invite and revoke', async () => {
    const owner = await createTestUser()
    const member = await createTestUser()
    createdUsers.push(owner.id, member.id)

    const team = await createTeamFor(owner.id, {
      name: 'Off By One',
      slug: `offby-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: member.email,
    })
    await acceptInviteFor({ id: member.id, email: member.email }, invite.token)

    await expect(
      inviteToTeamFor(member.id, {
        teamId: team.id,
        email: 'someone@example.com',
      }),
    ).rejects.toThrow(/only the team owner/i)

    // A second, unaccepted invite so there is something pending to revoke.
    await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: 'pending@example.com',
    })

    const detail = await getTeamForMember(owner.id, team.id)
    const pending = detail?.pendingInvites ?? []
    expect(pending.length).toBeGreaterThan(0)

    const firstPending = pending[0]
    if (!firstPending) throw new Error('expected a pending invite')
    const revoked = await revokeInviteFor(owner.id, firstPending.id)
    expect(revoked.revoked).toBe(true)
  })

  it('lets a member leave but keeps the owner', async () => {
    const owner = await createTestUser()
    const member = await createTestUser()
    createdUsers.push(owner.id, member.id)

    const team = await createTeamFor(owner.id, {
      name: 'Undefined Behavior',
      slug: `ub-${uniqueSuffix()}`,
    })
    createdTeams.push(team.id)

    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: member.email,
    })
    await acceptInviteFor({ id: member.id, email: member.email }, invite.token)

    await expect(
      removeMemberFor(member.id, { teamId: team.id, userId: owner.id }),
    ).rejects.toThrow(/only the team owner/i)

    await expect(
      removeMemberFor(owner.id, { teamId: team.id, userId: owner.id }),
    ).rejects.toThrow(/owner cannot be removed/i)

    await removeMemberFor(member.id, { teamId: team.id, userId: member.id })

    const detail = await getTeamForMember(member.id, team.id)
    expect(detail).toBeNull()
  })

  it('cascades the roster when the team is deleted', async () => {
    const owner = await createTestUser()
    const member = await createTestUser()
    createdUsers.push(owner.id, member.id)

    const team = await createTeamFor(owner.id, {
      name: 'Temporary',
      slug: `temp-${uniqueSuffix()}`,
    })

    const invite = await inviteToTeamFor(owner.id, {
      teamId: team.id,
      email: member.email,
    })
    await acceptInviteFor({ id: member.id, email: member.email }, invite.token)

    const prisma = getPrisma()
    await prisma.team.delete({ where: { id: team.id } })

    const remaining = await prisma.teamMember.count({
      where: { teamId: team.id },
    })
    expect(remaining).toBe(0)
  })
})
