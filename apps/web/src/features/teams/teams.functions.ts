import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { slugify } from '../../lib/slug'
import { requireUser } from '../auth/auth.functions'
import {
  acceptInviteFor,
  createTeamFor,
  deleteTeamFor,
  getInviteByToken,
  getTeamForMember,
  inviteToTeamFor,
  listTeamsForUser,
  removeMemberFor,
  revokeInviteFor,
  updateTeamFor,
} from './teams.server'

export const listMyTeams = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    return listTeamsForUser(user.id)
  },
)

export const getTeam = createServerFn({ method: 'GET' })
  .validator(z.object({ teamId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return getTeamForMember(user.id, data.teamId)
  })

export const createTeam = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(2, 'Name is too short').max(60),
      description: z.string().trim().max(280).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const name = data.name.trim()
    const slug = slugify(name) || 'team'

    return createTeamFor(user.id, {
      name,
      slug,
      description: data.description?.trim() || undefined,
    })
  })

export const updateTeam = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      teamId: z.string().min(1),
      name: z.string().trim().min(2).max(60).optional(),
      description: z.string().trim().max(280).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    return updateTeamFor(user.id, {
      teamId: data.teamId,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
    })
  })

export const deleteTeam = createServerFn({ method: 'POST' })
  .validator(z.object({ teamId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return deleteTeamFor(user.id, data.teamId)
  })

export const inviteToTeam = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      teamId: z.string().min(1),
      email: z.email('Enter a valid email address'),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    return inviteToTeamFor(user.id, data)
  })

export const revokeInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ inviteId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return revokeInviteFor(user.id, data.inviteId)
  })

export const getInvite = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => getInviteByToken(data.token))

export const acceptInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    return acceptInviteFor(user, data.token)
  })

export const removeMember = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      teamId: z.string().min(1),
      userId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    return removeMemberFor(user.id, data)
  })

export type {
  InvitePreview,
  TeamDetail,
  TeamMemberRow,
  TeamSummary,
} from './types'
