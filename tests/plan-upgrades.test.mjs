import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  UPGRADE_LADDER,
  canUpgradeTo,
  describeUpgrades,
  isOnLadder,
  offerFor,
  offersFor,
  rungOf,
} from "../lib/plan-upgrades.ts"
import { PLANS } from "../lib/plans.ts"

// Every supported upgrade path, and — just as importantly — every path that
// must not be offered. These rules decide what a school is charged, so each one
// is pinned here rather than left to the screens that read them.

function situation(overrides = {}) {
  return {
    currentPlan: "teacher_pro",
    currentPlanLive: true,
    canManage: true,
    stripeManaged: true,
    ...overrides,
  }
}

describe("the upgrade ladder", () => {
  it("runs from the individual teacher plan up to MAT", () => {
    assert.deepEqual(
      [...UPGRADE_LADDER],
      ["teacher_pro", "school_small", "school_medium", "school_large"],
    )
  })

  it("excludes Student Pro: a pupil never buys a school", () => {
    assert.equal(isOnLadder("student_pro"), false)
    assert.equal(rungOf("student_pro"), -1)
  })

  it("treats the free tier as off the ladder", () => {
    assert.equal(isOnLadder(null), false)
    assert.equal(rungOf(null), -1)
  })
})

describe("describeUpgrades", () => {
  it("individual Teacher Pro is offered all three school tiers", () => {
    const decision = describeUpgrades(situation())
    assert.deepEqual(decision.options, ["school_small", "school_medium", "school_large"])
    assert.equal(decision.reason, "available")
    assert.equal(decision.atTopTier, false)
  })

  it("Small School is offered School and MAT only", () => {
    const decision = describeUpgrades(situation({ currentPlan: "school_small" }))
    assert.deepEqual(decision.options, ["school_medium", "school_large"])
    assert.equal(decision.reason, "available")
  })

  it("School is offered MAT only", () => {
    const decision = describeUpgrades(situation({ currentPlan: "school_medium" }))
    assert.deepEqual(decision.options, ["school_large"])
  })

  // The explicit requirement: the highest tier has nothing above it.
  it("MAT is the top of the ladder and is offered nothing above it", () => {
    const decision = describeUpgrades(situation({ currentPlan: "school_large" }))
    assert.deepEqual(decision.options, [])
    assert.equal(decision.atTopTier, true)
    assert.equal(decision.reason, "top_tier")
  })

  it("never offers a plan that is not a school plan", () => {
    for (const currentPlan of UPGRADE_LADDER) {
      for (const option of describeUpgrades(situation({ currentPlan })).options) {
        assert.equal(
          PLANS[option].audience,
          "school",
          `${currentPlan} was offered the non-school plan ${option}`,
        )
      }
    }
  })

  it("only ever offers strictly higher tiers", () => {
    for (const currentPlan of UPGRADE_LADDER) {
      for (const option of describeUpgrades(situation({ currentPlan })).options) {
        assert.ok(
          rungOf(option) > rungOf(currentPlan),
          `${currentPlan} was offered ${option}, which is not above it`,
        )
      }
    }
  })

  describe("who is allowed to see an upgrade at all", () => {
    it("a member who cannot manage the plan is offered nothing", () => {
      const decision = describeUpgrades(
        situation({ currentPlan: "school_small", canManage: false }),
      )
      assert.deepEqual(decision.options, [])
      assert.equal(decision.reason, "not_manageable")
    })

    it("a free-tier user is not offered an upgrade path, only an ordinary purchase", () => {
      const decision = describeUpgrades(situation({ currentPlan: null, currentPlanLive: false }))
      assert.deepEqual(decision.options, [])
      assert.equal(decision.reason, "not_upgradeable")
    })

    it("Student Pro is not offered a school upgrade", () => {
      const decision = describeUpgrades(situation({ currentPlan: "student_pro" }))
      assert.deepEqual(decision.options, [])
      assert.equal(decision.reason, "not_upgradeable")
    })

    it("inability to manage outranks every other reason", () => {
      assert.equal(
        describeUpgrades(situation({ currentPlan: "school_large", canManage: false })).reason,
        "not_manageable",
      )
    })

    // A plan arranged offline has no Stripe subscription to move to a new
    // tier, so offering the upgrade could only ever fail.
    it("a plan not backed by Stripe is explained rather than offered", () => {
      const decision = describeUpgrades(
        situation({ currentPlan: "school_small", stripeManaged: false }),
      )
      assert.deepEqual(decision.options, [])
      assert.equal(decision.reason, "not_stripe_managed")
    })

    it("still reports the top tier as the top tier when it was arranged offline", () => {
      const decision = describeUpgrades(
        situation({ currentPlan: "school_large", stripeManaged: false }),
      )
      assert.equal(decision.reason, "top_tier")
      assert.equal(decision.atTopTier, true)
    })
  })

  describe("what happens to an existing individual subscription", () => {
    it("a live Teacher Pro plan is set to stop renewing", () => {
      assert.equal(describeUpgrades(situation()).individualPlanAction, "stop_renewal")
    })

    it("a lapsed Teacher Pro plan needs no cancellation", () => {
      assert.equal(
        describeUpgrades(situation({ currentPlanLive: false })).individualPlanAction,
        "none",
      )
    })

    it("a school tier change touches no individual subscription", () => {
      for (const currentPlan of ["school_small", "school_medium"]) {
        assert.equal(
          describeUpgrades(situation({ currentPlan })).individualPlanAction,
          "none",
          `${currentPlan} should not promise to cancel an individual plan`,
        )
      }
    })
  })
})

