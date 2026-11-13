"use client"

import { useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { removeSchoolMember } from "@/app/actions/schools"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AffectedClass } from "@/lib/school-roster"

export type RemovalTarget = {
  id: string
  name: string
  email: string
  kind: "teacher" | "student"
  /** Classes they teach (teacher) or are enrolled in (student) at this school. */
  classes: AffectedClass[]
}

function plural(count: number, noun: string, many = `${noun}s`) {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? noun : many}`
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

function Points({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
      {children}
    </ul>
  )
}

function ClassList({ classes, showCounts }: { classes: AffectedClass[]; showCounts: boolean }) {
  return (
    <ul className="max-h-32 overflow-y-auto rounded-md border border-border bg-background text-sm">
      {classes.map((cls) => (
        <li
          key={cls.id}
          className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0"
        >
          <span className="min-w-0 truncate">{cls.name}</span>
          {showCounts && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {plural(cls.studentCount, "student")}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Confirmation for taking a teacher or a student out of a school.
 *
 * "Remove" is easily read as "delete", and here the gap between the two is
 * large, so the dialog spells out all three things an administrator might
 * think this is: it ends this school's membership, it does not take anyone out
 * of a class, and it does not delete an account or any work.
 *
 * It is a courtesy, not the control. The server checks the caller's authority
 * over this school on every request, whether or not this dialog was shown.
 */
export function RemoveMemberDialog({
  schoolId,
  schoolName,
  target,
  open,
  onOpenChange,
  onRemoved,
}: {
  schoolId: number
  schoolName: string
  /** Kept while the dialog closes, so its text does not vanish mid-animation. */
  target: RemovalTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const isTeacher = target?.kind === "teacher"
  const classes = target?.classes ?? []

  async function confirm() {
    // A second click while the first request is in flight does nothing; the
    // server treats a repeat as already done in any case.
    if (busy || !target) return
    setBusy(true)
    try {
      const result = await removeSchoolMember(schoolId, target.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        result.alreadyRemoved
          ? `${target.name} had already been removed from ${schoolName}`
          : `${target.name} was removed from ${schoolName}`,
      )
      onRemoved()
      onOpenChange(false)
    } catch {
      toast.error("Could not remove this person. Nothing was changed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isTeacher ? "Remove teacher from school?" : "Remove student from school?"}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Are you sure you want to remove{" "}
            <span className="font-medium text-foreground">{target?.name ?? "this person"}</span>
            {target?.email ? (
              <>
                {" "}
                (<span className="break-all">{target.email}</span>)
              </>
            ) : null}{" "}
            from <span className="font-medium text-foreground">{schoolName}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex min-h-0 flex-col gap-4 overflow-y-auto pr-2">
          {isTeacher ? (
            <>
              <Section title="Removing this teacher will:">
                <Points>
                  <li>
                    Revoke their membership of this school&apos;s organisation, and free their
                    teacher seat.
                  </li>
                  <li>
                    Remove their access to the features and resources the school plan gave them
                    through this membership.
                  </li>
                  <li>
                    Leave their access to classes and teaching to depend on their own MyCodePad
                    account and plan, not on this school.
                  </li>
                </Points>
              </Section>

              <Section title={classes.length > 0 ? "Classes they teach" : "Classes"}>
                {classes.length > 0 ? (
                  <>
                    <ClassList classes={classes} showCounts />
                    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                      {classes.length === 1 ? "This class is" : "These classes are"} not deleted
                      and not handed to another teacher. {classes.length === 1 ? "It stays" : "They stay"}{" "}
                      listed under this school with {target?.name} shown as no longer a member, and
                      the students stay enrolled.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    They do not teach any classes in this school, so no class is affected.
                  </p>
                )}
              </Section>

              <Section title="What is kept">
                <Points>
                  <li>
                    Their personal MyCodePad account and login. Removing them from the school does
                    not delete their account.
                  </li>
                  <li>
                    Their classes, student records, assignments, shared resources and teaching
                    history. Nothing is deleted, silently or otherwise.
                  </li>
                  <li>Anything they hold outside this school.</li>
                </Points>
              </Section>
            </>
          ) : (
            <>
              <Section title="Removing this student will:">
                <Points>
                  <li>
                    Revoke their membership of this school&apos;s organisation, and free their
                    student seat.
                  </li>
                  <li>
                    End their access to the resources and services this school sponsors for them.
                  </li>
                  <li>
                    Not take them out of any class. That is a separate step, taken by the class
                    teacher.
                  </li>
                </Points>
              </Section>

              <Section title={classes.length > 0 ? "Classes they are in" : "Classes"}>
                {classes.length > 0 ? (
                  <>
                    <ClassList classes={classes} showCounts={false} />
                    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                      They stay enrolled in {classes.length === 1 ? "this class" : "these classes"}{" "}
                      until the class teacher removes them from it.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    They are not enrolled in any of this school&apos;s classes.
                  </p>
                )}
              </Section>

              <Section title="What is kept">
                <Points>
                  <li>
                    Their personal MyCodePad account and login. Removing them from the school does
                    not delete their account.
                  </li>
                  <li>
                    Their assignment submissions, teacher feedback, progress records and personal
                    code files. Nothing is deleted, silently or otherwise.
                  </li>
                  <li>Anything they hold outside this school.</li>
                </Points>
              </Section>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || !target}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Removing..." : "Confirm Removal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
