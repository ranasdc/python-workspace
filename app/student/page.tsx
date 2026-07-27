import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getStudentClasses } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspaceWithFreemium } from "@/components/student-workspace-with-freemium"
import { StudentOnboarding } from "@/components/student-onboarding"

export default async function StudentPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  if (sessionUser.role === "teacher") redirect("/teacher")

  const classes = await getStudentClasses()

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      <StudentOnboarding />
      <StudentWorkspaceWithFreemium initialClasses={classes} />
    </div>
  )
}
