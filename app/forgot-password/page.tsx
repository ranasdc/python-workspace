import { AuthShell } from "@/components/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata = {
  title: "Forgot password",
  description: "Reset your mycodepad password by email.",
  robots: { index: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return (
    <AuthShell>
      <ForgotPasswordForm initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthShell>
  )
}
