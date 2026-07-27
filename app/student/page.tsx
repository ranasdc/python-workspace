import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getStudentClasses } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspaceWithFreemium } from "@/components/student-workspace-with-freemium"
import { StudentOnboarding } from "@/components/student-onboarding"

export default async function StudentPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  if (sessionUser.role === "teacher") redirect("/teacher")

  const classes = await getStudentClasses()

  // Check if user has already chosen account type
  let hasChosenAccountType = false
  try {
    const userRecord = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, sessionUser.id))
      .limit(1)
    
    hasChosenAccountType = userRecord?.[0]?.accountType !== null && userRecord?.[0]?.accountType !== undefined
  } catch (error) {
    console.log("[v0] Could not fetch user account type, assuming not chosen yet")
  }

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      {classes.length === 0 && !hasChosenAccountType && <StudentOnboarding />}
      <StudentWorkspaceWithFreemium initialClasses={classes} />
    </div>
  )
}
