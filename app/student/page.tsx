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

  // Show onboarding only if user has no classes
  // Individual users will have no classes initially, then get the onboarding
  // Once they choose, we show the workspace
  const showOnboarding = classes.length === 0

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      {showOnboarding && <StudentOnboarding />}
      <StudentWorkspaceWithFreemium initialClasses={classes} />
    </div>
  )
}
