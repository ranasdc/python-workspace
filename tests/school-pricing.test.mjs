import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BILLING_INTERVALS,
  PLANS,
  SCHOOL_PLAN_IDS,
  annualCostPerStudentSeat,
  annualCostPerTeacher,
  annualSavingFor,
  discountPercent,
  formatPrice,
  formatPricePrecise,
  intervalsFor,
  isOnSale,
  plansOnSale,
  priceFor,
  resolvePurchase,
} from "../lib/plans.ts"

// The published school pricing, pinned.
//
// Every figure a school is shown — the two prices, the saving, the percentage,
// the seat allowances — is derived from this catalogue, so this file is where
// a change to any of them has to be made deliberately. The expected values are
// written out as literals rather than recomputed from the catalogue: a test
// that calculates its own expectation agrees with the code by construction and
// would have nothing to say about a wrong price.
const PUBLISHED = {
  school_small: {
    name: "Small School",
    monthly: 1499,
    yearly: 14900,
    teachers: 4,
    students: 700,
    annualisedMonthly: 17988,
    saving: 3088,
    percent: 17.2,
    perTeacher: "£37.25",
    perStudent: "£0.21",
  },
  school_medium: {
    name: "Big School",
    monthly: 2499,
    yearly: 24900,
    teachers: 8,
    students: 1100,
    annualisedMonthly: 29988,
    saving: 5088,
    percent: 17.0,
    perTeacher: "£31.13",
    perStudent: "£0.23",
  },
  school_large: {
    name: "MAT",
    monthly: 9999,
    yearly: 99900,
    teachers: 50,
    students: 3000,
    annualisedMonthly: 119988,
    saving: 20088,
    percent: 16.7,
    perTeacher: "£19.98",
    perStudent: "£0.33",
  },
}

describe("school plan catalogue", () => {
  it("covers exactly the three school tiers", () => {
    assert.deepEqual(SCHOOL_PLAN_IDS, ["school_small", "school_medium", "school_large"])
  })

  for (const [planId, expected] of Object.entries(PUBLISHED)) {
    describe(expected.name, () => {
      const plan = PLANS[planId]

      it("is named as published", () => {
        assert.equal(plan.name, expected.name)
      })

      it("carries both prices", () => {
        assert.equal(priceFor(plan, "month"), expected.monthly)
        assert.equal(priceFor(plan, "year"), expected.yearly)
        assert.deepEqual(intervalsFor(plan), ["month", "year"])
      })

      it("carries the published seat allowances", () => {
        assert.equal(plan.teacherSeatLimit, expected.teachers)
        assert.equal(plan.studentSeatLimit, expected.students)
      })

      it("quotes the annual saving against twelve monthly payments", () => {
        const saving = annualSavingFor(plan)
        assert.equal(saving.annualisedMonthlyInPence, expected.annualisedMonthly)
        assert.equal(saving.savingInPence, expected.saving)
        assert.equal(saving.percent, expected.percent)
      })

      it("derives the annual saving rather than storing it", () => {
        // The relationship the pricing page states in words.
        const saving = annualSavingFor(plan)
        assert.equal(priceFor(plan, "month") * 12, saving.annualisedMonthlyInPence)
        assert.equal(
          saving.annualisedMonthlyInPence - priceFor(plan, "year"),
          saving.savingInPence,
        )
      })

      it("works out the annual cost per seat", () => {
        assert.equal(formatPricePrecise(annualCostPerTeacher(plan)), expected.perTeacher)
        assert.equal(
          formatPricePrecise(annualCostPerStudentSeat(plan)),
          expected.perStudent,
        )
      })

      it("claims no discount, because it has no list price to discount from", () => {
        assert.equal(plan.originalPriceInPence, undefined)
        assert.equal(isOnSale(plan), false)
        assert.equal(discountPercent(plan), 0)
      })

      it("defaults to the yearly price", () => {
        assert.equal(plan.interval, "year")
        assert.equal(plan.priceInPence, expected.yearly)
      })
    })
  }
})

