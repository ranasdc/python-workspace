"use client"

import { useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2 } from "lucide-react"
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
import { joinClass } from "@/app/actions/classes"

export type JoinedClass = Awaited<ReturnType<typeof joinClass>>

/**
 * Lets a signed-in student redeem the class code their teacher gave them. If
 * the teacher's school has a plan, joining is what grants full Pro access, so
 * this sits beside every Student Pro price as the free alternative.
 */
export function JoinClassDialog({
  trigger,
  redirectTo = "/student",
  onJoined,
}: {
  trigger: ReactElement
  /** Where to land after joining. Ignored when `onJoined` is given. */
  redirectTo?: string
  /** Supplied by screens that add the class in place instead of navigating. */
  onJoined?: (joined: JoinedClass) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    try {
      const joined = await joinClass(formData)
      toast.success(`You've joined ${joined.name}.`)
      setOpen(false)
      if (onJoined) {
        onJoined(joined)
      } else {
        router.push(redirectTo)
        router.refresh()
      }
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
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Join your class</DialogTitle>
          <DialogDescription className="text-pretty">
            Enter the class code your teacher gave you. If your school has a plan, you get
            every Student Pro feature through them at no cost to you.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-3">
          <Label htmlFor="join-class-code">Class code</Label>
          <Input
            id="join-class-code"
            name="joinCode"
            placeholder="ABC123"
            autoComplete="off"
            className="font-mono uppercase"
            required
          />
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
