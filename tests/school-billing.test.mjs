import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { describeSchoolPlan } from "../lib/school-billing.ts"

// The subscription-state matrix for a school plan. The bug this covers was a
// "Manage billing" button offered for every active plan, including plans that
// have no Stripe customer behind them, where opening the portal is impossible
// and the only possible outcome was "No billing account found".

const PERIOD_END = new Date("2027-10-01T15:00:00Z")

function plan(overrides = {}) {
  return {
    status: "active",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    manageable: true,
    ...overrides,
  }
}

describe("describeSchoolPlan", () => {
  it("no plan at all: nothing active, nothing to manage", () => {
    const view = describeSchoolPlan(null, true)
    assert.equal(view.active, false)
    assert.equal(view.canOpenPortal, false)
    assert.equal(view.notice, "none")
    assert.equal(view.periodKind, "unknown")
  })

  it("active Stripe plan: admin gets the portal and a renewal date", () => {
    const view = describeSchoolPlan(plan(), true)
    assert.equal(view.active, true)
    assert.equal(view.scheduledToCancel, false)
    assert.equal(view.canOpenPortal, true)
    assert.equal(view.periodKind, "renews")
    assert.equal(view.portalLabel, "Manage billing")
    assert.equal(view.notice, "none")
  })

  it("trialing counts as active", () => {
    assert.equal(describeSchoolPlan(plan({ status: "trialing" }), true).active, true)
  })

  it("scheduled to cancel: the date means an ending, and the portal reactivates", () => {
    const view = describeSchoolPlan(plan({ cancelAtPeriodEnd: true }), true)
    assert.equal(view.active, true, "access continues until the period ends")
    assert.equal(view.scheduledToCancel, true)
    assert.equal(view.periodKind, "ends")
    assert.equal(view.portalLabel, "Reactivate or update")
    assert.equal(view.notice, "ending")
    assert.equal(view.canOpenPortal, true)
  })

  // The regression under test: active, but granted outside Stripe.
  it("active plan with no Stripe customer: no portal button, an explanation instead", () => {
    const view = describeSchoolPlan(plan({ manageable: false }), true)
    assert.equal(view.active, true, "the school still has Pro")
    assert.equal(view.canOpenPortal, false, "the portal cannot open without a customer")
    assert.equal(view.notice, "not_stripe_managed")
    assert.equal(view.periodKind, "renews")
  })

  it("cancelled plan: not active, so no controls and no misleading date", () => {
    const view = describeSchoolPlan(plan({ status: "canceled" }), true)
    assert.equal(view.active, false)
    assert.equal(view.scheduledToCancel, false)
    assert.equal(view.canOpenPortal, false)
    assert.equal(view.periodKind, "unknown")
    assert.equal(view.notice, "none")
  })

  it("failed payment (past_due) does not grant access", () => {
    const view = describeSchoolPlan(plan({ status: "past_due" }), true)
    assert.equal(view.active, false)
    assert.equal(view.canOpenPortal, false)
  })

  it("awaiting first payment (incomplete) does not grant access", () => {
    assert.equal(describeSchoolPlan(plan({ status: "incomplete" }), true).active, false)
  })

  it("active plan with no period end still shows no invented date", () => {
    const view = describeSchoolPlan(plan({ currentPeriodEnd: null }), true)
    assert.equal(view.active, true)
    assert.equal(view.periodKind, "unknown")
  })

  describe("a member who is not an administrator", () => {
    it("sees the plan but is offered no billing control", () => {
      const view = describeSchoolPlan(plan(), false)
      assert.equal(view.active, true)
      assert.equal(view.periodKind, "renews")
      assert.equal(view.canOpenPortal, false)
      assert.equal(view.notice, "none")
    })

    it("is not shown administrator-facing notices", () => {
      assert.equal(describeSchoolPlan(plan({ cancelAtPeriodEnd: true }), false).notice, "none")
      assert.equal(describeSchoolPlan(plan({ manageable: false }), false).notice, "none")
    })

    it("is never offered a portal, even for a cancelling plan", () => {
      const view = describeSchoolPlan(plan({ cancelAtPeriodEnd: true }), false)
      assert.equal(view.canOpenPortal, false)
    })
  })
})
