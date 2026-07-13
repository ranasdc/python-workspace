import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getTeacherClasses } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { TeacherDashboard } from "@/components/teacher-dashboard"

export default async function TeacherPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role !== "teacher") redirect("/student")

  const classes = await getTeacherClasses()

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={user.name} role="teacher" />
      <TeacherDashboard initialClasses={classes} />
    </div>
  )
}
