import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/session"
import { getEntitlement } from "@/lib/entitlements"
import { getHeaderIdentity } from "@/lib/account"
import { AppHeader } from "@/components/app-header"
import { StudentStarters } from "@/components/starters/student-starters"

export const metadata: Metadata = { title: "Daily Starter" }

export default async function StudentStartersPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  const { open } = await searchParams
  const openId = Number(open)
  const initialOpenId = Number.isInteger(openId) && openId > 0 ? openId : null
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  const entitlement = await getEntitlement(sessionUser.id)
  if (entitlement.isTeacher) redirect("/teacher")

  const identity = await getHeaderIdentity(sessionUser.id)

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader
        userId={sessionUser.id}
        name={sessionUser.name}
        email={sessionUser.email}
        avatarId={identity.avatarId}
        role="student"
        roleLabel={identity.roleLabel}
        schoolName={identity.schoolName}
        isSchoolAdmin={identity.isSchoolAdmin}
      />
      <main className="flex-1 overflow-y-auto">
        <StudentStarters initialOpenId={initialOpenId} />
      </main>
    </div>
  )
}
