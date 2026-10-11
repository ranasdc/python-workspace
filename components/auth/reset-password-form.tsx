"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2, LockKeyhole, ShieldAlert } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/auth/password-input"
import { BackToSignIn, IconBadge } from "@/components/auth/forgot-password-form"
import { cn } from "@/lib/utils"

const rules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Upper & lower case letters", test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: "A number or symbol", test: (p: string) => /[\d\W_]/.test(p) },
]

const strengthLabels = ["Too weak", "Weak", "Good", "Strong"]
const strengthColors = ["bg-destructive", "bg-[#f59e0b]", "bg-primary", "bg-[#10b981]"]

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!token)

  const passed = rules.filter((r) => r.test(password)).length
  const mismatch = confirm.length > 0 && confirm !== password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password.length < 8) return setError("Password must be at least 8 characters.")
    if (password !== confirm) return setError("Passwords don't match.")

    setLoading(true)
    setError(null)
    const { error } = await authClient.resetPassword({ newPassword: password, token })
    setLoading(false)

    if (error) {
      if (error.code === "INVALID_TOKEN") return setExpired(true)
      return setError(error.message || "Could not reset your password. Please try again.")
    }
    router.push("/sign-in?reset=success")
  }

  if (expired) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">This link has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Reset links work once and expire after 1 hour. Request a new one to continue.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-primary to-[#6d5ce8] text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Request a new link
        </Link>
        <div className="mt-2 w-full">
          <BackToSignIn />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <IconBadge>
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </IconBadge>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          You&apos;ll be signed out on other devices once it&apos;s changed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            aria-describedby="password-strength"
            required
          />

          <div id="password-strength" className="mt-1">
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    password && i < Math.max(passed, 1) ? strengthColors[passed] : "bg-muted",
                  )}
                />
              ))}
            </div>
            {password && (
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                Strength: <span className="text-foreground">{strengthLabels[passed]}</span>
              </p>
            )}
            <ul className="mt-2 flex flex-col gap-1">
              {rules.map((rule) => {
                const ok = rule.test(password)
                return (
                  <li key={rule.label} className={cn("flex items-center gap-2 text-xs", ok ? "text-foreground" : "text-muted-foreground")}>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                        ok ? "border-[#10b981] bg-[#10b981] text-white" : "border-border",
                      )}
                    >
                      {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    {rule.label}
                    <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            aria-invalid={mismatch}
            required
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirm}
          className="mt-2 h-11 bg-gradient-to-r from-primary to-[#6d5ce8] text-base shadow-lg shadow-primary/25"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>

      <div className="mt-6">
        <BackToSignIn />
      </div>
    </div>
  )
}
