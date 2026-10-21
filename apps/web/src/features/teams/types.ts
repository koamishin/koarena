export interface TeamSummary {
  id: string
  name: string
  slug: string
  description: string | null
  role: string
  memberCount: number
  ownerId: string
}

export interface TeamMemberRow {
  id: string
  role: string
  joinedAt: string
  user: {
    id: string
    email: string
    handle: string | null
    firstName: string | null
  }
}

export interface TeamDetail extends TeamSummary {
  members: TeamMemberRow[]
  pendingInvites: Array<{
    id: string
    receiverEmail: string
    expiresAt: string
  }>
  isOwner: boolean
}

export interface InvitePreview {
  token: string
  teamName: string
  teamSlug: string
  senderEmail: string
  expiresAt: string
  accepted: boolean
}
