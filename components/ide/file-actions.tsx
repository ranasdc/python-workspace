"use client"

/**
 * The file and folder management controls shared by every IDE.
 *
 * The student workspace and the teacher library both render these, and both
 * are themselves shared across IDEs, so the Python and HTML trees get the same
 * three-dot menu, rename dialog and delete confirmation — as will any IDE
 * added later. Nothing here knows which IDE it is in, or who is allowed to do
 * what: a caller passes only the actions its user may take, and the server
 * action behind each one checks ownership again.
 */

import { useId, useState, type FormEvent, type ReactNode } from "react"
import useSWR from "swr"
import { AlertTriangle, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MAX_NAME_LENGTH,
  validateFileRename,
  validateFolderRename,
  type RenameOutcome,
} from "@/lib/ide/file-management"
import type { LanguageId } from "@/lib/ide/languages"
import { cn } from "@/lib/utils"

/**
 * The three-dot menu beside a file or folder.
 *
 * Only the actions it is given are listed, and with none it renders nothing,
 * so a row the user cannot manage shows no menu at all rather than an empty
 * one.
 */
export function ItemActionsMenu({
  itemName,
  onRename,
  onDelete,
  className,
}: {
  itemName: string
  onRename?: () => void
  onDelete?: () => void
  className?: string
}) {
  if (!onRename && !onDelete) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          />
        }
        aria-label={`More actions for ${itemName}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onRename && (
          <DropdownMenuItem onClick={onRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type RenameProps = {
  kind: "file" | "folder"
  currentName: string
  /** The IDE the file belongs to. Needed for files, ignored for folders. */
  language?: LanguageId
  /** Extra context under the field, e.g. that students will see the change. */
  note?: ReactNode
  onRename: (name: string) => Promise<RenameOutcome>
}

/** Rename dialog for a file or a folder, in any IDE. */
export function RenameDialog({
  open,
  onOpenChange,
  ...form
}: RenameProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The form lives inside the content, which only mounts while the
            dialog is open, so every opening starts from the current name. */}
        <RenameForm {...form} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({
  kind,
  currentName,
  language,
  note,
  onRename,
  onClose,
}: RenameProps & { onClose: () => void }) {
  const fieldId = useId()
  const errorId = useId()
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dot = currentName.lastIndexOf(".")
  const extension = kind === "file" && dot > 0 ? currentName.slice(dot) : ""

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    // The same rules the server applies, run first so a mistake is caught
    // without a round trip. The server runs them again and has the final say.
    const checked =
      kind === "file" && language
        ? validateFileRename(currentName, name, language)
        : validateFolderRename(currentName, name)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    if (checked.unchanged) {
      onClose()
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await onRename(checked.name)
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(`Renamed to ${result.name}`, { description: result.notice })
      onClose()
    } catch {
      setError("Could not rename. Nothing was changed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{kind === "file" ? "Rename file" : "Rename folder"}</DialogTitle>
        <DialogDescription>
          Current name: <span className="break-all font-medium text-foreground">{currentName}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>New name</Label>
        <Input
          id={fieldId}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
          onFocus={(event) => {
            // Select the part people actually change, leaving the ending alone.
            const end = extension ? currentName.length - extension.length : currentName.length
            event.target.setSelectionRange(0, end)
          }}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-destructive text-pretty">
            {error}
          </p>
        ) : kind === "file" && extension ? (
          <p className="text-xs text-muted-foreground">
            {`The ${extension} ending is kept, and added back if you leave it off.`}
          </p>
        ) : kind === "folder" ? (
          <p className="text-xs text-muted-foreground">
            Everything inside the folder stays exactly where it is.
          </p>
        ) : null}
        {note && <p className="text-xs text-muted-foreground text-pretty">{note}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

export type DeleteReach = { students: number; classes: number }

function count(value: number, noun: string, many = `${noun}s`) {
  return `${value.toLocaleString("en-GB")} ${value === 1 ? noun : many}`
}

/**
 * Confirmation for a teacher deleting a file or folder from their library.
 *
 * Deleting the original also takes it away from every student it was
 * distributed to, so the dialog looks up how many that is and says so before
 * the Delete button can be pressed.
 */
export function DeleteResourceDialog({
  open,
  onOpenChange,
  kind,
  name,
  reachKey,
  loadReach,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: "file" | "folder"
  name: string
  /** Identifies the item for caching the lookup below. */
  reachKey: string
  loadReach: () => Promise<DeleteReach>
  /** Resolves to an error message, or null when the delete went through. */
  onDelete: () => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  // Looked up only while the dialog is open, and afresh each time: who holds a
  // copy can change between one opening and the next.
  const {
    data: reach,
    error: reachError,
    isLoading,
  } = useSWR(open ? ["library-item-reach", reachKey] : null, loadReach, {
    revalidateOnFocus: false,
    dedupingInterval: 0,
  })
  const distributed = (reach?.students ?? 0) > 0

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      const failure = await onDelete()
      if (failure) {
        toast.error(failure)
        return
      }
      onOpenChange(false)
    } catch {
      toast.error(`Could not delete this ${kind}. Nothing was changed. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "file" ? "Delete file?" : "Delete folder?"}</DialogTitle>
          <DialogDescription className="text-pretty">
            Are you sure you want to delete{" "}
            <span className="break-all font-medium text-foreground">{name}</span>
            {kind === "folder"
              ? "? Everything inside it goes too, including any folders it contains."
              : "?"}{" "}
            It is removed from your library and this can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="text-sm leading-relaxed text-pretty">
          {isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking who has received this {kind}...
            </p>
          ) : reachError ? (
            <p className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                We could not check who has received this {kind}. If it was distributed, students
                who received it will no longer be able to access it.
              </span>
            </p>
          ) : distributed && reach ? (
            <p className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                {`This ${kind} was distributed to ${count(reach.students, "student")} in ${count(reach.classes, "class", "classes")}. `}
                {reach.students === 1 ? "They" : "They all"} will no longer be able to access it,
                including any work they have done in their copy.
              </span>
            </p>
          ) : (
            <p className="rounded-md bg-muted/50 px-3 py-2.5 text-muted-foreground">
              This {kind} has not been distributed, so no students are affected.
            </p>
          )}
        </div>

        {distributed && (
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Files and folders students created themselves are never deleted
            {kind === "folder"
              ? ". A folder still holding a student's own work stays with that student."
              : "."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || isLoading}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
