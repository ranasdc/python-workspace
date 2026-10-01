"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, CreditCard, LogOut, Shield, User, Users } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** First letters of the first and last word, e.g. "Sarah Jones" -> "SJ". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

/**
 * The account menu behind the user's avatar.
 *
 * Every entry here is a view of the user's own account, so it is safe for all
 * roles; the only conditional entry is the school area, which is shown to
 * members and labelled by what they may actually do there. Administrative
 * powers themselves are enforced by the server actions those pages call, not
 * by this menu.
 */
export function ProfileMenu({
  name,
  email,
  image,
  roleLabel,
  schoolName,
  isSchoolAdmin,
}: {
  name: string
  email: string
  image?: string | null
  /** e.g. "Teacher", "School admin", "Student". */
  roleLabel: string
  /** The school from the user's membership, or null when they have none. */
  schoolName?: string | null
  isSchoolAdmin?: boolean
}) {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md p-1 pr-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Your account"
      >
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback className="text-xs font-medium">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">
            {schoolName ? `${roleLabel} · ${schoolName}` : roleLabel}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
          <span className="mt-1 text-xs text-muted-foreground">
            {schoolName ? `${roleLabel} · ${schoolName}` : roleLabel}
          </span>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/account" />} nativeButton={false}>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/account?tab=security" />}
            nativeButton={false}
          >
            <Shield />
            Security
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/billing" />} nativeButton={false}>
            <CreditCard />
            Subscription
          </DropdownMenuItem>
          {schoolName ? (
            <DropdownMenuItem
              render={<Link href="/account?tab=membership" />}
              nativeButton={false}
            >
              <Users />
              Membership
            </DropdownMenuItem>
          ) : null}
          {isSchoolAdmin ? (
            <DropdownMenuItem render={<Link href="/school" />} nativeButton={false}>
              <Building2 />
              School admin
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
