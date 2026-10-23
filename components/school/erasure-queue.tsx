"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ERASURE_ROLE_LABELS,
  ERASURE_STATUS_LABELS,
  REQUESTER_BASIS_LABELS,
  daysRemaining,
  type ErasureRole,
  type ErasureStatus,
} from "@/lib/erasure"
import type { ErasureRequestSummary } from "@/lib/erasure-requests"
import {
  advanceErasureRequest,
  confirmErasureVerification,
} from "@/app/actions/erasure"

/**
 * The erasure requests a school is responsible for deciding.
 *
 * A school administrator is the controller for pupil and staff accounts, so
 * this is where those requests are verified, decided and closed. The queue
 * deliberately shows the statutory deadline and whether it has passed, because
 * an administrator cannot meet a deadline they cannot see.
 *
 * Nothing in here deletes data. Recording a completion is a statement that the
 * deletion was carried out, which is why it cannot be saved without saying what
 * was actually done.
 */

/** The states an administrator can move a request into, with what each means. */
const NEXT_STATES: Record<string, string> = {
  verifying_identity: "Verifying identity",
  in_progress: "In progress",
  completed: "Completed",
  refused: "Refused",
}

function Deadline({ dueBy, status }: { dueBy: Date; status: ErasureStatus }) {
  const closed = status === "completed" || status === "refused" || status === "withdrawn"
  if (closed) return null

  const days = daysRemaining(dueBy)
  const overdue = days < 0
  return (
    <span
      className={[
        "flex items-center gap-1.5 text-xs",
        overdue ? "font-medium text-destructive" : "text-muted-foreground",
      ].join(" ")}
    >
      {overdue ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {overdue
        ? `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`
        : `Due in ${days} ${days === 1 ? "day" : "days"}`}
    </span>
  )
}

export function ErasureQueue({
  schoolName,
  requests,
}: {
  schoolName: string
  requests: ErasureRequestSummary[]
}) {
  const open = requests.filter(
    (r) => !["completed", "refused", "withdrawn"].includes(r.status),
  )
  const closed = requests.filter((r) =>
    ["completed", "refused", "withdrawn"].includes(r.status),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Erasure requests</CardTitle>
        <CardDescription>
          {schoolName} is the controller for accounts it manages, so these requests are yours to
          decide. MyCodePad carries out the deletion on your instruction and does not remove
          pupil work without it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {requests.length === 0 ? (
          <Empty className="border border-dashed border-border bg-muted/20 py-10">
            <EmptyHeader>
              <EmptyTitle>No requests</EmptyTitle>
              <EmptyDescription>
                When someone in your school asks for their account to be erased, it appears here
                with the date a response is due.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {open.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
            {closed.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Closed
                </h3>
                {closed.map((request) => (
                  <RequestRow key={request.id} request={request} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RequestRow({ request }: { request: ErasureRequestSummary }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const closed = ["completed", "refused", "withdrawn"].includes(request.status)

  const [method, setMethod] = useState("")
  const [note, setNote] = useState("")
  const [nextStatus, setNextStatus] = useState<string>("in_progress")

  // Controlled, so a saved check or status change closes its own dialog. Left
  // uncontrolled the dialog stays open over a field that has already been
  // submitted, which invites recording the same check twice.
  const [checkOpen, setCheckOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  function verify(kind: "identity" | "authority") {
    startTransition(async () => {
      const result = await confirmErasureVerification(request.id, kind, method)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setMethod("")
      setCheckOpen(false)
      toast.success(kind === "identity" ? "Identity recorded." : "Authority recorded.")
      router.refresh()
    })
  }

  function advance() {
    startTransition(async () => {
      const result = await advanceErasureRequest(request.id, nextStatus, note)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setNote("")
      setStatusOpen(false)
      toast.success(`Request ${request.reference} updated.`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{request.reference}</span>
            <Badge variant={closed ? "outline" : "default"}>
              {ERASURE_STATUS_LABELS[request.status]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {ERASURE_ROLE_LABELS[request.subjectRole as ErasureRole] ?? request.subjectRole}
            </Badge>
          </div>
          <p className="truncate text-sm font-medium text-foreground">{request.subjectLabel}</p>
          <p className="text-xs text-muted-foreground">
            Asked by{" "}
            {REQUESTER_BASIS_LABELS[
              request.requesterBasis as keyof typeof REQUESTER_BASIS_LABELS
            ] ?? request.requesterBasis}
            , {request.createdAt.toLocaleDateString("en-GB")}
          </p>
        </div>
        <Deadline dueBy={request.dueBy} status={request.status} />
      </div>

      {request.detail && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
          {request.detail}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <Check label="Identity" at={request.identityVerifiedAt} />
        <Check label="Authority" at={request.authorityConfirmedAt} />
      </div>

      {request.decisionRationale && (
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">
            {request.decision === "refused" ? "Refused" : "Completed"}:
          </span>{" "}
          {request.decisionRationale}
        </p>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <ShieldCheck data-icon="inline-start" />
                Record a check
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Record a verification check</DialogTitle>
                <DialogDescription>
                  Identity is whether this is really the account holder. Authority is whether the
                  person asking is entitled to ask on their behalf. Record them separately.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Field>
                  <FieldLabel htmlFor={`method-${request.id}`}>How was this checked?</FieldLabel>
                  <Textarea
                    id={`method-${request.id}`}
                    rows={3}
                    maxLength={300}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    placeholder="For example: confirmed in person with the pupil's form tutor on 12 March."
                  />
                  <FieldDescription>
                    Proportionate to the risk. Do not ask for ID documents where a simpler check
                    is enough.
                  </FieldDescription>
                </Field>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => verify("authority")}
                >
                  Authority
                </Button>
                <Button type="button" disabled={pending} onClick={() => verify("identity")}>
                  {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Identity
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                Update status
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Update {request.reference}</DialogTitle>
                <DialogDescription>
                  Marking a request completed records that the deletion was actually carried
                  out, so say what was removed, transferred or kept.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <Field>
                  <FieldLabel htmlFor={`status-${request.id}`}>New status</FieldLabel>
                  <Select
                    items={NEXT_STATES}
                    value={nextStatus}
                    onValueChange={(value) => setNextStatus(value ?? "in_progress")}
                  >
                    <SelectTrigger id={`status-${request.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NEXT_STATES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`note-${request.id}`}>
                    What was done, and why
                  </FieldLabel>
                  <Textarea
                    id={`note-${request.id}`}
                    rows={4}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Required for a completion or a refusal. A refusal must state its grounds, because the requester has to be told them."
                  />
                </Field>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button type="button" disabled={pending} onClick={advance}>
                  {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

function Check({ label, at }: { label: string; at: Date | null }) {
  return (
    <span className="flex items-center gap-1.5">
      {at ? (
        <CheckCircle2
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500"
          aria-hidden="true"
        />
      ) : (
        <span
          className="h-3.5 w-3.5 rounded-full border border-dashed border-muted-foreground/50"
          aria-hidden="true"
        />
      )}
      <span className={at ? "text-foreground" : "text-muted-foreground"}>
        {label}
        {at ? ` ${at.toLocaleDateString("en-GB")}` : " not yet checked"}
      </span>
    </span>
  )
}
