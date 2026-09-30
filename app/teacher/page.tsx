import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { getTeacherClasses, getTeacherPlanStatus } from "@/app/actions/classes"
import { getEntitlement } from "@/lib/entitlements"
import { AppHeader } from "@/components/app-header"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { WelcomeOnboarding } from "@/components/welcome-onboarding"

export default async function TeacherPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")

  // Routing follows the entitlement engine, not the session's self-declared
  // role, so a school teacher who signed up as a student still lands here.
  const entitlement = await getEntitlement(user.id)
  if (!entitlement.isTeacher) redirect("/student")

  const [classes, planStatus] = await Promise.all([
    getTeacherClasses(),
    getTeacherPlanStatus(),
  ])

  // On a read failure, assume onboarded: a missed welcome screen is better than
  // showing it to someone who has already made their choice.
  let onboarded = true
  try {
    const [record] = await db
      .select({ onboardedAt: userTable.onboardedAt })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1)
    onboarded = Boolean(record?.onboardedAt)
  } catch (error) {
    console.error("[teacher] failed to read onboardedAt:", error)
  }

  // A teacher who already has Pro, or who belongs to a school, has nothing
  // left to choose.
  const showOnboarding =
    !onboarded && !entitlement.hasTeacherPro && entitlement.schoolId === null

  return (
    <div className="flex h-svh flex-col">
      <AppHeader
        name={user.name}
        role="teacher"
        isSchoolAdmin={entitlement.schoolRole === "school_admin" && !entitlement.schoolUnpaid}
      />
      <TeacherDashboard initialClasses={classes} planStatus={planStatus} />
      {showOnboarding && <WelcomeOnboarding role="teacher" />}
    </div>
  )
}
