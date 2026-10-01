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
import type { AccountProfile } from "@/lib/account"

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
 * Only the display name is editable. Email is the sign-in identity, and role
 * and school are granted by the school that owns them — presenting those as
 * read-only facts is deliberate, so nobody expects to promote themselves by
 * typing in a box.
 */
export function ProfilePanel({ profile }: { profile: AccountProfile }) {
  const router = useRouter()
  const [name, setName] = useState(profile.user.name)
  const [saving, setSaving] = useState(false)

  const dirty = name.trim() !== profile.user.name.trim()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty) return

    setSaving(true)
    try {
      const data = new FormData()
      data.set("name", name)
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
              <Field>
                <FieldLabel htmlFor="account-name">Display name</FieldLabel>
                <Input
                  id="account-name"
                  name="name"
                  value={name}
                  maxLength={80}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                />
                <FieldDescription>Between 2 and 80 characters.</FieldDescription>
              </Field>

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
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => setName(profile.user.name)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!dirty || saving}>
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
