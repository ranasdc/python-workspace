import { AuthShell } from "@/components/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata = {
  title: "Reset password",
  description: "Choose a new password for your mycodepad account.",
  robots: { index: false },
  referrer: "no-referrer" as const,
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams
  const validToken = !error && typeof token === "string" && token.length > 0 ? token : null
  return (
    <AuthShell>
      <ResetPasswordForm token={validToken} />
    </AuthShell>
  )
}
