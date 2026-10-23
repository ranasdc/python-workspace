"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  EyeOff,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  DISPOSITION_LABELS,
  ERASURE_STATUS_LABELS,
  REQUESTER_BASIS_LABELS,
  daysRemaining,
  type Disposition,
  type ErasureStatus,
} from "@/lib/erasure"
import type { ErasureContext } from "@/lib/erasure-requests"
import { submitErasureRequest, withdrawErasureRequest } from "@/app/actions/erasure"

/**
 * What happens to your data if you ask to be deleted, and how to ask.
 *
 * The panel states plainly that erasure is handled by hand, because it is: no
 * self-service delete exists, and offering a button that merely files a
 * request without saying so would be the more misleading option.
 *
 * The per-record table is generated from the same policy the operator follows,
 * so the account holder sees the actual plan rather than a summary of it.
 */

const DISPOSITION_ICON: Record<Disposition, typeof Trash2> = {
  delete: Trash2,
  anonymise: EyeOff,
  reassign: ArrowRightLeft,
  retain: Lock,
  revoke: Ban,
  blocked: AlertTriangle,
}

/**
 * Only the two bases a person can claim for themselves. A school or teacher
 * acting for a pupil goes through the school's own queue, where their authority
 * is already established by their role.
 */
const BASIS_OPTIONS: Record<string, string> = {
  self: "The account holder",
  parent_guardian: "A parent or guardian",
}

const DISPOSITION_TONE: Record<Disposition, string> = {
  delete: "text-foreground",
  anonymise: "text-foreground",
  reassign: "text-amber-700 dark:text-amber-400",
  retain: "text-muted-foreground",
  revoke: "text-amber-700 dark:text-amber-400",
  blocked: "text-destructive",
}

function StatusBadge({ status }: { status: ErasureStatus }) {
  const closed = status === "completed" || status === "refused" || status === "withdrawn"
  return (
    <Badge variant={status === "completed" ? "secondary" : closed ? "outline" : "default"}>
      {ERASURE_STATUS_LABELS[status]}
    </Badge>
  )
}

