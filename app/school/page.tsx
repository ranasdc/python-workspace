import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { getSchoolOverview } from "@/app/actions/schools"
import { getHeaderIdentity } from "@/lib/account"
import { AppHeader } from "@/components/app-header"
import { LegalLinkRow, PrivacyNotice } from "@/components/legal/legal-links"
import { SchoolOnboarding } from "@/components/school-onboarding"
import { SchoolDashboard } from "@/components/school-dashboard"

export const metadata = {
  title: "School",
  description: "Manage your school's plan, seats and invite codes.",
}

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in?next=/school")

  // Narrowed rather than passed through: the value arrives in a URL anyone can
  // edit, and it only ever decides which of two buttons starts selected.
  const { interval } = await searchParams
  const preselectedInterval =
    interval === "month" || interval === "year" ? interval : undefined

  const [overview, identity] = await Promise.all([
    getSchoolOverview(),
    getHeaderIdentity(sessionUser.id),
  ])

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        userId={sessionUser.id}
        name={sessionUser.name}
        email={sessionUser.email}
        avatarId={identity.avatarId}
        role={sessionUser.role === "teacher" || overview ? "teacher" : "student"}
        roleLabel={identity.roleLabel}
        schoolName={identity.schoolName}
        isSchoolAdmin={Boolean(overview)}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {overview ? (
          <SchoolDashboard overview={overview} preselectedInterval={preselectedInterval} />
        ) : (
          <SchoolOnboarding />
        )}

        {/* A school administrator is the person who has to answer for pupil data,
            so the processor terms belong on the page where they manage it. */}
        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6">
          <PrivacyNotice>
            Your school decides which pupils use MyCodePad and who sees their work, which usually
            makes the school the controller for that data. The School Data Processing Agreement
            sets out the Article 28 terms we offer, and names every provider that receives pupil
            data.
          </PrivacyNotice>
          <LegalLinkRow label="Documents:" className="text-xs" />
        </div>
      </main>
    </div>
  )
}
