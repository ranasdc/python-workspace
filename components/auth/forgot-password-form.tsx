"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, KeyRound, Loader2, Mail, MailCheck } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
    setLoading(false)
    // Only rate limiting is surfaced; whether the account exists is never revealed.
    if (error?.status === 429) {
      setError("Too many requests. Please wait a minute and try again.")
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center">
        <IconBadge>
          <MailCheck className="h-6 w-6" aria-hidden="true" />
        </IconBadge>
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a
          link to reset your password. It expires in 1 hour.
        </p>

        <div className="mt-6 w-full rounded-lg border bg-muted/50 p-4 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Didn&apos;t get it?</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Check your spam or junk folder.</li>
            <li>School email filters can delay messages by a few minutes.</li>
            <li>Students can also ask their teacher for help.</li>
          </ul>
        </div>

        <div className="mt-6 flex w-full flex-col gap-2">
          <Button variant="outline" className="h-11" onClick={() => setSentTo(null)}>
            Try a different email
          </Button>
          <BackToSignIn />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <IconBadge>
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </IconBadge>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Enter the email you signed up with and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="h-11 pl-9"
              required
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-11 bg-gradient-to-r from-primary to-[#6d5ce8] text-base shadow-lg shadow-primary/25"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
      </form>

      <div className="mt-6">
        <BackToSignIn />
      </div>
    </div>
  )
}

export function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-primary text-white shadow-lg shadow-primary/25">
      {children}
    </span>
  )
}

export function BackToSignIn() {
  return (
    <Link
      href="/sign-in"
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to sign in
    </Link>
  )
}