describe("sale scope", () => {
  it("covers only the plans with a verified list price", () => {
    // Three school cards quoting plain prices sit on the same page as the sale
    // banner, so "every plan" is exactly the claim this has to keep it from
    // making.
    assert.deepEqual(
      plansOnSale().map((plan) => plan.id),
      ["student_pro", "teacher_pro"],
    )
  })

  it("never advertises more than the catalogue supports", () => {
    for (const plan of plansOnSale()) {
      const percent = discountPercent(plan)
      const real =
        ((plan.originalPriceInPence - plan.priceInPence) / plan.originalPriceInPence) * 100
      assert.ok(percent <= real, `${plan.name} overstates its discount`)
      assert.ok(plan.originalPriceInPence > plan.priceInPence)
    }
  })
})

describe("resolvePurchase", () => {
  it("prices all six school combinations", () => {
    for (const [planId, expected] of Object.entries(PUBLISHED)) {
      assert.equal(resolvePurchase(planId, "month").priceInPence, expected.monthly)
      assert.equal(resolvePurchase(planId, "month").interval, "month")
      assert.equal(resolvePurchase(planId, "year").priceInPence, expected.yearly)
      assert.equal(resolvePurchase(planId, "year").interval, "year")
    }
  })

  it("falls back to the interval the plan is sold on", () => {
    for (const requested of [undefined, null]) {
      const purchase = resolvePurchase("school_small", requested)
      assert.equal(purchase.interval, "year")
      assert.equal(purchase.priceInPence, 14900)
    }
  })

  it("refuses an interval the plan is not sold on", () => {
    // Student Pro and Teacher Pro are monthly only. A yearly request for one
    // must fail rather than quietly charge a month's price for a year.
    assert.throws(() => resolvePurchase("student_pro", "year"), /not sold yearly/)
    assert.throws(() => resolvePurchase("teacher_pro", "year"), /not sold yearly/)
  })

  it("refuses anything that is not a known interval", () => {
    for (const forged of ["week", "day", "YEAR", "", "0", "month "]) {
      assert.throws(
        () => resolvePurchase("school_small", forged),
        /Unknown billing interval/,
        `"${forged}" must not resolve to a price`,
      )
    }
  })

  it("refuses an unknown plan", () => {
    assert.throws(() => resolvePurchase("school_enormous", "year"), /Unknown plan/)
  })
})

describe("catalogue invariants", () => {
  it("prices every plan on the interval it says it is sold on", () => {
    for (const plan of Object.values(PLANS)) {
      assert.equal(
        plan.priceInPence,
        plan.prices[plan.interval],
        `${plan.name}'s headline price must be one of its real prices`,
      )
    }
  })

  it("sells every plan on at least one interval, at a positive price", () => {
    for (const plan of Object.values(PLANS)) {
      const sold = intervalsFor(plan)
      assert.ok(sold.length > 0, `${plan.name} is not purchasable at all`)
      for (const interval of sold) {
        assert.ok(priceFor(plan, interval) > 0, `${plan.name} is free on ${interval}`)
      }
      for (const interval of BILLING_INTERVALS) {
        if (!sold.includes(interval)) assert.equal(priceFor(plan, interval), null)
      }
    }
  })

  it("never makes paying yearly cost more than paying monthly", () => {
    for (const plan of Object.values(PLANS)) {
      const monthly = priceFor(plan, "month")
      const yearly = priceFor(plan, "year")
      if (monthly === null || yearly === null) continue
      assert.ok(
        yearly < monthly * 12,
        `${plan.name} charges more for a year up front than month by month`,
      )
    }
  })

  it("quotes no annual saving for a plan sold only one way", () => {
    assert.equal(annualSavingFor(PLANS.student_pro), null)
    assert.equal(annualSavingFor(PLANS.teacher_pro), null)
  })

  it("formats GBP the way the cards quote it", () => {
    assert.equal(formatPrice(14900), "£149")
    assert.equal(formatPrice(1499), "£14.99")
    assert.equal(formatPrice(99900), "£999")
    assert.equal(formatPrice(119988), "£1,199.88")
    assert.equal(formatPrice(3088), "£30.88")
  })
})
