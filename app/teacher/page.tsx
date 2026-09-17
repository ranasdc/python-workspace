import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getTeacherClasses, getTeacherPlanStatus } from "@/app/actions/classes"
import { getEntitlement } from "@/lib/entitlements"
import { AppHeader } from "@/components/app-header"
import { TeacherDashboard } from "@/components/teacher-dashboard"

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

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={user.name} role="teacher" />
      <TeacherDashboard initialClasses={classes} planStatus={planStatus} />
    </div>
  )
}
