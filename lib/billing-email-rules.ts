import type Stripe from "stripe"

// Decides which (if any) billing email a verified Stripe event warrants.
// Pure and import-free at runtime so it can be unit tested with `node --test`.
// `subscription` is the freshest copy the webhook has (re-read from Stripe for
// invoice and cancellation events), which is what protects against late or
// out-of-order deliveries.

export type BillingEmail =
  | { kind: "subscription_activated"; amountPaid: number; currency: string; renewsAt: Date | null }
  | { kind: "payment_succeeded"; amountPaid: number; currency: string; renewsAt: Date | null }
  | { kind: "payment_failed"; amountDue: number; currency: string; nextAttemptAt: Date | null }
  | { kind: "cancellation_scheduled"; endsAt: Date | null }
  | { kind: "subscription_ended" }

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"])

function fromUnix(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null
}

export function readPeriodEnd(sub: Stripe.Subscription | null): Date | null {
  if (!sub) return null
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end
  return fromUnix(typeof legacy === "number" ? legacy : sub.items?.data?.[0]?.current_period_end)
}

function isScheduledToCancel(sub: Pick<Stripe.Subscription, "cancel_at" | "cancel_at_period_end">) {
  return Boolean(sub.cancel_at_period_end) || sub.cancel_at != null
}

/** True when an update event changed either cancellation field. */
export function touchesCancellation(event: Stripe.Event) {
  if (event.type !== "customer.subscription.updated") return false
  const prev = (event.data.previous_attributes ?? {}) as Record<string, unknown>
  return "cancel_at" in prev || "cancel_at_period_end" in prev
}

export function billingEmailForEvent(
  event: Stripe.Event,
  subscription: Stripe.Subscription | null,
): BillingEmail | null {
  switch (event.type) {
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice
      // Only confirmed, non-zero payments ever produce a payment email.
      if (invoice.status !== "paid" || !(invoice.amount_paid > 0)) return null
      const base = {
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        renewsAt: readPeriodEnd(subscription),
      }
      if (invoice.billing_reason === "subscription_create") {
        // A late delivery for a subscription that has since ended is still a
        // real payment, so it becomes a plain receipt instead of "activated".
        return subscription && LIVE_STATUSES.has(subscription.status)
          ? { kind: "subscription_activated", ...base }
          : { kind: "payment_succeeded", ...base, renewsAt: null }
      }
      if (invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_update") {
        return { kind: "payment_succeeded", ...base }
      }
      return null
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      if (!(invoice.amount_due > 0)) return null
      // Nothing to fix once the subscription is gone, or if it has been paid
      // since (an older failure arriving after a successful retry).
      if (subscription && (subscription.status === "canceled" || subscription.status === "active")) {
        return null
      }
      return {
        kind: "payment_failed",
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        nextAttemptAt: fromUnix(invoice.next_payment_attempt),
      }
    }

    case "customer.subscription.updated": {
      if (!touchesCancellation(event) || !subscription) return null
      const previous = event.data.previous_attributes as Partial<Stripe.Subscription>
      const atEvent = event.data.object as Stripe.Subscription
      const wasScheduled = isScheduledToCancel({
        cancel_at: "cancel_at" in previous ? previous.cancel_at ?? null : atEvent.cancel_at,
        cancel_at_period_end:
          "cancel_at_period_end" in previous
            ? Boolean(previous.cancel_at_period_end)
            : atEvent.cancel_at_period_end,
      })
      // Confirm against the live subscription: if it was resumed after this
      // event, the email would be wrong.
      const stillScheduled = isScheduledToCancel(subscription) && subscription.status !== "canceled"
      if (wasScheduled || !stillScheduled) return null
      return {
        kind: "cancellation_scheduled",
        endsAt: fromUnix(subscription.cancel_at) ?? readPeriodEnd(subscription),
      }
    }

    case "customer.subscription.deleted":
      return { kind: "subscription_ended" }

    default:
      return null
  }
}

export function billingEmailIdempotencyKey(event: Pick<Stripe.Event, "id">) {
  return `billing-email/${event.id}`
}
