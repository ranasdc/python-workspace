"use client"

import { useEffect, useState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { deleteClass, getClassDeletionSummary } from "@/app/actions/classes"

type Summary = Awaited<ReturnType<typeof getClassDeletionSummary>>

function countLine(summary: Summary): string {
  const parts: string[] = []
  if (summary.students > 0) {
    parts.push(summary.students === 1 ? "1 student" : `${summary.students} students`)
  }
  if (summary.files > 0) {
    parts.push(summary.files === 1 ? "1 saved file" : `${summary.files} saved files`)
  }
  if (summary.starters > 0) {
    parts.push(summary.starters === 1 ? "1 starter" : `${summary.starters} starters`)
  }
  if (parts.length === 0) return "This class is empty."
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/**
 * Confirmation for deleting a class.
 *
 * Deleting takes a pupil's saved work with it and cannot be undone, so the
 * dialog does two things a plain "Are you sure?" cannot: it names exactly what
 * will be destroyed, counted from the database rather than guessed, and it
 * makes the teacher type the class name. That rules out a misplaced click
 * while leaving a deliberate deletion easy.
 */
export function DeleteClassDialog({
  classId,
  className,
  open,
  onOpenChange,
  onDeleted,
}: {
  classId: number
  className: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the class is gone, so the caller can move the selection. */
  onDeleted: () => void | Promise<void>
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [typed, setTyped] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Counts are read when the dialog opens so they describe the class as it is
  // now, not as it was when the dashboard first loaded.
  useEffect(() => {
    if (!open) return
    let active = true
    setSummary(null)
    setTyped("")
    getClassDeletionSummary(classId)
      .then((result) => {
        if (active) setSummary(result)
      })
      .catch(() => {
        if (!active) return
        toast.error("Could not check what this class contains")
        onOpenChange(false)
      })
    return () => {
      active = false
    }
  }, [open, classId, onOpenChange])

  // An empty class destroys nothing, so it is confirmed by the button alone.
  // Typing the name is reserved for a class that holds students or their work,
  // which keeps the friction proportionate to what is actually at stake.
  const hasWork = Boolean(summary && (summary.students > 0 || summary.files > 0))
  const confirmed =
    summary !== null && (!hasWork || typed.trim() === className.trim())

  async function handleDelete() {
    if (!confirmed) return
    setDeleting(true)
    try {
      const result = await deleteClass(classId)
      onOpenChange(false)
      await onDeleted()
      toast.success(`"${result.name}" has been deleted.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the class")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Delete {className}?</DialogTitle>
          <DialogDescription className="text-pretty">
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {summary === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Checking what this class contains
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {hasWork ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm text-pretty">
                  This permanently removes{" "}
                  <strong className="font-medium">{countLine(summary)}</strong>,
                  including the code your students have written here.
                </p>
                <p className="mt-2 text-xs text-muted-foreground text-pretty">
                  Your library and the tasks in it are not affected, and your
                  students keep their accounts.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-pretty">
                This class is empty, so no student work will be lost.
              </p>
            )}

            {hasWork && (
              <Field>
                <FieldLabel htmlFor="confirm-class-name">
                  Type the class name to confirm
                </FieldLabel>
                <Input
                  id="confirm-class-name"
                  value={typed}
                  autoComplete="off"
                  placeholder={className}
                  onChange={(event) => setTyped(event.target.value)}
                />
                <FieldDescription>
                  Enter {`"${className}"`} exactly as it appears above.
                </FieldDescription>
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Keep this class
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || deleting}
            onClick={handleDelete}
          >
            {deleting && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
