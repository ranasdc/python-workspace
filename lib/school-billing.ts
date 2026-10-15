import { ACTIVE_STATUSES } from "@/lib/plans"

// How a school's plan should be presented and which controls it supports.
//
// This lives apart from the dashboard because the decision is the part that was
// wrong: the old UI offered "Manage billing" whenever the plan was active,
// while the server would only open the Stripe portal when a Stripe customer
// existed. A school whose plan was granted directly — a pilot, a migrated
// school, an invoice settled offline — is genuinely active and genuinely grants
// Pro, but has no portal behind it, so the button could only ever fail with
// "No billing account found". Keeping the rule in one pure function means the
// button and the server agree by construction, and every subscription state can
// be tested without a browser or a Stripe account.

export type SchoolPlanRow = {
  status: string
  currentPeriodEnd: Date | string | null
  cancelAtPeriodEnd: boolean
  /** True only when a Stripe customer exists for this plan. */
  manageable: boolean
}

export type SchoolPlanView = {
  /** Whether the plan currently grants Pro to the school's members. */
  active: boolean
  /** Active, but set to stop at the end of the current term. */
  scheduledToCancel: boolean
  /** Whether the Stripe portal can be opened for this plan by this viewer. */
  canOpenPortal: boolean
  /** What the date beside the plan means. */
  periodKind: "renews" | "ends" | "unknown"
  /** Which explanation the dashboard owes the viewer, if any. */
  notice: "none" | "ending" | "not_stripe_managed"
  /** What the portal button should say. */
  portalLabel: "Manage billing" | "Reactivate or update"
}

export function describeSchoolPlan(
  plan: SchoolPlanRow | null | undefined,
  isAdmin: boolean,
): SchoolPlanView {
  const active = Boolean(
    plan && (ACTIVE_STATUSES as readonly string[]).includes(plan.status),
  )

  // Only an active plan can be "winding down": once Stripe has actually ended
  // it the school is simply on the free tier, and saying it is "ending" would
  // promise access that has already gone.
  const scheduledToCancel = active && Boolean(plan?.cancelAtPeriodEnd)

  // Members see the state but never the controls. The server re-checks this
  // independently in requireSchoolAdmin, so this only decides what to render.
  const canOpenPortal = active && isAdmin && Boolean(plan?.manageable)

  const hasDate = Boolean(plan?.currentPeriodEnd)

  return {
    active,
    scheduledToCancel,
    canOpenPortal,
    periodKind: !active || !hasDate ? "unknown" : scheduledToCancel ? "ends" : "renews",
    notice: !active
      ? "none"
      : scheduledToCancel && isAdmin
        ? "ending"
        : isAdmin && !plan?.manageable
          ? "not_stripe_managed"
          : "none",
    portalLabel: scheduledToCancel ? "Reactivate or update" : "Manage billing",
  }
}
