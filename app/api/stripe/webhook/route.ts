import type Stripe from "stripe"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { stripeEvents } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe"
import { markSubscriptionCanceled, syncSubscriptionFromStripe } from "@/lib/billing-sync"

// Stripe needs the raw body for signature verification, so this route must not
// be given a parsed body by anything upstream.
export const dynamic = "force-dynamic"

const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
])

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting webhook")
    return new Response("Webhook not configured", { status: 500 })
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) return new Response("Missing signature", { status: 400 })

  const payload = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    console.log(
      "[stripe-webhook] signature verification failed:",
      error instanceof Error ? error.message : error,
    )
    return new Response("Invalid signature", { status: 400 })
  }

  if (!RELEVANT.has(event.type)) {
    return Response.json({ received: true, ignored: event.type })
  }

  // Idempotency: if this insert conflicts, another delivery already applied it.
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id })

  if (inserted.length === 0) {
    return Response.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncSubscriptionFromStripe(sub)
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription)
        break
      }

      case "customer.subscription.deleted": {
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription)
        break
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription })
          .subscription
        const subId = typeof subRef === "string" ? subRef : subRef?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncSubscriptionFromStripe(sub)
        }
        break
      }
    }
  } catch (error) {
    // Roll the marker back so Stripe's retry can have another go.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id))
    console.log(
      "[stripe-webhook] handler failed:",
      error instanceof Error ? error.message : error,
    )
    return new Response("Handler error", { status: 500 })
  }

  return Response.json({ received: true })
}
