import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { schoolSubscriptions, subscriptions } from "@/lib/db/schema"
import { syncSubscriptionFromStripe } from "@/lib/billing-sync"

// Webhooks are the fast path for billing changes, but they are not guaranteed:
// the endpoint may be unconfigured, the secret may be missing, or a delivery
// may simply be dropped. Access must never depend on a message we might not
// receive, so whenever a stored billing period has lapsed we go and ask Stripe
// directly. One call repairs the row, after which reads are cheap again.

/**
 * Re-reads a subscription from Stripe and rewrites our copy.
 * Returns true when the local row now reflects Stripe.
 */
export async function refreshSubscriptionFromStripe(
  stripeSubscriptionId: string | null,
): Promise<boolean> {
  if (!stripeSubscriptionId) return false

  try {
    // Imported lazily so entitlement resolution does not hard-depend on Stripe
    // being configured in environments that never take payments.
    const { stripe } = await import("@/lib/stripe")
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    await syncSubscriptionFromStripe(sub)
    return true
  } catch (error) {
    const code = (error as { code?: string }).code

    // Deleted at Stripe: it cannot possibly still be granting access.
    if (code === "resource_missing") {
      const canceled = { status: "canceled", updatedAt: new Date() }
      await Promise.all([
        db
          .update(subscriptions)
          .set(canceled)
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)),
        db
          .update(schoolSubscriptions)
          .set(canceled)
          .where(eq(schoolSubscriptions.stripeSubscriptionId, stripeSubscriptionId)),
      ])
      return true
    }

    console.log(
      "[billing] could not refresh subscription from Stripe:",
      error instanceof Error ? error.message : error,
    )
    return false
  }
}
