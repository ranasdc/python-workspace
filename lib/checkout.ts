import "server-only"

import { headers } from "next/headers"
import type Stripe from "stripe"

import { stripe } from "@/lib/stripe"
import { CURRENCY, type Plan } from "@/lib/plans"

// How MyCodePad asks Stripe for money, in one place.
//
// Extracted because the account carries two settings that silently break
// checkout if a call site forgets them — Managed Payments, and the fact that
// every price is ad-hoc rather than pre-configured. A second hand-written copy
// of these parameters would work until one of those settings changed and then
// fail for one purchase path only. Every flow that charges for a plan goes
// through here so there is exactly one copy to keep correct.

/** The origin of the current request, for Stripe's return URLs. */
export async function getRequestOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

// `managed_payments` is missing from the installed SDK's types (22.6.2), so it
// is declared here rather than cast away at the call site.
type CheckoutSessionParams = Stripe.Checkout.SessionCreateParams & {
  managed_payments?: { enabled: boolean }
}

export type SubscriptionCheckoutRequest = {
  /** Read from the server-side catalog. The client only ever names a plan. */
  plan: Plan
  customerEmail: string
  clientReferenceId: string
  /** Mirrored onto the subscription so webhooks are self-describing. */
  metadata: Record<string, string>
  successUrl: string
  cancelUrl: string
  /** Collapses accidental double-clicks into one session. */
  idempotencyKey: string
}

export async function createSubscriptionCheckout(
  request: SubscriptionCheckoutRequest,
): Promise<{ url: string }> {
  const { plan, metadata } = request

  const params: CheckoutSessionParams = {
    mode: "subscription",
    customer_email: request.customerEmail,
    client_reference_id: request.clientReferenceId,
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
    subscription_data: { metadata },
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    // Stripe switched Managed Payments on by default for this account, which
    // makes Stripe the merchant of record and rejects ad-hoc prices that carry
    // no product tax code — every checkout was failing outright. Opting out per
    // session keeps MyCodePad as merchant of record and leaves both the
    // account-level setting and the VAT treatment untouched.
    managed_payments: { enabled: false },
  }

  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: request.idempotencyKey,
  })

  if (!session.url) throw new Error("Stripe did not return a checkout URL")
  return { url: session.url }
}

/**
 * A reusable Stripe Product for one plan, created on first use.
 *
 * Changing an existing subscription's tier needs a Price, and a Price needs a
 * Product — unlike Checkout, `subscriptions.update` will not accept an inline
 * `product_data`. The id is derived from our own plan id, so the lookup is
 * deterministic: the first upgrade to a tier creates the product and every
 * later one reuses it, rather than littering the account with an anonymous
 * product per upgrade. The amount still comes from lib/plans.ts; nothing here
 * invents a price.
 */
async function ensurePlanProduct(plan: Plan): Promise<string> {
  const id = `mycodepad_${plan.id}`

  try {
    const existing = await stripe.products.retrieve(id)
    return existing.id
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error
  }

  const created = await stripe.products.create(
    { id, name: plan.name, description: plan.blurb },
    // Two administrators upgrading at once must not race into a duplicate.
    { idempotencyKey: `product:${id}` },
  )
  return created.id
}

/**
 * A recurring Price for one plan, at the amount currently configured.
 *
 * Deliberately created per call rather than looked up: the catalog price can
 * change (a sale starting or ending), and a cached price id would quietly
 * charge yesterday's amount. Stripe treats unused prices as inert, so creating
 * one per tier change costs nothing.
 */
export async function createPlanPrice(plan: Plan): Promise<string> {
  const product = await ensurePlanProduct(plan)

  const price = await stripe.prices.create({
    currency: CURRENCY,
    product,
    unit_amount: plan.priceInPence,
    recurring: { interval: plan.interval },
  })

  return price.id
}
