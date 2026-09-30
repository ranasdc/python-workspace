"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut, Zap } from "lucide-react"
import { LogoIcon, LogoWordmark } from "@/components/logo"
import { cn } from "@/lib/utils"
import { usePendingStarters } from "@/hooks/use-pending-starters"

export function AppHeader({
  name,
  role,
}: {
  name: string
  role: string
}) {
  const router = useRouter()
  const newCount = usePendingStarters(role === "student").length

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <LogoIcon className="h-9 w-9 shrink-0" />
        <div className="leading-tight">
          <LogoWordmark className="block text-sm" />
          <span className="block text-xs capitalize text-muted-foreground">{role} workspace</span>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        {role === "student" && (
          <Link
            href="/student/starters"
            aria-label={newCount > 0 ? `Daily Starter, ${newCount} new` : "Daily Starter"}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              newCount > 0
                ? "bg-primary/10 text-primary ring-1 ring-primary/40 hover:bg-primary/15"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Zap className="h-4 w-4 text-primary" />
            Daily Starter
            {newCount > 0 && (
              <>
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
                  {newCount}
                </span>
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                </span>
              </>
            )}
          </Link>
        )}
        <div className="hidden text-right sm:block">
          <span className="block text-sm font-medium">{name}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
