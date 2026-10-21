export type KoArenaRole = 'PLAYER' | 'ORGANIZER' | 'JUDGE' | 'ADMIN'

export interface SessionUser {
  id: string
  email: string
  role: KoArenaRole
  handle: string | null
  firstName: string | null
}
