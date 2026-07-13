import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role === "teacher") redirect("/teacher")
  redirect("/student")
}
