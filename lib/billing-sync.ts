import "server-only"

import type Stripe from "stripe"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { schoolSubscriptions, subscriptions } from "@/lib/db/schema"
import { PLANS, type PlanId, isSchoolPlan } from "@/lib/plans"

// Stripe subscriptions carry the metadata we attached at checkout time, so both
// the webhook and the post-checkout reconciliation can call into here with
// nothing but the Stripe object. Writes are upserts keyed on the natural owner
// (userId / schoolId) which makes replaying the same event harmless.

/**
 * `current_period_end` moved onto subscription items in the Dahlia API.
 * Read whichever the installed version returns.
 */
function readPeriodEnd(sub: Stripe.Subscription): Date | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end
  const fromItem = sub.items?.data?.[0]?.current_period_end
  const raw = typeof legacy === "number" ? legacy : fromItem
  return typeof raw === "number" ? new Date(raw * 1000) : null
}

function readInterval(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.recurring?.interval ?? null
}

/**
 * Current Stripe API versions express "cancel when the term is up" by setting
 * `cancel_at` (plus `canceled_at`) and leaving `cancel_at_period_end` false —
 * that is exactly what the billing portal's Cancel button produces. Reading the
 * boolean alone therefore misses every scheduled cancellation, so treat a
 * `cancel_at` timestamp as authoritative too.
 */
function readCancellation(sub: Stripe.Subscription) {
  const raw = sub.cancel_at
  const cancelAt = typeof raw === "number" ? new Date(raw * 1000) : null
  return {
    cancelAt,
    scheduledToCancel: Boolean(sub.cancel_at_period_end) || cancelAt !== null,
  }
}

/**
 * The date access actually runs out: normally the next renewal, but the
 * cancellation date when one is scheduled sooner. Entitlement checks re-read
 * Stripe once this passes, so taking the earlier value only ever schedules an
 * earlier re-check — never a later one.
 */
function readAccessEnd(sub: Stripe.Subscription): Date | null {
  const periodEnd = readPeriodEnd(sub)
  const { cancelAt } = readCancellation(sub)
  if (cancelAt && (!periodEnd || cancelAt.getTime() < periodEnd.getTime())) return cancelAt
  return periodEnd
}

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const planId = sub.metadata?.planId as PlanId | undefined
  const userId = sub.metadata?.userId
  const schoolIdRaw = sub.metadata?.schoolId

  if (!planId || !PLANS[planId]) {
    console.warn("[billing] stripe sync skipped: unknown planId", sub.id, planId)
    return
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id
  const priceId = sub.items?.data?.[0]?.price?.id ?? null
  const currentPeriodEnd = readAccessEnd(sub)
  const cancelAtPeriodEnd = readCancellation(sub).scheduledToCancel

  if (isSchoolPlan(planId)) {
    const schoolId = schoolIdRaw ? Number(schoolIdRaw) : Number.NaN
    if (!Number.isFinite(schoolId)) {
      console.warn("[billing] stripe sync skipped: school plan without schoolId", sub.id)
      return
    }

    const plan = PLANS[planId]
    await db
      .insert(schoolSubscriptions)
      .values({
        schoolId,
        tier: planId,
        status: sub.status,
        teacherSeatLimit: plan.teacherSeatLimit ?? null,
        studentSeatLimit: plan.studentSeatLimit ?? null,
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      })
      .onConflictDoUpdate({
        target: schoolSubscriptions.schoolId,
        set: {
          tier: planId,
          status: sub.status,
          teacherSeatLimit: plan.teacherSeatLimit ?? null,
          studentSeatLimit: plan.studentSeatLimit ?? null,
          stripeCustomerId: customerId ?? null,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          updatedAt: new Date(),
        },
      })
    return
  }

  if (!userId) {
    console.warn("[billing] stripe sync skipped: individual plan without userId", sub.id)
    return
  }

  await db
    .insert(subscriptions)
    .values({
      userId,
      plan: planId,
      status: sub.status,
      interval: readInterval(sub),
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan: planId,
        status: sub.status,
        interval: readInterval(sub),
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      },
    })
}

/** Marks a subscription inactive when Stripe reports it deleted. */
export async function markSubscriptionCanceled(sub: Stripe.Subscription) {
  await Promise.all([
    db
      .update(subscriptions)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, sub.id)),
    db
      .update(schoolSubscriptions)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(schoolSubscriptions.stripeSubscriptionId, sub.id)),
  ])
}
