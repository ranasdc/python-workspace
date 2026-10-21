"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InviteCodes } from "@/components/school/invite-codes"
import { removeSchoolMember, type getSchoolOverview } from "@/app/actions/schools"
import { openBillingPortal } from "@/app/actions/billing"
import {
  PLANS,
  SCHOOL_PLAN_IDS,
  formatPrice,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans"
import { describeSchoolPlan } from "@/lib/school-billing"
import { describeUpgrades, offerFor } from "@/lib/plan-upgrades"
import { SchoolPlanCard } from "@/components/school-plan-card"

type Overview = NonNullable<Awaited<ReturnType<typeof getSchoolOverview>>>

function formatDate(value: Date | string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function SchoolDashboard({
  overview,
  preselectedInterval,
}: {
  overview: Overview
  /** The interval chosen on the pricing page, if the reader came from there. */
  preselectedInterval?: BillingInterval
}) {
  const { school, plan, seats, members, codes, isAdmin, entitlement } = overview
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // One shared rule decides what this plan supports, so the button offered here
  // and the portal the server will actually open can never disagree again.
  const view = describeSchoolPlan(plan, isAdmin)
  const planActive = view.active
  const accessEndsOn = formatDate(plan?.currentPeriodEnd ?? null)

  // The same rule the upgrade screen and the server action read, so a tier this
  // school cannot move to is never offered here. A MAT plan yields nothing,
  // which is what removes the section for the highest tier.
  const upgrade = describeUpgrades({
    currentPlan: (plan?.tier as PlanId | undefined) ?? null,
    currentPlanLive: planActive,
    canManage: isAdmin,
    // The subscription, not the customer: this is the thing an upgrade
    // re-prices, and it is what the server action checks before charging.
    stripeManaged: Boolean(plan?.tierChangeable),
  })

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
          {planActive && plan
            ? `${PLANS[plan.tier as keyof typeof PLANS]?.name ?? plan.tier} · active`
            : "No active plan"}
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

          {/* No sale banner here. The launch sale covers the individual Pro
              plans, not the school tiers, so on a screen whose only purchase is
              a school tier it advertised a discount none of these three cards
              can give. It still runs on /pricing, beside the plans it applies
              to. */}
          {isAdmin && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {SCHOOL_PLAN_IDS.map((id) => (
                <SchoolPlanCard
                  key={id}
                  plan={PLANS[id]}
                  action="checkout"
                  schoolId={school.id}
                  variant="compact"
                  // Carried from the pricing page, so an administrator who chose
                  // Monthly there does not have to choose it again here.
                  initialInterval={preselectedInterval}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {planActive && plan && (
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Seats</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {view.periodKind === "ends"
                  ? `Ends ${accessEndsOn}`
                  : view.periodKind === "renews"
                    ? `Renews ${accessEndsOn}`
                    : "Renewal date unavailable"}
              </p>
            </div>
            {view.canOpenPortal && (
              <Button variant="outline" onClick={handlePortal} disabled={busy === "portal"}>
                {busy === "portal" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {view.portalLabel}
              </Button>
            )}
          </div>

          {view.notice === "ending" && (
            <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive text-pretty">
              This plan is set to end
              {accessEndsOn ? ` on ${accessEndsOn}` : ""}. Every teacher and student
              keeps Pro until then, after which the school drops to the free tier.
              {view.canOpenPortal ? " You can reverse this from the billing portal." : ""}
            </p>
          )}

          {/* An active plan with no Stripe customer behind it was granted
              directly rather than paid by card. The portal has nothing to open
              for it, so the honest thing is to say so rather than render a
              button that can only ever fail. */}
          {view.notice === "not_stripe_managed" && (
            <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-pretty">
              This plan was arranged directly rather than paid by card, so there is
              no Stripe billing portal for it. Its tier, seats and renewal date are
              shown here, and whoever arranged it can change or end it for you.
            </p>
          )}

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

      {/* Only an administrator of a live, Stripe-backed plan below MAT gets
          here, and only the tiers above the current one are listed. */}
      {upgrade.reason === "available" && plan && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Need more seats?</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Move up a tier and your school keeps this subscription — same renewal date,
            no second plan, and every class, file and piece of student work stays
            exactly where it is.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {upgrade.options.map((id) => {
              // Priced on the interval this school is already billed on, so a
              // monthly school is not shown an annual figure it will never pay.
              const offer = offerFor(
                plan.tier as PlanId,
                id,
                plan.interval as BillingInterval | null,
              )
              return (
                <div key={id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{offer.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(offer.priceInPence)}/{offer.interval}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {offer.teacherSeatLimit} teachers ·{" "}
                    {offer.studentSeatLimit?.toLocaleString("en-GB")} students
                  </p>
                  {offer.extraTeacherSeats !== null &&
                    offer.extraStudentSeats !== null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        +{offer.extraTeacherSeats} teacher seats, +
                        {offer.extraStudentSeats.toLocaleString("en-GB")} student seats
                      </p>
                    )}
                  <Link
                    href={`/billing/upgrade?plan=${id}`}
                    className={buttonVariants({
                      variant: "outline",
                      className: "mt-4 w-full",
                    })}
                  >
                    Upgrade to {offer.name}
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {isAdmin && <InviteCodes schoolId={school.id} codes={codes} />}

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
