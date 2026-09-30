import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getStudentClasses, ensurePersonalWorkspace } from "@/app/actions/classes"
import { getEntitlement } from "@/lib/entitlements"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspaceWithFreemium } from "@/components/student-workspace-with-freemium"
import { WelcomeOnboarding } from "@/components/welcome-onboarding"
import { DEFAULT_LANGUAGE, isLanguageId, type LanguageId } from "@/lib/ide/languages"

export default async function StudentPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")

  const entitlement = await getEntitlement(sessionUser.id)
  if (entitlement.isTeacher) redirect("/teacher")

  let classes = await getStudentClasses()
  // A personal workspace is created automatically below, so only a real class
  // counts as "this pupil already found their way in".
  const hasJoinedClass = classes.some((c) => !c.isPersonal)

  // Which IDE they were last using, so the workspace resumes where they left off.
  let initialLanguage: LanguageId = DEFAULT_LANGUAGE
  // On a read failure, assume onboarded: a missed welcome screen is better than
  // showing it to someone who has already made their choice.
  let onboarded = true
  try {
    const [record] = await db
      .select({ lastIde: userTable.lastIde, onboardedAt: userTable.onboardedAt })
      .from(userTable)
      .where(eq(userTable.id, sessionUser.id))
      .limit(1)
    // A stale or unknown value simply falls back to the default IDE.
    if (isLanguageId(record?.lastIde)) initialLanguage = record.lastIde
    onboarded = Boolean(record?.onboardedAt)
  } catch (error) {
    // Safe to swallow: this only picks which IDE opens first.
    console.error("[student] failed to read lastIde:", error)
  }

  // Anyone who already bought Student Pro, or is covered by a school, has
  // nothing left to choose.
  const showOnboarding = !onboarded && !hasJoinedClass && !entitlement.isPro

  // The file system is keyed on a class, so students who haven't joined one yet
  // get a personal workspace and can join a class later from the workspace.
  if (classes.length === 0) {
    await ensurePersonalWorkspace()
    classes = await getStudentClasses()
  }

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={sessionUser.name} role="student" />
      <StudentWorkspaceWithFreemium
        initialClasses={classes}
        initialLanguage={initialLanguage}
      />
      {showOnboarding && <WelcomeOnboarding role="student" />}
    </div>
  )
}
