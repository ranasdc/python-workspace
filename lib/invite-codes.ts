/**
 * Bounds on an invite code's reach.
 *
 * These live outside the server actions module so the dialog that collects the
 * numbers and the action that enforces them share one definition — a form
 * capped at a different number than the server would accept is a validation
 * error the user only discovers on submit.
 *
 * A code is a bearer credential, so "unlimited uses, never expires" has to be
 * chosen deliberately rather than reached by typing a number large enough to
 * mean the same thing.
 */
export const MAX_INVITE_USES = 500
export const MAX_INVITE_DAYS = 730

/** One row of the invite-code management view. */
export type SchoolInviteCode = {
  id: number
  code: string
  role: string
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  active: boolean
  createdAt: Date
  createdByName: string | null
  joinedCount: number
}

/** A teacher attributed to a specific invite code. */
export type InviteCodeMember = {
  userId: string
  name: string
  email: string
  avatarId: string | null
  role: string
  status: string
  joinedAt: Date
}
