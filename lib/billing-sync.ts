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

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const planId = sub.metadata?.planId as PlanId | undefined
  const userId = sub.metadata?.userId
  const schoolIdRaw = sub.metadata?.schoolId

  if (!planId || !PLANS[planId]) {
    console.log("[v0] stripe sync skipped: unknown planId", sub.id, planId)
    return
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id
  const priceId = sub.items?.data?.[0]?.price?.id ?? null
  const currentPeriodEnd = readPeriodEnd(sub)
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end)

  if (isSchoolPlan(planId)) {
    const schoolId = schoolIdRaw ? Number(schoolIdRaw) : Number.NaN
    if (!Number.isFinite(schoolId)) {
      console.log("[v0] stripe sync skipped: school plan without schoolId", sub.id)
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
    console.log("[v0] stripe sync skipped: individual plan without userId", sub.id)
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
