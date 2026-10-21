"use server"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { schoolSubscriptions, subscriptions } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { stripe } from "@/lib/stripe"
import { syncSubscriptionFromStripe } from "@/lib/billing-sync"
import { refreshSubscriptionFromStripe } from "@/lib/billing-refresh"
import { settleIndividualPlanAfterUpgrade } from "@/lib/plan-transition"
import { createSubscriptionCheckout, getRequestOrigin } from "@/lib/checkout"
import { getEntitlement, isSchoolAdminRole, requireSchoolAdmin } from "@/lib/entitlements"
import { PLANS, type PlanId, isSchoolPlan } from "@/lib/plans"

/**
 * Creates a Checkout Session. The price is always read from the server-side
 * catalog — the client only ever names a plan, never a price.
 */
export async function startCheckout(planId: PlanId, schoolId?: number) {
  const me = await requireUser()
  const plan = PLANS[planId]
  if (!plan) throw new Error("Unknown plan")

  const entitlement = await getEntitlement(me.id)

  // A school already covers its members. Never let them buy a redundant plan.
  if (!isSchoolPlan(planId) && entitlement.source === "school") {
    throw new Error("Your school already provides a Pro plan")
  }

  let resolvedSchoolId: number | undefined
  if (isSchoolPlan(planId)) {
    const admin = await requireSchoolAdmin(schoolId)
    resolvedSchoolId = admin.schoolId
  }

  const origin = await getRequestOrigin()

  const metadata: Record<string, string> = { userId: me.id, planId }
  if (resolvedSchoolId) metadata.schoolId = String(resolvedSchoolId)

  return createSubscriptionCheckout({
    plan,
    customerEmail: me.email,
    clientReferenceId: me.id,
    metadata,
    successUrl: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/pricing`,
    idempotencyKey: `checkout:${me.id}:${planId}:${resolvedSchoolId ?? "none"}:${Math.floor(
      Date.now() / 60000,
    )}`,
  })
}

/**
 * Reads the finished Checkout Session straight from Stripe and writes the
 * resulting entitlement. This runs on the success page so access is granted
 * immediately, without waiting for webhook delivery.
 */
export async function reconcileCheckoutSession(sessionId: string) {
  const me = await requireUser()

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  })

  // The session must belong to the caller, otherwise anyone could replay a
  // stranger's session id and mint themselves a subscription.
  if (session.metadata?.userId !== me.id && session.client_reference_id !== me.id) {
    throw new Error("This checkout session does not belong to you")
  }

  const sub = session.subscription
  if (!sub || typeof sub === "string") {
    return { ok: false as const, status: session.status ?? "unknown" }
  }

  // No revalidatePath here: this runs during the success page's render, where
  // revalidation is unsupported. The workspace routes are request-time dynamic
  // (they read the session cookie), so they pick the new entitlement up anyway.
  await syncSubscriptionFromStripe(sub)

  // Now that Stripe's own copy of the subscription has been read and found
  // paid, an upgraded teacher's personal plan can be wound down. Runs here as
  // well as in the webhook so the teacher sees the outcome on this page rather
  // than waiting on a delivery, and reports rather than throws so a Stripe
  // problem cannot turn a successful payment into an error screen.
  const settlement = await settleIndividualPlanAfterUpgrade(sub)

  return {
    ok: true as const,
    status: sub.status,
    // The success page reads these to send a school upgrade to the right
    // place, and to be honest if the old plan is still renewing.
    planId: (sub.metadata?.planId as PlanId | undefined) ?? null,
    schoolId: sub.metadata?.schoolId ? Number(sub.metadata.schoolId) : null,
    settlement,
  }
}

/** Opens the Stripe Customer Portal for whatever the caller actually owns. */
export async function openBillingPortal(schoolId?: number) {
  const me = await requireUser()
  const origin = await getRequestOrigin()

  let customerId: string | null = null
  // Whether a plan exists at all, as opposed to existing without a card behind
  // it. The two cases need different explanations, and conflating them is what
  // made this fail silently for school administrators.
  let planExists = false

  if (schoolId) {
    // Re-checked server-side against the caller's own membership: the schoolId
    // arrives from the client and is never trusted, so one school can never
    // reach another school's billing.
    const admin = await requireSchoolAdmin(schoolId)
    const [row] = await db
      .select({ stripeCustomerId: schoolSubscriptions.stripeCustomerId })
      .from(schoolSubscriptions)
      .where(eq(schoolSubscriptions.schoolId, admin.schoolId))
      .limit(1)
    customerId = row?.stripeCustomerId ?? null
    planExists = Boolean(row)
  } else {
    const [row] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, me.id))
      .limit(1)
    customerId = row?.stripeCustomerId ?? null
    planExists = Boolean(row)
  }

  if (!customerId) {
    // A plan with no Stripe customer was granted outside Stripe, so there is no
    // portal to open and never will be. Saying so is the difference between a
    // user understanding their plan and thinking the app is broken.
    throw new Error(
      planExists
        ? schoolId
          ? "This school's plan was not set up through Stripe, so there is no billing portal for it. Its plan and renewal date are shown on this page."
          : "This plan was not set up through Stripe, so there is no billing portal for it."
        : "No billing account found",
    )
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  })

  return { url: portal.url }
}

/** Entitlement + usage for the billing screen. */
export async function getBillingOverview() {
  const me = await requireUser()

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, me.id)))
    .limit(1)

  // Anything the user just did in the Stripe portal — cancelling, resuming,
  // changing card — should be visible the moment they land back here, rather
  // than whenever a webhook happens to arrive. This runs before the
  // entitlement is resolved so the page reflects the refreshed row.
  if (existing?.stripeSubscriptionId) {
    await refreshSubscriptionFromStripe(existing.stripeSubscriptionId)
  }

  const entitlement = await getEntitlement(me.id)

  const [individual] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, me.id)))
    .limit(1)

  return {
    entitlement,
    hasBillingAccount: Boolean(individual?.stripeCustomerId),
    // A school administrator viewing a school-funded plan is not a passive
    // beneficiary of it: they are the person who cancels, resumes and changes
    // it, so the page has to send them somewhere they can.
    isSchoolAdmin: isSchoolAdminRole(entitlement.schoolRole),
  }
}