export function DataRightsPanel({ context }: { context: ErasureContext }) {
  const { plan, subject, openRequest, history } = context
  const router = useRouter()
  const [detail, setDetail] = useState("")
  const [basis, setBasis] = useState<"self" | "parent_guardian">("self")
  const [pending, startTransition] = useTransition()
  const [withdrawing, setWithdrawing] = useState(false)

  const schoolControlled = plan.controller === "school"

  function handleSubmit(formData: FormData) {
    // Set from state rather than relying on the select to post a value, so the
    // basis recorded against the request is always the one shown on screen.
    formData.set("basis", basis)
    startTransition(async () => {
      const result = await submitErasureRequest(formData)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setDetail("")
      toast.success(
        result.referredToSchool
          ? `Request ${result.reference} recorded and referred to your school.`
          : `Request ${result.reference} recorded. We will respond within one month.`,
      )
      router.refresh()
    })
  }

  async function handleWithdraw(id: number) {
    setWithdrawing(true)
    const result = await withdrawErasureRequest(id)
    setWithdrawing(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success("Request withdrawn.")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Who decides ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Who controls this account</CardTitle>
          <CardDescription>{plan.controllerDetail}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Account type</dt>
              <dd className="font-medium text-foreground">{plan.roleLabel}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Decides erasure requests</dt>
              <dd className="font-medium text-foreground">
                {schoolControlled ? (subject.schoolName ?? "Your school") : "MyCodePad"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-muted-foreground">What has to be established first</dt>
              <dd className="leading-6 text-foreground">{plan.authority}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ---- Blockers, where they exist ---- */}
      {plan.blockers.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Things that must be resolved first
            </CardTitle>
            <CardDescription className="text-amber-900/80 dark:text-amber-200/80">
              Your account holds responsibilities that other people depend on. These are dealt
              with before the account itself can be removed — they are not reasons to refuse
              your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-amber-900/90 marker:text-amber-600/60 dark:text-amber-200/90">
              {plan.blockers.map((blocker, i) => (
                <li key={i} className="pl-1">
                  {blocker}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---- The actual plan ---- */}
      <Card>
        <CardHeader>
          <CardTitle>What happens to each kind of record</CardTitle>
          <CardDescription>
            In the order it is carried out. Anything marked as retained stays because it is
            someone else&apos;s personal data or the school&apos;s record, not because it is
            convenient to keep.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {plan.steps.map((step, i) => {
            const Icon = DISPOSITION_ICON[step.disposition]
            return (
              <div
                key={`${step.label}-${i}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${DISPOSITION_TONE[step.disposition]}`}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground">{step.label}</span>
                  <Badge
                    variant={step.disposition === "blocked" ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {DISPOSITION_LABELS[step.disposition]}
                  </Badge>
                  {step.automatic && (
                    <span className="text-xs text-muted-foreground">automatic</span>
                  )}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{step.reason}</p>
                <p className="font-mono text-xs text-muted-foreground/70">{step.records}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ---- Existing request, or the form ---- */}
      {openRequest ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  Request {openRequest.reference}
                </CardTitle>
                <CardDescription>
                  Submitted {openRequest.createdAt.toLocaleDateString("en-GB")} as{" "}
                  {REQUESTER_BASIS_LABELS[
                    openRequest.requesterBasis as keyof typeof REQUESTER_BASIS_LABELS
                  ] ?? openRequest.requesterBasis}
                  .
                </CardDescription>
              </div>
              <StatusBadge status={openRequest.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="leading-6 text-muted-foreground">
              {deadlineSentence(openRequest.dueBy)}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <VerificationState
                label="Identity verified"
                at={openRequest.identityVerifiedAt}
              />
              <VerificationState
                label="Authority confirmed"
                at={openRequest.authorityConfirmedAt}
              />
            </div>
            {openRequest.detail && (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 leading-6 text-muted-foreground">
                {openRequest.detail}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              variant="outline"
              disabled={withdrawing}
              onClick={() => handleWithdraw(openRequest.id)}
            >
              {withdrawing && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Withdraw request
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ask for your account to be deleted</CardTitle>
            <CardDescription>
              There is no self-service delete button in MyCodePad. Requests are carried out by
              hand against the plan above, so that pupil work and school records are not
              destroyed by accident. We record your request, check who you are, and respond
              within one month.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {schoolControlled && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Because {subject.schoolName ?? "your school"} controls this account, your
                request is recorded here and passed to the school to decide. We will not delete
                work produced for your school without its instruction. You can also ask your
                school directly.
              </div>
            )}
            <Dialog>
              <DialogTrigger render={<Button variant="destructive" className="w-fit" />}>
                <Trash2 data-icon="inline-start" />
                Request erasure
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <form action={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Request erasure of your account</DialogTitle>
                    <DialogDescription>
                      This files a formal request under your right to erasure. It does not
                      delete anything immediately.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-4 py-4">
                    <Field>
                      <FieldLabel htmlFor="basis">You are asking as</FieldLabel>
                      <Select
                        items={BASIS_OPTIONS}
                        value={basis}
                        onValueChange={(value) =>
                          setBasis((value as "self" | "parent_guardian") ?? "self")
                        }
                      >
                        <SelectTrigger id="basis" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(BASIS_OPTIONS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        A parent or guardian request is recorded as a claim and checked before
                        it is acted on.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="detail">
                        Anything we should know (optional)
                      </FieldLabel>
                      <Textarea
                        id="detail"
                        name="detail"
                        rows={4}
                        maxLength={2000}
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="For example, whether you want a copy of your work before it is removed."
                      />
                    </Field>
                  </div>

                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit" variant="destructive" disabled={pending}>
                      {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                      Submit request
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* ---- Closed requests ---- */}
      {history.filter((r) => r.id !== openRequest?.id).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history
              .filter((r) => r.id !== openRequest?.id)
              .map((request) => (
                <div
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {request.reference}
                    </span>
                    <span className="text-muted-foreground">
                      {request.createdAt.toLocaleDateString("en-GB")}
                      {request.decisionRationale ? ` — ${request.decisionRationale}` : ""}
                    </span>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <p className="text-sm leading-6 text-muted-foreground">
        The{" "}
        <Link href="/privacy" className="font-medium text-foreground hover:underline">
          Privacy Policy
        </Link>{" "}
        explains the rest of your rights, including access and correction, and how to complain
        to the ICO if you are unhappy with how a request was handled.
      </p>
    </div>
  )
}

function VerificationState({ label, at }: { label: string; at: Date | null }) {
  return (
    <span className="flex items-center gap-1.5">
      {at ? (
        <CheckCircle2
          className="h-4 w-4 text-emerald-600 dark:text-emerald-500"
          aria-hidden="true"
        />
      ) : (
        <span
          className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/50"
          aria-hidden="true"
        />
      )}
      <span className={at ? "text-foreground" : "text-muted-foreground"}>
        {label}
        {at ? ` ${at.toLocaleDateString("en-GB")}` : ""}
      </span>
    </span>
  )
}

/**
 * The statutory clock, stated as a date rather than a promise of speed.
 * Overdue is shown rather than hidden, because the requester is the person
 * entitled to know.
 */
function deadlineSentence(dueBy: Date): string {
  const days = daysRemaining(dueBy)
  const date = new Date(dueBy).toLocaleDateString("en-GB")
  if (days < 0) {
    return `This request is overdue. The response was due by ${date}, which is outside the one month allowed under UK GDPR. You can complain to the ICO.`
  }
  if (days === 0) return `A response is due today, ${date}.`
  return `A response is due by ${date}, within the one month allowed under UK GDPR (${days} ${days === 1 ? "day" : "days"} remaining).`
}
