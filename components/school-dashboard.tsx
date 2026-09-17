"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckoutButton } from "@/components/checkout-button"
import {
  createInviteCode,
  removeSchoolMember,
  setInviteCodeActive,
  type getSchoolOverview,
} from "@/app/actions/schools"
import { openBillingPortal } from "@/app/actions/billing"
import { PLANS, SCHOOL_PLAN_IDS, formatPrice } from "@/lib/plans"

type Overview = NonNullable<Awaited<ReturnType<typeof getSchoolOverview>>>

export function SchoolDashboard({ overview }: { overview: Overview }) {
  const { school, plan, seats, members, codes, isAdmin, entitlement } = overview
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const planActive = plan?.status === "active" || plan?.status === "trialing"

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key)
    try {
      await fn()
      toast.success(success)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  async function handlePortal() {
    setBusy("portal")
    try {
      const { url } = await openBillingPortal(school.id)
      if (window.self !== window.top) window.open(url, "_blank", "noopener,noreferrer")
      else window.location.href = url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You are {entitlement.schoolRole === "school_admin" ? "an administrator" : `a ${entitlement.schoolRole}`} of this school.
          </p>
        </div>
        <Badge variant={planActive ? "default" : "secondary"}>
          {planActive ? `${PLANS[plan.tier as keyof typeof PLANS]?.name ?? plan.tier} · active` : "No active plan"}
        </Badge>
      </header>

      {!planActive && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Choose a school plan</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {isAdmin
              ? "One subscription covers every teacher and student in your school."
              : "Your school administrator needs to activate a plan before members get Pro access."}
          </p>

          {isAdmin && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {SCHOOL_PLAN_IDS.map((id) => {
                const p = PLANS[id]
                return (
                  <div key={id} className="rounded-lg border border-border p-4">
                    <h3 className="font-medium">{p.name}</h3>
                    <div className="mt-1 text-2xl font-bold">
                      {formatPrice(p.priceInPence)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{p.interval}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.teacherSeatLimit} teachers · {p.studentSeatLimit} students
                    </p>
                    <CheckoutButton
                      planId={id}
                      schoolId={school.id}
                      size="default"
                      className="mt-4 w-full"
                    >
                      Choose
                    </CheckoutButton>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {planActive && (
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Seats</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Renews{" "}
                {plan.currentPeriodEnd
                  ? new Date(plan.currentPeriodEnd).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" onClick={handlePortal} disabled={busy === "portal"}>
                {busy === "portal" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage billing
              </Button>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SeatMeter
              label="Teacher seats"
              used={seats.teacher + seats.admin}
              limit={plan.teacherSeatLimit}
            />
            <SeatMeter
              label="Student seats"
              used={seats.student}
              limit={plan.studentSeatLimit}
            />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Invite codes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share these so teachers and students join your school.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "code-student"}
                onClick={() =>
                  run(
                    "code-student",
                    () => createInviteCode(school.id, "student"),
                    "Student code created",
                  )
                }
              >
                {busy === "code-student" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                New student code
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "code-teacher"}
                onClick={() =>
                  run(
                    "code-teacher",
                    () => createInviteCode(school.id, "teacher"),
                    "Teacher code created",
                  )
                }
              >
                {busy === "code-teacher" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                New teacher code
              </Button>
            </div>
          </div>

          {codes.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No invite codes yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {codes.map((code) => (
                <li key={code.id} className="flex flex-wrap items-center gap-3 py-3">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                    {code.code}
                  </code>
                  <Badge variant="secondary">{code.role}</Badge>
                  <span className="text-xs text-muted-foreground">
                    used {code.usedCount}
                    {code.maxUses ? ` / ${code.maxUses}` : ""}
                  </span>
                  {!code.active && <Badge variant="outline">disabled</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={busy === `toggle-${code.id}`}
                    onClick={() =>
                      run(
                        `toggle-${code.id}`,
                        () => setInviteCodeActive(code.id, !code.active),
                        code.active ? "Code disabled" : "Code enabled",
                      )
                    }
                  >
                    {code.active ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Members</h2>
          <ul className="mt-4 divide-y divide-border">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant="secondary">{member.role.replace("_", " ")}</Badge>
                {member.role !== "school_admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    disabled={busy === `remove-${member.userId}`}
                    onClick={() =>
                      run(
                        `remove-${member.userId}`,
                        () => removeSchoolMember(school.id, member.userId),
                        "Member removed",
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SeatMeter({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number | null
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const full = limit !== null && used >= limit

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {used}
          {limit !== null ? ` / ${limit}` : ""}
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit ?? used}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {full && (
        <p className="mt-2 text-xs text-destructive">
          Your school has reached its {label.toLowerCase()} limit.
        </p>
      )}
    </div>
  )
}
