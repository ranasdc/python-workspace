import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthShell } from "@/components/auth-shell"

export default async function SignUpPage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")
  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
