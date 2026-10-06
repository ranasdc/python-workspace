import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveAvatar } from "@/lib/avatars"
import { cn } from "@/lib/utils"

/** First letters of the first and last word, e.g. "Sarah Jones" -> "SJ". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

/**
 * One person's profile picture, anywhere in MyCodePad.
 *
 * Every surface that shows a face goes through here, so the rule that a
 * picture can only come from the approved catalogue is enforced by the
 * component rather than by each caller remembering it: the only thing a caller
 * can pass is a catalogue id, and an id that is unknown or retired resolves to
 * the user's stable default instead of to a broken image.
 *
 * The initials fallback is kept for the case where the artwork itself fails to
 * load, so a row never collapses to an empty circle.
 */
export function UserAvatar({
  userId,
  name,
  avatarId,
  size = "default",
  className,
}: {
  userId: string
  /** Used for the initials fallback and the accessible label. */
  name: string
  avatarId: string | null | undefined
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  const avatar = resolveAvatar(userId, avatarId)

  return (
    <Avatar size={size} className={cn("shrink-0", className)}>
      {/* Decorative: the person's name is always rendered as text beside it. */}
      <AvatarImage src={avatar.src} alt="" loading="lazy" decoding="async" />
      <AvatarFallback className="text-xs font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
