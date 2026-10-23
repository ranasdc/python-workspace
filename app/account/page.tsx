import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getAccountProfile } from "@/lib/account"
import { getErasureContext } from "@/lib/erasure-requests"
import { AccountTabs, type AccountTab } from "@/components/account/account-tabs"
import { LegalLinkRow, PrivacyNotice } from "@/components/legal/legal-links"

export const metadata = {
  title: "Account",
  description: "Your mycodepad profile, security, subscription and membership.",
}

const TABS: AccountTab[] = ["profile", "security", "subscription", "membership", "data"]

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const me = await getSessionUser()
  if (!me) redirect("/sign-in?next=/account")

  const [profile, erasure] = await Promise.all([
    getAccountProfile(me.id),
    getErasureContext(me.id),
  ])
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

      <AccountTabs profile={profile} erasure={erasure} initialTab={initialTab} />

      {/* The account area is where someone goes looking for their data, so the
          rights notice belongs here rather than only in the public footer that
          a signed-in user never sees. */}
      <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6">
        <PrivacyNotice>
          You can see and correct your profile above, and the{" "}
          <Link
            href="/account?tab=data"
            className="font-medium text-foreground hover:underline"
          >
            Your data
          </Link>{" "}
          tab shows exactly what deleting this account would involve and lets you ask for it.
          For a copy of your data, use the contact details in the{" "}
          <Link href="/privacy" className="font-medium text-foreground hover:underline">
            Privacy Policy
          </Link>
          .
        </PrivacyNotice>
        <LegalLinkRow className="text-xs" />
      </div>
    </main>
  )
}
