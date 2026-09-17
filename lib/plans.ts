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
  /** Price in pence. */
  priceInPence: number
  interval: BillingInterval
  blurb: string
  features: string[]
  /** Only meaningful for school tiers. */
  teacherSeatLimit?: number
  studentSeatLimit?: number
}

export const CURRENCY = "gbp"

export const PLANS: Record<PlanId, Plan> = {
  student_pro: {
    id: "student_pro",
    name: "Student Pro",
    audience: "student",
    priceInPence: 799,
    interval: "month",
    blurb: "For individual learners who want the full workspace.",
    features: [
      "Unlimited files and folders",
      "AI assisted learning",
      "Everyday coding exercises",
      "Roadmap to learn Python",
      "Priority support",
    ],
  },
  teacher_pro: {
    id: "teacher_pro",
    name: "Teacher Pro",
    audience: "teacher",
    priceInPence: 1999,
    interval: "month",
    blurb: "For individual teachers running their own classes.",
    features: [
      "Unlimited classes and students",
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
    priceInPence: 49900,
    interval: "year",
    blurb: "For a single department getting started.",
    teacherSeatLimit: 10,
    studentSeatLimit: 150,
    features: [
      "Up to 10 teacher seats",
      "Up to 150 student seats",
      "Every student and teacher gets Pro",
      "School invite codes",
      "Central admin dashboard",
    ],
  },
  school_medium: {
    id: "school_medium",
    name: "School",
    audience: "school",
    priceInPence: 99900,
    interval: "year",
    blurb: "For a whole school computing department.",
    teacherSeatLimit: 25,
    studentSeatLimit: 500,
    features: [
      "Up to 25 teacher seats",
      "Up to 500 student seats",
      "Every student and teacher gets Pro",
      "School invite codes",
      "Central admin dashboard",
    ],
  },
  school_large: {
    id: "school_large",
    name: "MAT",
    audience: "school",
    priceInPence: 250000,
    interval: "year",
    blurb: "For multi-academy trusts running Python at scale.",
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

export function formatPrice(priceInPence: number) {
  const pounds = priceInPence / 100
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2)}`
}
