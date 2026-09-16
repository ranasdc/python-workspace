import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { getSchoolOverview } from "@/app/actions/schools"
import { AppHeader } from "@/components/app-header"
import { SchoolOnboarding } from "@/components/school-onboarding"
import { SchoolDashboard } from "@/components/school-dashboard"

export const metadata = {
  title: "School",
  description: "Manage your school's plan, seats and invite codes.",
}

export default async function SchoolPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")

  const overview = await getSchoolOverview()

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        name={sessionUser.name}
        role={sessionUser.role === "teacher" ? "teacher" : "student"}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {overview ? (
          <SchoolDashboard overview={overview} />
        ) : (
          <SchoolOnboarding />
        )}
      </main>
    </div>
  )
}
