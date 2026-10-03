// Single source of truth for pricing. Safe to import from client components:
// it contains no secrets. Prices are always read from here on the server when
// creating a Checkout Session, never from the client.

export type PlanId =
  | "student_pro"
  | "teacher_pro"
  | "school_small"
  | "school_medium"
  | "school_large"

export type BillingInterval = "month" | "year"

export type Plan = {
  id: PlanId
  name: string
  audience: "student" | "teacher" | "school"
  /** What the customer is actually charged, in pence. During a sale this is the sale price. */
  priceInPence: number
  /** The undiscounted list price in pence, shown struck through while a sale runs. */
  originalPriceInPence: number
  interval: BillingInterval
  blurb: string
  features: string[]
  /** Only meaningful for school tiers. */
  teacherSeatLimit?: number
  studentSeatLimit?: number
}

export const CURRENCY = "gbp"

/**
 * What the free tier actually gives each kind of user, phrased for display.
 * Kept beside the paid plans so every screen that has to say "you are still on
 * the free tier" describes it in exactly the same words.
 */
export const FREE_ALLOWANCE: Record<"student" | "teacher", string> = {
  student: "1 folder and 2 files in each IDE",
  teacher: "1 class with up to 25 students",
}

/** Copy for the sitewide sale banner. Set `active: false` to end the sale everywhere. */
export const SALE = {
  active: true,
  name: "Launch sale",
  tagline: "Save up to 28% on every plan",
} as const

export const PLANS: Record<PlanId, Plan> = {
  student_pro: {
    id: "student_pro",
    name: "Student Pro",
    audience: "student",
    priceInPence: 399,
    originalPriceInPence: 499,
    interval: "month",
    blurb: "For individual learners who want the full workspace.",
    features: [
      "Unlimited files and folders in every IDE",
      "AI assisted learning",
      "Everyday coding exercises",
      "Learning roadmaps for Python and HTML",
      "Priority support",
    ],
  },
  teacher_pro: {
    id: "teacher_pro",
    name: "Teacher Pro",
    audience: "teacher",
    priceInPence: 1499,
    originalPriceInPence: 1899,
    interval: "month",
    blurb: "For individual teachers running their own classes.",
    features: [
      "Unlimited classes and students",
      "Every student you teach gets Pro, free",
      "Reusable lesson library",
      "Marking and feedback tools",
      "AI assisted learning for your class",
      "Priority support",
    ],
  },
  school_small: {
    id: "school_small",
    name: "Small School",
    audience: "school",
    priceInPence: 24900,
    originalPriceInPence: 34900,
    interval: "year",
    blurb: "For a single department getting started.",
    teacherSeatLimit: 5,
    studentSeatLimit: 500,
    features: [
      "Up to 5 teacher seats",
      "Up to 500 student seats",
      "Every student and teacher gets Pro",
      "School invite codes",
      "Central admin dashboard",
    ],
  },
  school_medium: {
    id: "school_medium",
    name: "School",
    audience: "school",
    priceInPence: 34900,
    originalPriceInPence: 44900,
    interval: "year",
    blurb: "For a whole school computing department.",
    teacherSeatLimit: 9,
    studentSeatLimit: 900,
    features: [
      "Up to 9 teacher seats",
      "Up to 900 student seats",
      "Every student and teacher gets Pro",
      "School invite codes",
      "Central admin dashboard",
    ],
  },
  school_large: {
    id: "school_large",
    name: "MAT",
    audience: "school",
    priceInPence: 139900,
    originalPriceInPence: 149900,
    interval: "year",
    blurb: "For multi-academy trusts running computing at scale.",
    teacherSeatLimit: 100,
    studentSeatLimit: 2500,
    features: [
      "Up to 100 teacher seats",
      "Up to 2,500 student seats",
      "Every student and teacher gets Pro",
      "School invite codes",
      "Central admin dashboard",
    ],
  },
}

export const SCHOOL_PLAN_IDS: PlanId[] = [
  "school_small",
  "school_medium",
  "school_large",
]

export function isSchoolPlan(planId: PlanId) {
  return PLANS[planId].audience === "school"
}

export function isOnSale(plan: Plan) {
  return SALE.active && plan.originalPriceInPence > plan.priceInPence
}

/** Whole-number percentage saved, e.g. 20 for "20% off". Rounded down so we never overstate it. */
export function discountPercent(plan: Plan) {
  if (!isOnSale(plan)) return 0
  return Math.floor(((plan.originalPriceInPence - plan.priceInPence) / plan.originalPriceInPence) * 100)
}

export function formatPrice(priceInPence: number) {
  const pounds = priceInPence / 100
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2)}`
}
