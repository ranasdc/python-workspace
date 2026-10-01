import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getAccountProfile } from "@/lib/account"
import { AccountTabs, type AccountTab } from "@/components/account/account-tabs"

export const metadata = {
  title: "Account",
  description: "Your mycodepad profile, security, subscription and membership.",
}

const TABS: AccountTab[] = ["profile", "security", "subscription", "membership"]

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const me = await getSessionUser()
  if (!me) redirect("/sign-in?next=/account")

  const profile = await getAccountProfile(me.id)
  if (!profile) redirect("/sign-in")

  const { tab } = await searchParams
  const initialTab = TABS.includes(tab as AccountTab) ? (tab as AccountTab) : "profile"

  const home = profile.entitlement.isTeacher ? "/teacher" : "/student"

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-12">
      <Link
        href={home}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to your workspace
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your profile, sign-in details, plan and memberships.
      </p>

      <AccountTabs profile={profile} initialTab={initialTab} />
    </main>
  )
}
