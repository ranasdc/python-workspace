"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { LogoIcon, LogoWordmark } from "@/components/logo"

export function AppHeader({
  name,
  role,
}: {
  name: string
  role: string
}) {
  const router = useRouter()

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
