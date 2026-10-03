import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthShell } from "@/components/auth-shell"

export const metadata = {
  title: "Create a free account",
  description:
    "Create a free mycodepad account to code Python and HTML in your browser, or set up classes for your students.",
  alternates: { canonical: "/sign-up" },
}

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
