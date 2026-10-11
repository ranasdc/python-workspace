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
  searchParams: Promise<{ next?: string; reset?: string }>
}) {
  const user = await getSessionUser()
  const { next, reset } = await searchParams
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard")
  return (
    <AuthShell>
      <AuthForm mode="sign-in" next={next} resetSuccess={reset === "success"} />
    </AuthShell>
  )
}
