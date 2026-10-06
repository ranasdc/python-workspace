"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Check,
  CreditCard,
  Download,
  LogOut,
  Shield,
  Smile,
  User,
  Users,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { installMode, promptInstall, usePwa } from "@/lib/pwa"
import { InstallDialog } from "@/components/pwa/install-dialog"
import { AvatarPicker } from "@/components/account/avatar-picker"
import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  userId,
  name,
  email,
  avatarId,
  roleLabel,
  schoolName,
  isSchoolAdmin,
  isTeacher = false,
}: {
  userId: string
  name: string
  email: string
  /** Key into the avatar catalogue, or null when never chosen. */
  avatarId?: string | null
  /** e.g. "Teacher", "School admin", "Student". */
  roleLabel: string
  /** The school from the user's membership, or null when they have none. */
  schoolName?: string | null
  isSchoolAdmin?: boolean
  /** Tailors the install copy to classes rather than a personal workspace. */
  isTeacher?: boolean
}) {
  const router = useRouter()
  const pwa = usePwa()
  const mode = installMode(pwa)
  const [installOpen, setInstallOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  async function handleInstall() {
    if (mode === "prompt") {
      const outcome = await promptInstall()
      if (outcome !== "unavailable") return
    }
    setInstallOpen(true)
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md p-1 pr-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Your account"
      >
        <UserAvatar userId={userId} name={name} avatarId={avatarId} />
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
          <DropdownMenuItem onClick={() => setAvatarOpen(true)}>
            <Smile />
            Change avatar
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

        {pwa.ready ? (
          <>
            <DropdownMenuSeparator />
            {mode === "installed" ? (
              <DropdownMenuItem onClick={() => setInstallOpen(true)}>
                <Check className="text-emerald-500" />
                MyCodePad installed
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleInstall}>
                <Download />
                Install MyCodePad
              </DropdownMenuItem>
            )}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <InstallDialog open={installOpen} onOpenChange={setInstallOpen} isTeacher={isTeacher} />
    <AvatarPicker
      open={avatarOpen}
      onOpenChange={setAvatarOpen}
      userId={userId}
      name={name}
      currentAvatarId={avatarId}
    />
    </>
  )
}
