"use client"

import { useId, useMemo, useState, type ReactElement, type ReactNode } from "react"
import { ArrowLeft, Check, Loader2, Search, Send, User, UserCheck, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RecipientSelection } from "@/lib/distribution"
import { cn } from "@/lib/utils"

export type DistributeClassOption = {
  id: number
  name: string
  /** Lets the teacher be left out of their own class's recipient list. */
  teacherId?: string
  students: { id: string; name: string; email: string }[]
}

type Mode = "class" | "selected" | "individual"

const MODES: { id: Mode; label: string; icon: typeof Users }[] = [
  { id: "individual", label: "Individual student", icon: User },
  { id: "selected", label: "Selected students", icon: UserCheck },
  { id: "class", label: "Entire class", icon: Users },
]

function studentCount(count: number) {
  return `${count} student${count === 1 ? "" : "s"}`
}

/**
 * Sends a library file or folder to one student, a chosen set, or a whole
 * class.
 *
 * It is two steps on purpose. Choosing who and confirming it are separate
 * screens, so the last thing a teacher sees before work lands in pupils'
 * workspaces is the exact list of who is about to receive it.
 */
export function DistributeDialog({
  classes,
  itemName,
  itemKind,
  note,
  trigger,
  onConfirm,
}: {
  classes: DistributeClassOption[]
  /** The file or folder being sent, as it is named in the library. */
  itemName: string
  itemKind: "file" | "folder"
  /** Extra detail about what is being sent, shown under the title. */
  note?: string
  trigger?: ReactNode
  onConfirm: (
    classId: number,
    recipients: RecipientSelection,
  ) => Promise<{ delivered: number; recipients: number }>
}) {
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"choose" | "review">("choose")
  const [classId, setClassId] = useState<string>(classes[0] ? String(classes[0].id) : "")
  const [mode, setMode] = useState<Mode>("class")
  const [individualId, setIndividualId] = useState("")
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  const activeClass = classes.find((c) => String(c.id) === classId) ?? classes[0] ?? null

  // The server never sends work to the class's own teacher, so the list does
  // not offer them either.
  const students = useMemo(
    () =>
      (activeClass?.students ?? [])
        .filter((student) => student.id !== activeClass?.teacherId)
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    [activeClass],
  )

  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return students
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(needle) || student.email.toLowerCase().includes(needle),
    )
  }, [students, query])

  const recipients = useMemo(() => {
    if (mode === "class") return students
    if (mode === "individual") return students.filter((student) => student.id === individualId)
    return students.filter((student) => selectedIds.has(student.id))
  }, [mode, students, individualId, selectedIds])

  const allVisibleSelected =
    visibleStudents.length > 0 && visibleStudents.every((student) => selectedIds.has(student.id))
  const noVisibleSelected = visibleStudents.every((student) => !selectedIds.has(student.id))

  function handleOpenChange(next: boolean) {
    if (busy) return
    setOpen(next)
    // Always start from the choice, never from a review of an old selection.
    if (next) setStep("choose")
  }

  function changeClass(next: string) {
    setClassId(next)
    // A selection belongs to the class it was made in.
    setSelectedIds(new Set())
    setIndividualId("")
    setQuery("")
  }

  function toggleStudent(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Acts on the students currently listed, so a search can be selected whole. */
  function setVisible(selected: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      for (const student of visibleStudents) {
        if (selected) next.add(student.id)
        else next.delete(student.id)
      }
      return next
    })
  }

  async function submit() {
    if (busy || !activeClass || recipients.length === 0) return
    const selection: RecipientSelection =
      mode === "class"
        ? null
        : mode === "individual"
          ? recipients[0].id
          : recipients.map((student) => student.id)

    setBusy(true)
    try {
      const result = await onConfirm(activeClass.id, selection)
      if (result.delivered === 0) {
        toast.info("Nothing new delivered — recipients already have these files")
      } else {
        toast.success(
          `Delivered ${result.delivered} file${result.delivered === 1 ? "" : "s"} to ${studentCount(result.recipients)}`,
        )
      }
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not distribute")
    } finally {
      setBusy(false)
    }
  }

  const filtering = query.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          (trigger as ReactElement) ?? (
            <Button size="sm" variant="outline">
              <Send className="mr-1.5 h-4 w-4" /> Distribute
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {step === "review" ? "Confirm distribution" : `Distribute ${itemKind}`}
          </DialogTitle>
          <DialogDescription className="break-words">
            {itemKind === "folder" ? "Folder" : "File"}:{" "}
            <span className="font-medium text-foreground">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        {classes.length === 0 || !activeClass ? (
          <p className="text-sm text-muted-foreground">
            You need at least one class before you can distribute files.
          </p>
        ) : step === "choose" ? (
          <div className="flex min-w-0 flex-col gap-4">
            {note && <p className="text-sm text-muted-foreground text-pretty">{note}</p>}

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-class`}>Class</Label>
              <select
                id={`${fieldId}-class`}
                value={String(activeClass.id)}
                onChange={(event) => changeClass(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Send to</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors",
                      "hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-mode`}
                      value={option.id}
                      checked={mode === option.id}
                      onChange={() => setMode(option.id)}
                      className="sr-only"
                    />
                    <option.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="leading-tight">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {students.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                No students have joined this class yet.
              </p>
            ) : mode === "class" ? (
              <p className="rounded-md bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                Everyone in{" "}
                <span className="font-medium text-foreground">{activeClass.name}</span> —{" "}
                {studentCount(students.length)}.
              </p>
            ) : mode === "individual" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-student`}>Student</Label>
                <select
                  id={`${fieldId}-student`}
                  value={individualId}
                  onChange={(event) => setIndividualId(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search students by name"
                    aria-label="Search students by name"
                    className="pl-8"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold" aria-live="polite">
                    {studentCount(selectedIds.size)} selected
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisible(true)}
                      disabled={allVisibleSelected || visibleStudents.length === 0}
                    >
                      {filtering ? "Select all shown" : "Select all"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisible(false)}
                      disabled={noVisibleSelected}
                    >
                      {filtering ? "Deselect all shown" : "Deselect all"}
                    </Button>
                  </div>
                </div>

                {visibleStudents.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No students match your search.
                  </p>
                ) : (
                  <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                    {visibleStudents.map((student) => (
                      <li key={student.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/60 has-[:checked]:bg-primary/10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(student.id)}
                            onChange={() => toggleStudent(student.id)}
                            className="h-4 w-4 shrink-0 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{student.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {student.email}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm text-pretty">
              {mode === "class" ? (
                <>
                  This {itemKind} will be sent to everyone in{" "}
                  <span className="font-medium">{activeClass.name}</span>:
                </>
              ) : (
                <>
                  This {itemKind} will be sent to these students in{" "}
                  <span className="font-medium">{activeClass.name}</span> only:
                </>
              )}
            </p>
            <ul className="max-h-48 overflow-y-auto rounded-md border border-border py-1">
              {recipients.map((student) => (
                <li key={student.id} className="flex items-center gap-2 px-3 py-1 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{student.name}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-semibold">
              {mode === "class"
                ? `${studentCount(recipients.length)} in the class`
                : `${studentCount(recipients.length)} selected`}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              {mode === "class"
                ? "Each student gets their own copy."
                : "Each of them gets their own copy. Nobody else in the class will see it."}{" "}
              A student who already has a file with the same name in the same place keeps theirs
              unchanged.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "choose" || !activeClass ? (
            <>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                onClick={() => setStep("review")}
                disabled={!activeClass || recipients.length === 0}
              >
                Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("choose")} disabled={busy}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button onClick={submit} disabled={busy || recipients.length === 0}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Distribute to {studentCount(recipients.length)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
