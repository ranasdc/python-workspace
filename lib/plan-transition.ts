import "server-only"

import type Stripe from "stripe"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { PLANS, type PlanId, isSchoolPlan } from "@/lib/plans"
import { decideSettlement } from "@/lib/plan-upgrades"
import {
  readStripeSubscriptionState,
  syncSubscriptionFromStripe,
} from "@/lib/billing-sync"

// Closing down an individual plan once the school plan that replaces it is
// genuinely paid for.
//
// The order matters and is the whole point of this module. The school plan is
// verified active *first*, from Stripe's own copy of the subscription, and only
// then does the individual plan stop renewing. Doing it the other way around —
// cancelling on the way to Checkout, or on the user's return from it — would
// leave a teacher who abandoned payment with no plan at all.
//
// It stops the renewal rather than cancelling outright, so the teacher keeps the
// term they have already paid for and is never charged twice for the same
// month. There is no refund to chase and no gap in access.

export type SettlementOutcome =
  /** Not an upgrade, or the school plan is not active yet. */
  | "not_applicable"
  /** No individual Stripe subscription was left to stop. */
  | "nothing_to_settle"
  /** Already scheduled to stop, by an earlier delivery of this same event. */
  | "already_settled"
  /** Set to stop at the end of the paid term just now. */
  | "stopped"
  /** Stripe refused. The individual plan is still renewing. */
  | "failed"

/**
 * Stops an upgraded teacher's individual subscription renewing, if and only if
 * the school subscription handed in is verified active.
 *
 * Safe to call repeatedly: that is how it is relied upon. Checkout
 * reconciliation calls it on the success page for an immediate result, the
 * webhook calls it for every subscription event, and because the upgrade
 * metadata lives on the subscription itself, any later event is another chance
 * to put right a delivery that was missed. Each call re-reads the current state
 * and does nothing when there is nothing left to do.
 *
 * Never throws. A failure here must not make Stripe retry an event that has
 * already been applied, and must not fail the page a paying customer is
 * looking at — so it reports the outcome instead, and the callers surface it.
 */
export async function settleIndividualPlanAfterUpgrade(
  schoolSub: Stripe.Subscription,
): Promise<SettlementOutcome> {
  const planId = schoolSub.metadata?.planId as PlanId | undefined
  const userId = schoolSub.metadata?.userId
  const upgradedFrom = schoolSub.metadata?.upgradedFrom

  // Cheap disqualifications first, so an ordinary school purchase costs no
  // database read at all. The authoritative version of these same checks runs
  // again below, against the individual row, through decideSettlement.
  if (upgradedFrom !== "teacher_pro") return "not_applicable"
  if (!planId || !PLANS[planId] || !isSchoolPlan(planId)) return "not_applicable"
  if (!userId) return "not_applicable"

  // Stripe's own view of the school plan, not the customer's return from
  // Checkout and not a webhook's say-so.
  const state = readStripeSubscriptionState(schoolSub)

  const [individual] = await db
    .select({
      plan: subscriptions.plan,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  // The ordering rule itself, decided by the tested pure function rather than
  // by this function's own reasoning.
  const verdict = decideSettlement({
    upgradedFrom,
    targetPlan: planId,
    schoolPlanLive: state.live,
    individualPlan: individual?.plan as PlanId | undefined,
    individualHasStripeSubscription: Boolean(individual?.stripeSubscriptionId),
    individualAlreadyStopping: Boolean(individual?.cancelAtPeriodEnd),
  })

  if (verdict !== "stop_renewal") return verdict

  // decideSettlement only returns stop_renewal when this is present, so this
  // re-narrowing is the compiler checking that invariant rather than this
  // function assuming it.
  const individualSubscriptionId = individual?.stripeSubscriptionId
  if (!individualSubscriptionId) return "nothing_to_settle"

  try {
    const { stripe } = await import("@/lib/stripe")

    const updated = await stripe.subscriptions.update(
      individualSubscriptionId,
      { cancel_at_period_end: true },
      {
        // Stable rather than time-bucketed: this transition should happen once
        // for this pair of subscriptions, ever.
        idempotencyKey: `settle:${individualSubscriptionId}:${schoolSub.id}`,
      },
    )

    // Written back through the one writer, so the renewal date and cancellation
    // flag on screen are Stripe's, not our guess at what Stripe did.
    await syncSubscriptionFromStripe(updated)
    return "stopped"
  } catch (error) {
    console.log(
      "[billing] could not stop the upgraded individual plan renewing:",
      error instanceof Error ? error.message : error,
    )
    return "failed"
  }
}
