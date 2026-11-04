"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import { Badge } from "@/components/ui/badge"
import { updateDisplayName } from "@/app/actions/account"
import { AvatarPicker } from "@/components/account/avatar-picker"
import { UserAvatar } from "@/components/user-avatar"
import { resolveAvatar } from "@/lib/avatars"
import type { AccountProfile } from "@/lib/account"
import {
  NAME_MAX_LENGTH,
  composeDisplayName,
  normalizeName,
  validateName,
} from "@/lib/validation/account"

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Name, email, role and school.
 *
 * Only the name is editable. Email is the sign-in identity, and role
 * and school are granted by the school that owns them — presenting those as
 * read-only facts is deliberate, so nobody expects to promote themselves by
 * typing in a box.
 */
export function ProfilePanel({ profile }: { profile: AccountProfile }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(profile.user.firstName)
  const [lastName, setLastName] = useState(profile.user.lastName)
  const [saving, setSaving] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  const avatar = resolveAvatar(profile.user.id, profile.user.avatarId)

  // The same checks the action runs, so Save is enabled exactly when a save
  // would succeed.
  const firstProblem = validateName(firstName, "first")
  const lastProblem = validateName(lastName, "last")
  const dirty =
    normalizeName(firstName) !== normalizeName(profile.user.firstName) ||
    normalizeName(lastName) !== normalizeName(profile.user.lastName)

  function reset() {
    setFirstName(profile.user.firstName)
    setLastName(profile.user.lastName)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || firstProblem || lastProblem) return

    setSaving(true)
    try {
      const data = new FormData()
      data.set("firstName", firstName)
      data.set("lastName", lastName)
      const result = await updateDisplayName(data)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success("Your name has been updated.")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile avatar</CardTitle>
          <CardDescription>
            Choose an avatar from the MyCodePad collection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              userId={profile.user.id}
              name={profile.user.name}
              avatarId={profile.user.avatarId}
              className="size-16"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{avatar.name}</span>
              <span className="text-xs text-muted-foreground">
                Shown beside your name across MyCodePad.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => setAvatarOpen(true)}
            >
              Change avatar
            </Button>
          </div>
        </CardContent>
      </Card>

      <AvatarPicker
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        userId={profile.user.id}
        name={profile.user.name}
        currentAvatarId={profile.user.avatarId}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            {profile.entitlement.isTeacher
              ? "This is the name your students see on their work and feedback."
              : "This is the name your teacher and classmates see."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(firstProblem) || undefined}>
                  <FieldLabel htmlFor="account-first-name">First name</FieldLabel>
                  <Input
                    id="account-first-name"
                    name="firstName"
                    value={firstName}
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="given-name"
                    aria-invalid={Boolean(firstProblem)}
                    aria-describedby={firstProblem ? "account-first-name-error" : undefined}
                    onChange={(event) => setFirstName(event.target.value)}
                    onBlur={() => setFirstName(normalizeName(firstName))}
                  />
                  {firstProblem && (
                    <FieldDescription
                      id="account-first-name-error"
                      className="text-destructive"
                    >
                      {firstProblem}
                    </FieldDescription>
                  )}
                </Field>

                <Field data-invalid={Boolean(lastProblem) || undefined}>
                  <FieldLabel htmlFor="account-last-name">Last name</FieldLabel>
                  <Input
                    id="account-last-name"
                    name="lastName"
                    value={lastName}
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="family-name"
                    aria-invalid={Boolean(lastProblem)}
                    aria-describedby={lastProblem ? "account-last-name-error" : undefined}
                    onChange={(event) => setLastName(event.target.value)}
                    onBlur={() => setLastName(normalizeName(lastName))}
                  />
                  {lastProblem && (
                    <FieldDescription id="account-last-name-error" className="text-destructive">
                      {lastProblem}
                    </FieldDescription>
                  )}
                </Field>
              </div>

              <FieldDescription>
                {/* Accounts that pre-date the split may have only a first name
                    stored, so the last name can legitimately start out empty
                    and is asked for the first time a name is saved. */}
                Shown across MyCodePad as{" "}
                <span className="font-medium text-foreground">
                  {composeDisplayName(firstName, lastName) || "your name"}
                </span>
                .
              </FieldDescription>

              <Field>
                <FieldLabel htmlFor="account-email">Email</FieldLabel>
                <Input
                  id="account-email"
                  value={profile.user.email}
                  readOnly
                  disabled
                  autoComplete="email"
                />
                <FieldDescription>
                  You sign in with this address. Contact support to change it.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            {dirty && (
              <Button type="button" variant="ghost" disabled={saving} onClick={reset}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={!dirty || saving || Boolean(firstProblem) || Boolean(lastProblem)}
            >
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role and school</CardTitle>
          <CardDescription>
            {profile.membership
              ? "Set by your school. These cannot be changed here."
              : "Your role is set when you sign up and cannot be changed here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary">{profile.roleLabel}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">School</dt>
              <dd className="text-sm font-medium">
                {profile.membership?.schoolName ?? (
                  <span className="font-normal text-muted-foreground">
                    No school — you use mycodepad independently
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Member since</dt>
              <dd className="text-sm font-medium">{formatDate(profile.user.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
