"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { removeStudentFromClass } from "@/app/actions/classes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Confirmation for taking a student out of one class.
 *
 * The wording is careful about scope because "remove" is easy to read as
 * "delete": it names the student and the class, says what they lose, and says
 * what stays — their account, their other classes and the work they saved.
 */
export function RemoveStudentDialog({
  classId,
  className,
  student,
  open,
  onOpenChange,
  onRemoved,
}: {
  classId: number
  className: string
  /** Kept while the dialog closes, so its text does not vanish mid-animation. */
  student: { id: string; name: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: (studentId: string) => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function handleRemove() {
    // A second click while the first request is in flight does nothing; the
    // server treats a repeat as already done in any case.
    if (busy || !student) return
    setBusy(true)
    try {
      await removeStudentFromClass(classId, student.id)
      toast.success(`${student.name} was removed from ${className}`)
      await onRemoved(student.id)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the student")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove from class?</DialogTitle>
          <DialogDescription className="text-pretty">
            Are you sure you want to remove{" "}
            <span className="font-medium text-foreground">{student?.name ?? "this student"}</span>{" "}
            from <span className="font-medium text-foreground">{className}</span>? They will no
            longer have access to this class and its class-specific resources.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
          This only takes them out of this class. Their MyCodePad account, their other classes and
          the work they saved here are all kept, and their work returns if they rejoin with the
          class code.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={busy || !student}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Remove from class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
