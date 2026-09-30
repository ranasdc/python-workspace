import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/session"
import { getEntitlement } from "@/lib/entitlements"
import { WarmupPresenter } from "@/components/starters/warmup-presenter"

export const metadata: Metadata = { title: "Classroom warm-up" }

export default async function WarmupPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  const entitlement = await getEntitlement(sessionUser.id)
  if (!entitlement.isTeacher) redirect("/student")

  const { id } = await params
  const starterId = Number(id)
  if (!Number.isInteger(starterId) || starterId <= 0) notFound()

  return <WarmupPresenter starterId={starterId} />
}
