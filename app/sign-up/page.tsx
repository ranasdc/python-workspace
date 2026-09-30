import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthShell } from "@/components/auth-shell"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getSessionUser()
  const { next } = await searchParams
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard")
  return (
    <AuthShell>
      <AuthForm mode="sign-up" next={next} />
    </AuthShell>
  )
}
