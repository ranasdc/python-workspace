import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getStudentClasses, ensurePersonalWorkspace } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspaceWithFreemium } from "@/components/student-workspace-with-freemium"
import { StudentOnboarding } from "@/components/student-onboarding"

export default async function StudentPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  if (sessionUser.role === "teacher") redirect("/teacher")

  let classes = await getStudentClasses()

  // Determine if the user has already chosen an account type.
  let accountType: string | null = null
  try {
    const [record] = await db
      .select({ accountType: userTable.accountType })
      .from(userTable)
      .where(eq(userTable.id, sessionUser.id))
      .limit(1)
    accountType = record?.accountType ?? null
  } catch (error) {
    console.error("[v0] Failed to read accountType:", error)
  }

  // Individual users have no teacher-led class, but the file system is keyed on
  // a class. Auto-provision a personal workspace so they can create/run files.
  if (accountType === "individual" && classes.length === 0) {
    await ensurePersonalWorkspace()
    classes = await getStudentClasses()
  }

  // Show onboarding only if the user hasn't chosen an account type
  // and hasn't joined any class yet.
  const showOnboarding = !accountType && classes.length === 0

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      {showOnboarding && <StudentOnboarding />}
      <StudentWorkspaceWithFreemium initialClasses={classes} />
    </div>
  )
}
