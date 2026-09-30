"use client"

import { useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { Loader2, School } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { joinSchoolWithCode } from "@/app/actions/schools"

/**
 * Lets a signed-in teacher redeem the teacher code their school administrator
 * shared. Works for every school plan (Small School, Large School, MAT) because
 * seats and access are resolved from the code's school, not the plan name.
 */
export function JoinSchoolDialog({
  trigger,
  redirectTo = "/teacher",
}: {
  trigger: ReactElement
  redirectTo?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    try {
      const result = await joinSchoolWithCode(formData)
      toast.success(
        result.alreadyMember
          ? "You're already a member of this school."
          : "You've joined your school. Full Pro access is now unlocked.",
      )
      setOpen(false)
      router.push(redirectTo)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join with that code")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <School className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Join your school</DialogTitle>
          <DialogDescription className="text-pretty">
            Enter the teacher code from your school administrator. Once you join, you get
            every Teacher Pro feature through your school at no personal cost.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-3">
          <Label htmlFor="join-school-code">Teacher code</Label>
          <Input
            id="join-school-code"
            name="code"
            placeholder="ABCD2345EFGH"
            autoComplete="off"
            className="font-mono uppercase"
            required
          />
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join school
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
