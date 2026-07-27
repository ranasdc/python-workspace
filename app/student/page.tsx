import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { getStudentClasses } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspaceWithFreemium } from "@/components/student-workspace-with-freemium"
import { StudentOnboarding } from "@/components/student-onboarding"
import { eq } from "drizzle-orm"

export default async function StudentPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  if (sessionUser.role === "teacher") redirect("/teacher")

  // Get user's current subscription status
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, sessionUser.id),
  })

  const classes = await getStudentClasses()
  const isFirstLogin = user?.isFirstLogin ?? true
  const accountType = user?.accountType

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      {isFirstLogin && !accountType && <StudentOnboarding />}
      <StudentWorkspaceWithFreemium initialClasses={classes} />
    </div>
  )
}
