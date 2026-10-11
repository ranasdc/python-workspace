import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  billingEmailForEvent,
  billingEmailIdempotencyKey,
  touchesCancellation,
} from "../lib/billing-email-rules.ts"

const PERIOD_END = 1_800_000_000

function sub(overrides = {}) {
  return {
    id: "sub_1",
    status: "active",
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { userId: "user_1", planId: "student_pro" },
    items: { data: [{ current_period_end: PERIOD_END }] },
    ...overrides,
  }
}

function invoiceEvent(type, invoice) {
  return {
    id: "evt_1",
    type,
    data: { object: { status: "paid", amount_paid: 499, amount_due: 499, currency: "gbp", ...invoice } },
  }
}

function updatedEvent(object, previous) {
  return { id: "evt_2", type: "customer.subscription.updated", data: { object, previous_attributes: previous } }
}

describe("billingEmailForEvent", () => {
  it("first paid invoice activates the subscription", () => {
    const result = billingEmailForEvent(invoiceEvent("invoice.paid", { billing_reason: "subscription_create" }), sub())
    assert.equal(result.kind, "subscription_activated")
    assert.equal(result.amountPaid, 499)
    assert.equal(result.renewsAt.getTime(), PERIOD_END * 1000)
  })

  it("renewal invoice sends a payment receipt", () => {
    const result = billingEmailForEvent(invoiceEvent("invoice.paid", { billing_reason: "subscription_cycle" }), sub())
    assert.equal(result.kind, "payment_succeeded")
  })

  it("never confirms a payment that isn't paid or is zero", () => {
    assert.equal(billingEmailForEvent(invoiceEvent("invoice.paid", { status: "open", billing_reason: "subscription_cycle" }), sub()), null)
    assert.equal(billingEmailForEvent(invoiceEvent("invoice.paid", { amount_paid: 0, billing_reason: "subscription_create" }), sub()), null)
  })

  it("a late activation for an ended subscription becomes a plain receipt", () => {
    const result = billingEmailForEvent(
      invoiceEvent("invoice.paid", { billing_reason: "subscription_create" }),
      sub({ status: "canceled" }),
    )
    assert.equal(result.kind, "payment_succeeded")
    assert.equal(result.renewsAt, null)
  })

  it("failed payment includes the next retry date", () => {
    const result = billingEmailForEvent(
      invoiceEvent("invoice.payment_failed", { status: "open", amount_paid: 0, next_payment_attempt: PERIOD_END }),
      sub({ status: "past_due" }),
    )
    assert.equal(result.kind, "payment_failed")
    assert.equal(result.amountDue, 499)
    assert.equal(result.nextAttemptAt.getTime(), PERIOD_END * 1000)
  })

  it("skips stale failures once the subscription is active again or cancelled", () => {
    const failed = invoiceEvent("invoice.payment_failed", { status: "open", amount_paid: 0 })
    assert.equal(billingEmailForEvent(failed, sub({ status: "active" })), null)
    assert.equal(billingEmailForEvent(failed, sub({ status: "canceled" })), null)
  })

  it("scheduling a cancellation (portal-style cancel_at) sends one email", () => {
    const cancelAt = PERIOD_END - 100
    const live = sub({ cancel_at: cancelAt })
    const result = billingEmailForEvent(updatedEvent(live, { cancel_at: null }), live)
    assert.equal(result.kind, "cancellation_scheduled")
    assert.equal(result.endsAt.getTime(), cancelAt * 1000)
  })

  it("scheduling via cancel_at_period_end falls back to the period end", () => {
    const live = sub({ cancel_at_period_end: true })
    const result = billingEmailForEvent(updatedEvent(live, { cancel_at_period_end: false }), live)
    assert.equal(result.endsAt.getTime(), PERIOD_END * 1000)
  })

  it("does not email if the subscription was resumed before the event was processed", () => {
    const atEvent = sub({ cancel_at: PERIOD_END })
    assert.equal(billingEmailForEvent(updatedEvent(atEvent, { cancel_at: null }), sub()), null)
  })

  it("does not email for resuming, or for unrelated updates", () => {
    assert.equal(billingEmailForEvent(updatedEvent(sub(), { cancel_at: PERIOD_END }), sub()), null)
    const unrelated = updatedEvent(sub(), { metadata: {} })
    assert.equal(touchesCancellation(unrelated), false)
    assert.equal(billingEmailForEvent(unrelated, sub()), null)
  })

  it("deleted subscription sends the ended email", () => {
    const event = { id: "evt_3", type: "customer.subscription.deleted", data: { object: sub({ status: "canceled" }) } }
    assert.equal(billingEmailForEvent(event, event.data.object).kind, "subscription_ended")
  })

  it("checkout completion alone never sends a payment email", () => {
    const event = { id: "evt_4", type: "checkout.session.completed", data: { object: { subscription: "sub_1" } } }
    assert.equal(billingEmailForEvent(event, sub()), null)
  })

  it("duplicate deliveries of an event share one Resend idempotency key", () => {
    assert.equal(billingEmailIdempotencyKey({ id: "evt_9" }), billingEmailIdempotencyKey({ id: "evt_9" }))
    assert.equal(billingEmailIdempotencyKey({ id: "evt_9" }), "billing-email/evt_9")
  })
})
