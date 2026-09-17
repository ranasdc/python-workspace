import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { getEntitlement } from "@/lib/entitlements"

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  const entitlement = await getEntitlement(user.id)
  if (entitlement.isTeacher) redirect("/teacher")
  redirect("/student")
}
