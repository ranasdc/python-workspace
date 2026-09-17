"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSchool, joinSchoolWithCode } from "@/app/actions/schools"

export function SchoolOnboarding() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  async function handleCreate(formData: FormData) {
    setCreating(true)
    try {
      await createSchool(formData)
      toast.success("School created. You are its administrator.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the school")
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(formData: FormData) {
    setJoining(true)
    try {
      await joinSchoolWithCode(formData)
      toast.success("You've joined your school.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join with that code")
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Join your school</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Enter the invite code from your school administrator. Everyone in a subscribed
          school gets full Pro access.
        </p>
        <form action={handleJoin} className="mt-4 flex flex-col gap-3">
          <Label htmlFor="code">Invite code</Label>
          <Input
            id="code"
            name="code"
            placeholder="ABCD2345EFGH"
            autoComplete="off"
            className="font-mono uppercase"
            required
          />
          <Button type="submit" disabled={joining}>
            {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join school
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Set up a new school</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Create your school to become its administrator, then choose a plan and invite
          your teachers and students.
        </p>
        <form action={handleCreate} className="mt-4 flex flex-col gap-3">
          <Label htmlFor="name">School name</Label>
          <Input id="name" name="name" placeholder="Northgate High School" required />
          <Button type="submit" variant="outline" disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create school
          </Button>
        </form>
      </section>
    </div>
  )
}
