"use server"

import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { schoolSubscriptions, subscriptions } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { stripe } from "@/lib/stripe"
import { syncSubscriptionFromStripe } from "@/lib/billing-sync"
import { refreshSubscriptionFromStripe } from "@/lib/billing-refresh"
import { getEntitlement, requireSchoolAdmin } from "@/lib/entitlements"
import { CURRENCY, PLANS, type PlanId, isSchoolPlan } from "@/lib/plans"

async function getOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

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

  const origin = await getOrigin()

  const metadata: Record<string, string> = { userId: me.id, planId }
  if (resolvedSchoolId) metadata.schoolId = String(resolvedSchoolId)

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: me.email,
      client_reference_id: me.id,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: { name: plan.name, description: plan.blurb },
            unit_amount: plan.priceInPence,
            recurring: { interval: plan.interval },
          },
          quantity: 1,
        },
      ],
      metadata,
      // Mirrored onto the subscription so webhooks are self-describing.
      subscription_data: { metadata },
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    },
    {
      // Collapses accidental double-clicks into one session.
      idempotencyKey: `checkout:${me.id}:${planId}:${resolvedSchoolId ?? "none"}:${Math.floor(
        Date.now() / 60000,
      )}`,
    },
  )

  if (!session.url) throw new Error("Stripe did not return a checkout URL")
  return { url: session.url }
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

  return { ok: true as const, status: sub.status }
}

/** Opens the Stripe Customer Portal for whatever the caller actually owns. */
export async function openBillingPortal(schoolId?: number) {
  const me = await requireUser()
  const origin = await getOrigin()

  let customerId: string | null = null

  if (schoolId) {
    const admin = await requireSchoolAdmin(schoolId)
    const [row] = await db
      .select()
      .from(schoolSubscriptions)
      .where(eq(schoolSubscriptions.schoolId, admin.schoolId))
      .limit(1)
    customerId = row?.stripeCustomerId ?? null
  } else {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, me.id))
      .limit(1)
    customerId = row?.stripeCustomerId ?? null
  }

  if (!customerId) throw new Error("No billing account found")

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
  }
}
