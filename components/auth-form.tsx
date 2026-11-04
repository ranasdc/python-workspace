"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { checkExistingAccount } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, BookOpen, Loader2, CheckCircle2 } from "lucide-react"
import { PasswordInput } from "@/components/auth/password-input"
import { PasswordRequirements } from "@/components/auth/password-requirements"
import { LegalLinkRow, PrivacyNotice } from "@/components/legal/legal-links"
import { LogoIcon, LogoWordmark } from "@/components/logo"
import { cn } from "@/lib/utils"
import {
  NAME_MAX_LENGTH,
  composeDisplayName,
  normalizeName,
  validateName,
  validatePassword,
} from "@/lib/validation/account"

type Mode = "sign-in" | "sign-up"

/**
 * Enough to catch a typo like a missing "@" or domain, without pretending to
 * know which addresses exist. Anything stricter starts rejecting valid ones.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Only same-origin paths are followed, so a crafted `?next=` cannot bounce a
 * freshly signed-in user to another site.
 */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null
}

export function AuthForm({
  mode,
  next,
  resetSuccess = false,
}: {
  mode: Mode
  next?: string
  resetSuccess?: boolean
}) {
  const router = useRouter()
  const destination = safeNext(next)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<"student" | "teacher">(
    destination === "/school" ? "teacher" : "student",
  )
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  // A field's problem is only shown once the user has left it, so the form
  // does not open covered in complaints about fields nobody has filled in yet.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const blur = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }))

  const isSignUp = mode === "sign-up"

  // The same functions the server runs, so the button is enabled exactly when
  // the request would be accepted.
  const problems = {
    firstName: isSignUp ? validateName(firstName, "first") : null,
    lastName: isSignUp ? validateName(lastName, "last") : null,
    email: !email.trim()
      ? "Please enter your email address."
      : EMAIL_SHAPE.test(email.trim())
        ? null
        : "Please enter a valid email address.",
    password: isSignUp ? validatePassword(password) : null,
    confirm: isSignUp && confirm !== password ? "Both passwords must match." : null,
  }
  const incomplete = isSignUp
    ? Object.values(problems).some(Boolean) || !confirm
    : !email.trim() || !password

  /** Shows a field's problem only once it has been visited. */
  function problemFor(field: keyof typeof problems) {
    return touched[field] ? problems[field] : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === "sign-up") {
        const existing = await checkExistingAccount(email)
        if (existing) {
          setError(
            `This email is already associated with a ${existing} account. Please sign in instead.`,
          )
          return
        }
        const { error } = await authClient.signUp.email({
          email,
          password,
          // Sent for Better Auth's own required field; the server recomputes it
          // from the two parts below rather than trusting this value.
          name: composeDisplayName(firstName, lastName),
          // custom fields registered in lib/auth.ts
          firstName: normalizeName(firstName),
          lastName: normalizeName(lastName),
          role,
        } as Parameters<typeof authClient.signUp.email>[0])
        if (error) {
          if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
            const role = await checkExistingAccount(email)
            throw new Error(
              role
                ? `This email is already associated with a ${role} account. Please sign in instead.`
                : "An account with this email already exists. Please sign in instead.",
            )
          }
          throw new Error(error.message || "Could not create account")
        }
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message || "Invalid email or password")
      }
      router.push(destination ?? "/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoIcon className="mb-4 h-14 w-14" />
        {resetSuccess && mode === "sign-in" && (
          <p
            role="status"
            className="mb-5 flex w-full items-center gap-2 rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-3 py-2.5 text-left text-sm text-foreground"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10b981]" aria-hidden="true" />
            Password updated. Sign in with your new password.
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {mode === "sign-up" ? (
            <>
              Create your <LogoWordmark className="text-2xl" /> account
            </>
          ) : (
            <>
              Welcome back to <LogoWordmark className="text-2xl" />
            </>
          )}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          {mode === "sign-up"
            ? "Set up your classroom or join one to start coding."
            : "Sign in to access your coding workspace."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <div className="flex flex-col gap-2">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                active={role === "student"}
                onClick={() => setRole("student")}
                icon={<BookOpen className="h-5 w-5" />}
                title="Student"
                subtitle="Write & run code"
              />
              <RoleCard
                active={role === "teacher"}
                onClick={() => setRole("teacher")}
                icon={<GraduationCap className="h-5 w-5" />}
                title="Teacher"
                subtitle="Review submissions"
              />
            </div>
          </div>
        )}

        {mode === "sign-up" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="first-name"
              maxLength={NAME_MAX_LENGTH}
              label="First name"
              value={firstName}
              onChange={setFirstName}
              /* Tidied on the way out of the field rather than on every
                 keystroke, which would fight the cursor mid-word. */
              onBlur={() => {
                setFirstName(normalizeName(firstName))
                blur("firstName")()
              }}
              problem={problemFor("firstName")}
              autoComplete="given-name"
              placeholder="Ada"
            />
            <TextField
              id="last-name"
              maxLength={NAME_MAX_LENGTH}
              label="Last name"
              value={lastName}
              onChange={setLastName}
              onBlur={() => {
                setLastName(normalizeName(lastName))
                blur("lastName")()
              }}
              problem={problemFor("lastName")}
              autoComplete="family-name"
              placeholder="Lovelace"
            />
          </div>
        )}

        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={blur("email")}
          problem={mode === "sign-up" ? problemFor("email") : null}
          autoComplete="email"
          placeholder="you@school.edu"
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={blur("password")}
            placeholder="••••••••"
            aria-describedby={mode === "sign-up" ? "password-requirements" : undefined}
            aria-invalid={mode === "sign-up" && Boolean(problemFor("password"))}
            /* No minLength in sign-in: an existing account's password is only
               ever being checked here, never re-chosen. */
            minLength={mode === "sign-up" ? 8 : undefined}
            required
          />
          {mode === "sign-up" && (
            <PasswordRequirements id="password-requirements" password={password} />
          )}
        </div>

        {mode === "sign-up" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={blur("confirm")}
              placeholder="Type it again"
              aria-invalid={Boolean(problemFor("confirm"))}
              required
            />
            {problemFor("confirm") && (
              <p className="text-xs text-destructive">{problemFor("confirm")}</p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {mode === "sign-up" && (
          /* The notice sits above the button, where it is read before the
             account exists rather than after. It is information, not a consent
             gate: nothing here relies on consent as its lawful basis, so a tick
             box would imply a choice the user does not actually have. */
          <PrivacyNotice>
            We only need your name, email and password to create the account. By continuing you
            agree to our{" "}
            <Link href="/terms" className="font-medium text-foreground hover:underline">
              Terms of Service
            </Link>
            , and the{" "}
            <Link href="/privacy" className="font-medium text-foreground hover:underline">
              Privacy Policy
            </Link>{" "}
            explains what we do with it. If your school set up your account, read your
            school&apos;s privacy notice too.
          </PrivacyNotice>
        )}

        <Button type="submit" disabled={loading || incomplete} className="mt-2">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>

        {mode === "sign-in" && (
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
            className="text-center text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link
              href={destination ? `/sign-in?next=${encodeURIComponent(destination)}` : "/sign-in"}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            {"Don't have an account? "}
            <Link
              href={destination ? `/sign-up?next=${encodeURIComponent(destination)}` : "/sign-up"}
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </>
        )}
      </p>

      <LegalLinkRow className="mt-6 justify-center text-xs" />
    </div>
  )
}

/**
 * A labelled input whose error sits directly beneath it.
 *
 * The message is tied to the input with aria-describedby and the input is
 * marked aria-invalid, so a screen reader reaches the explanation from the
 * field itself instead of hunting for a banner at the top of the form.
 */
function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  problem,
  type = "text",
  autoComplete,
  placeholder,
  maxLength,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  problem: string | null
  type?: string
  autoComplete?: string
  placeholder?: string
  maxLength?: number
}) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(problem)}
        aria-describedby={problem ? errorId : undefined}
        required
      />
      {problem && (
        <p id={errorId} className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </button>
  )
}
