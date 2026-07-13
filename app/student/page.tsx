import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getStudentClasses } from "@/app/actions/classes"
import { AppHeader } from "@/components/app-header"
import { StudentWorkspace } from "@/components/student-workspace"

export default async function StudentPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role === "teacher") redirect("/teacher")

  const classes = await getStudentClasses()

  return (
    <div className="flex h-svh flex-col">
      <AppHeader name={user.name} role="student" />
      <StudentWorkspace initialClasses={classes} />
    </div>
  )
}
