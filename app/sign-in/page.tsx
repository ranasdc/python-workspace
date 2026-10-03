import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthShell } from "@/components/auth-shell"

export const metadata = {
  title: "Sign in",
  description: "Sign in to mycodepad to open your Python and HTML workspaces and classes.",
  alternates: { canonical: "/sign-in" },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getSessionUser()
  const { next } = await searchParams
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard")
  return (
    <AuthShell>
      <AuthForm mode="sign-in" next={next} />
    </AuthShell>
  )
}