describe("canUpgradeTo", () => {
  it("accepts each supported step", () => {
    assert.equal(canUpgradeTo("teacher_pro", "school_small"), true)
    assert.equal(canUpgradeTo("teacher_pro", "school_medium"), true)
    assert.equal(canUpgradeTo("teacher_pro", "school_large"), true)
    assert.equal(canUpgradeTo("school_small", "school_medium"), true)
    assert.equal(canUpgradeTo("school_small", "school_large"), true)
    assert.equal(canUpgradeTo("school_medium", "school_large"), true)
  })

  it("rejects downgrades", () => {
    assert.equal(canUpgradeTo("school_large", "school_medium"), false)
    assert.equal(canUpgradeTo("school_medium", "school_small"), false)
    assert.equal(canUpgradeTo("school_small", "teacher_pro"), false)
  })

  it("rejects staying put, so a repeated click cannot re-charge", () => {
    for (const planId of UPGRADE_LADDER) {
      assert.equal(canUpgradeTo(planId, planId), false)
    }
  })

  it("rejects targets that are not school plans", () => {
    assert.equal(canUpgradeTo("teacher_pro", "teacher_pro"), false)
    assert.equal(canUpgradeTo("teacher_pro", "student_pro"), false)
  })

  it("rejects a starting point that is off the ladder", () => {
    assert.equal(canUpgradeTo(null, "school_small"), false)
    assert.equal(canUpgradeTo("student_pro", "school_small"), false)
  })
})

describe("offerFor", () => {
  it("quotes the configured price and interval, not an invented one", () => {
    const offer = offerFor("school_small", "school_medium")
    assert.equal(offer.priceInPence, PLANS.school_medium.priceInPence)
    assert.equal(offer.originalPriceInPence, PLANS.school_medium.originalPriceInPence)
    assert.equal(offer.interval, PLANS.school_medium.interval)
    assert.equal(offer.name, PLANS.school_medium.name)
  })

  it("resolves a getter-backed price to a plain number for the client", () => {
    const offer = offerFor("school_small", "school_medium")
    assert.equal(typeof offer.priceInPence, "number")
    assert.equal(
      Object.getOwnPropertyDescriptor(offer, "priceInPence").get,
      undefined,
      "the offer must carry a value, not a live getter",
    )
  })

  it("reports the seats gained when both plans have allowances", () => {
    const offer = offerFor("school_small", "school_medium")
    assert.equal(offer.teacherSeatLimit, 9)
    assert.equal(offer.studentSeatLimit, 900)
    assert.equal(offer.extraTeacherSeats, 4)
    assert.equal(offer.extraStudentSeats, 400)
  })

  it("reports no delta from an individual plan, which has no seat allowance", () => {
    const offer = offerFor("teacher_pro", "school_small")
    assert.equal(offer.extraTeacherSeats, null)
    assert.equal(offer.extraStudentSeats, null)
    assert.equal(offer.teacherSeatLimit, 5, "the absolute allowance is still quoted")
    assert.equal(offer.studentSeatLimit, 500)
  })

  it("never reports a negative seat change on a supported path", () => {
    for (const currentPlan of UPGRADE_LADDER) {
      for (const offer of offersFor(situation({ currentPlan }))) {
        for (const delta of [offer.extraTeacherSeats, offer.extraStudentSeats]) {
          if (delta !== null) {
            assert.ok(delta > 0, `${currentPlan} to ${offer.planId} lost seats`)
          }
        }
      }
    }
  })
})
