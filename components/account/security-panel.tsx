"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const MIN_LENGTH = 8

/**
 * Password management.
 *
 * The current password is required, so someone who walks up to an unlocked
 * laptop cannot lock the owner out of their own account. Other sessions are
 * revoked on success, which is the point of changing a password you think
 * someone else has seen.
 */
export function SecurityPanel({
  hasPassword,
  email,
}: {
  hasPassword: boolean
  email: string
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!hasPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            This account signs in without a password, so there is nothing to change
            here.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < MIN_LENGTH

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (next.length < MIN_LENGTH) {
      setError(`Your new password needs at least ${MIN_LENGTH} characters`)
      return
    }
    if (next !== confirm) {
      setError("The two new passwords do not match")
      return
    }

    setSaving(true)
    try {
      const { error: authError } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        // Anyone else already signed in as this user is signed out.
        revokeOtherSessions: true,
      })

      if (authError) {
        setError(authError.message ?? "Your current password was not correct")
        return
      }

      setCurrent("")
      setNext("")
      setConfirm("")
      toast.success("Password changed. Other devices have been signed out.")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          You sign in as {email}. Changing your password signs you out everywhere
          else.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          {/* The username field is hidden but present so password managers can
              associate the new password with the right account. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            hidden
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
            </Field>

            <Field data-invalid={tooShort || undefined}>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                aria-invalid={tooShort || undefined}
                onChange={(event) => setNext(event.target.value)}
                required
              />
              <FieldDescription>At least {MIN_LENGTH} characters.</FieldDescription>
            </Field>

            <Field data-invalid={mismatch || undefined}>
              <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={mismatch || undefined}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
              {mismatch && (
                <FieldDescription className="text-destructive">
                  These passwords do not match.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>

          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            disabled={saving || !current || !next || !confirm || mismatch || tooShort}
          >
            {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
