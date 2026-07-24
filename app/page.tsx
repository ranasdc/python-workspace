import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { LandingPage } from "@/components/landing-page"

export default async function HomePage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")

  return <LandingPage />
}
