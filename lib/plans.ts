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
  /**
   * Every interval this plan can actually be bought on, in pence.
   *
   * Authoritative: `priceInPence` is derived from this, checkout charges from
   * this, and every saving quoted on the pricing page is calculated from it.
   * An interval that is absent here cannot be purchased at all, which is what
   * keeps the individual plans monthly-only without a second flag saying so.
   */
  prices: Partial<Record<BillingInterval, number>>
  /** The interval the plan is sold on unless the buyer picks another. */
  interval: BillingInterval
  /** What the customer is charged on the default interval, in pence. Derived from `prices`. */
  priceInPence: number
  /**
   * A verified undiscounted list price in pence, shown struck through while a
   * sale runs.
   *
   * Optional on purpose. A plan with no entry here has no list price we can
   * evidence, so nothing is struck through and no discount is claimed for it —
   * the absence is what stops an unverified "was £349" appearing next to a
   * price that was never charged.
   */
  originalPriceInPence?: number
  blurb: string
  features: string[]
  /** Teacher seats a school tier buys. An individual plan covers its one buyer. */
  teacherSeatLimit?: number
  /**
   * How many distinct pupils the plan covers.
   *
   * Set for the school tiers and for Teacher Pro, whose pupils are counted
   * across all of that teacher's classes rather than per class. Absent means
   * genuinely uncapped, so it must stay absent rather than be written as 0 —
   * every reader treats a missing value as "no ceiling".
   */
  studentSeatLimit?: number
}

export const CURRENCY = "gbp"

/**
 * The Stripe subscription statuses that still grant access.
 *
 * Kept here, beside the plans themselves, because it is billing vocabulary
 * rather than a policy decision, and because client components have to be able
 * to read it to describe a plan. lib/entitlements.ts re-exports it and remains
 * the only module allowed to *decide* anything with it.
 */
export const ACTIVE_STATUSES = ["active", "trialing"] as const

/**
 * What the free tier actually gives each kind of user, phrased for display.
 * Kept beside the paid plans so every screen that has to say "you are still on
 * the free tier" describes it in exactly the same words.
 */
export const FREE_ALLOWANCE: Record<"student" | "teacher", string> = {
  student: "1 folder and 2 files in each IDE",
  teacher: "1 class with up to 25 students",
}

/**
 * The sitewide sale. Set `active: false` to end it everywhere.
 *
 * Which plans it covers is not listed here — it is whichever plans carry an
 * `originalPriceInPence` above their current price, so a plan leaves the sale
 * simply by having no verified list price. The banner and the price-lock
 * promise both read that same test, which is why neither can advertise a
 * discount the catalogue does not support.
 */
export const SALE = {
  active: true,
  name: "Launch sale",
  /**
   * How long a subscriber keeps the sale price, in years, counted from the day
   * they subscribe rather than from a fixed calendar date — so the promise
   * stays true however long the sale itself runs.
   *
   * Lives here rather than in the copy because it is a commercial commitment:
   * the pricing page quotes this number, and anything that renews a subscriber
   * must honour it. Changing it changes the promise, so it should only ever be
   * changed deliberately and for new subscribers.
   */
  priceLockYears: 2,
} as const

/**
 * Fills in the price a plan is advertised at from the interval it is sold on,
 * so the amount itself is written down exactly once.
 *
 * Throws rather than falling back: a tier whose default interval carries no
 * price is a configuration mistake that would otherwise reach Checkout as
 * `undefined`, and failing at import makes it impossible to deploy.
 */
function definePlan(plan: Omit<Plan, "priceInPence">): Plan {
  const priceInPence = plan.prices[plan.interval]
  if (priceInPence === undefined) {
    throw new Error(`Plan ${plan.id} has no ${plan.interval}ly price configured`)
  }
  return { ...plan, priceInPence }
}

/**
 * Pupils covered by an individually bought Teacher Pro.
 *
 * Three things have to agree on this number — the feature list below, the
 * allowance enforced in lib/entitlements.ts, and the seat figure quoted on the
 * upgrade page — so it is written once here.
 *
 * A teacher who gets Teacher Pro through their school is NOT capped by this.
 * Their pupils occupy the school's own student seats, which are sized per tier
 * and already enforced when a pupil joins the school.
 */
export const TEACHER_PRO_STUDENT_SEATS = 100

const SCHOOL_FEATURES = [
  "Every student and teacher gets Pro",
  "School invite codes",
  "Central admin dashboard",
]

function schoolFeatures(teachers: number, students: number) {
  return [
    `Up to ${teachers} teacher seats`,
    `Up to ${students.toLocaleString("en-GB")} student seats`,
    ...SCHOOL_FEATURES,
  ]
}

export const PLANS: Record<PlanId, Plan> = {
  student_pro: definePlan({
    id: "student_pro",
    name: "Student Pro",
    audience: "student",
    prices: { month: 199 },
    interval: "month",
    originalPriceInPence: 499,
    blurb: "For individual learners who want the full workspace.",
    features: [
      "Unlimited files and folders in every IDE",
      "AI assisted learning",
      "Everyday coding exercises",
      "Learning roadmaps for Python and HTML",
      "Priority support",
    ],
  }),
  teacher_pro: definePlan({
    id: "teacher_pro",
    name: "Teacher Pro",
    audience: "teacher",
    prices: { month: 999 },
    interval: "month",
    originalPriceInPence: 1899,
    blurb: "For individual teachers running their own classes.",
    // Counted across every class, not per class, so the figure cannot be read
    // as "100 each" by a teacher who runs several groups.
    studentSeatLimit: TEACHER_PRO_STUDENT_SEATS,
    features: [
      `Unlimited classes, up to ${TEACHER_PRO_STUDENT_SEATS} students in total`,
      "Every student you teach gets Pro, free",
      "Reusable lesson library",
      "Marking and feedback tools",
      "AI assisted learning for your class",
      "Priority support",
    ],
  }),
  // The three school tiers carry no `originalPriceInPence`: these amounts are
  // the current prices, not discounted ones, so there is nothing to strike
  // through and no percentage off to claim.
  school_small: definePlan({
    id: "school_small",
    name: "Small School",
    audience: "school",
    prices: { month: 1499, year: 14900 },
    interval: "year",
    blurb: "For a single department getting started.",
    teacherSeatLimit: 4,
    studentSeatLimit: 700,
    features: schoolFeatures(4, 700),
  }),
  school_medium: definePlan({
    id: "school_medium",
    name: "Big School",
    audience: "school",
    prices: { month: 2499, year: 24900 },
    interval: "year",
    blurb: "For a whole school computing department.",
    teacherSeatLimit: 8,
    studentSeatLimit: 1100,
    features: schoolFeatures(8, 1100),
  }),
  school_large: definePlan({
    id: "school_large",
    name: "MAT",
    audience: "school",
    prices: { month: 9999, year: 99900 },
    interval: "year",
    blurb: "For multi-academy trusts running computing at scale.",
    teacherSeatLimit: 50,
    studentSeatLimit: 3000,
    features: schoolFeatures(50, 3000),
  }),
}

export const SCHOOL_PLAN_IDS: PlanId[] = [
  "school_small",
  "school_medium",
  "school_large",
]

export const BILLING_INTERVALS: BillingInterval[] = ["month", "year"]

// Optional-chained because plan ids do not only arrive from our own types:
// Stripe metadata carries them back as plain strings, and a forged, renamed or
// retired id must answer "not a school plan" rather than crash the webhook that
// asked.
export function isSchoolPlan(planId: PlanId) {
  return PLANS[planId]?.audience === "school"
}

/** A plan, an interval, and the amount the pair is actually charged at. */
export type PlanPurchase = {
  plan: Plan
  interval: BillingInterval
  priceInPence: number
}

/**
 * Turns a plan id and a requested interval into something chargeable.
 *
 * The one place a client's interval choice becomes an amount. It throws on any
 * combination the catalogue does not sell, so an unknown plan, a monthly
 * request for a yearly-only plan, or a hand-edited form value can never reach
 * Stripe as a price — and the caller cannot forget to check, because there is
 * no amount to pass on until this has succeeded.
 *
 * `requested` is deliberately loose: it is typed as the raw string a client
 * actually sends, so narrowing it is this function's job rather than something
 * a call site can skip with a cast.
 */
export function resolvePurchase(planId: PlanId, requested?: string | null): PlanPurchase {
  const plan = PLANS[planId]
  if (!plan) throw new Error("Unknown plan")

  const interval = requested ?? plan.interval
  if (interval !== "month" && interval !== "year") {
    throw new Error("Unknown billing interval")
  }

  const priceInPence = priceFor(plan, interval)
  if (priceInPence === null) {
    throw new Error(`${plan.name} is not sold ${interval === "year" ? "yearly" : "monthly"}`)
  }

  return { plan, interval, priceInPence }
}

/** The price of one plan on one interval, or null when it is not sold that way. */
export function priceFor(plan: Plan, interval: BillingInterval): number | null {
  return plan.prices[interval] ?? null
}

/** Whether a plan can be bought on a given interval at all. */
export function isPurchasableOn(plan: Plan, interval: BillingInterval) {
  return priceFor(plan, interval) !== null
}

/** The intervals a plan is actually sold on, in display order. */
export function intervalsFor(plan: Plan): BillingInterval[] {
  return BILLING_INTERVALS.filter((interval) => isPurchasableOn(plan, interval))
}

export function isOnSale(plan: Plan) {
  return (
    SALE.active &&
    plan.originalPriceInPence !== undefined &&
    plan.originalPriceInPence > plan.priceInPence
  )
}

/** Whole-number percentage saved, e.g. 20 for "20% off". Rounded down so we never overstate it. */
export function discountPercent(plan: Plan) {
  if (!isOnSale(plan) || plan.originalPriceInPence === undefined) return 0
  return Math.floor(
    ((plan.originalPriceInPence - plan.priceInPence) / plan.originalPriceInPence) * 100,
  )
}

/** Every plan currently sold below a verified list price. */
export function plansOnSale(): Plan[] {
  return Object.values(PLANS).filter(isOnSale)
}

/**
 * What a buyer saves over a year by paying yearly instead of monthly.
 *
 * Returns null unless the plan is genuinely sold both ways, so a monthly-only
 * plan cannot be advertised as having an annual saving. Every figure is
 * computed from the configured amounts, which is what keeps the cards, the
 * buttons and the comparison copy from drifting apart: there is one calculation
 * and they all read it.
 */
export function annualSavingFor(plan: Plan) {
  const monthly = priceFor(plan, "month")
  const yearly = priceFor(plan, "year")
  if (monthly === null || yearly === null) return null

  const annualisedMonthlyInPence = monthly * 12
  const savingInPence = annualisedMonthlyInPence - yearly
  if (savingInPence <= 0) return null

  return {
    annualisedMonthlyInPence,
    savingInPence,
    /** One decimal place, e.g. 17.2 — the precision the comparison table quotes. */
    percent: Math.round((savingInPence / annualisedMonthlyInPence) * 1000) / 10,
  }
}

/**
 * Cost per teacher seat on one interval, in pence.
 *
 * Takes the interval so a card showing a monthly price can quote a monthly
 * per-seat figure. Dividing the annual price under a monthly headline would
 * put two different periods in the same breath and read as a far better deal
 * than the reader is being offered.
 *
 * Null when the plan has no seat allowance or is not sold on that interval.
 */
export function costPerTeacher(plan: Plan, interval: BillingInterval): number | null {
  const price = priceFor(plan, interval)
  if (price === null || !plan.teacherSeatLimit) return null
  return price / plan.teacherSeatLimit
}

/** Annual cost per teacher seat, in pence. Null when the plan has no seat allowance. */
export function annualCostPerTeacher(plan: Plan): number | null {
  return costPerTeacher(plan, "year")
}

/** Annual cost per student seat, in pence. Null when the plan has no seat allowance. */
export function annualCostPerStudentSeat(plan: Plan): number | null {
  const yearly = priceFor(plan, "year")
  if (yearly === null || !plan.studentSeatLimit) return null
  return yearly / plan.studentSeatLimit
}

export function formatPrice(priceInPence: number) {
  const pounds = priceInPence / 100
  // Grouped on both branches. The pence branch used `toFixed`, which does not
  // group, so the MAT card's twelve monthly payments read "£1199.88".
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** What a teaching account is allowed, by the plan covering it. */
export type EntitlementPlan = "free" | "student_pro" | "teacher_pro" | "school"

export type TeacherLimits = {
  /** null means unlimited. Personal workspaces never count. */
  maxClasses: number | null
  maxStudentsPerClass: number | null
  /**
   * Distinct pupils this teacher may have across all of their classes.
   *
   * Separate from `maxStudentsPerClass` because the two cap different things:
   * a per-class ceiling does nothing once a plan allows unlimited classes, so
   * Teacher Pro's allowance has to be counted over the whole account. A pupil
   * in two of the teacher's classes is one pupil, not two.
   */
  maxStudentsTotal: number | null
  maxLibraryFiles: number | null
  maxLibraryFolders: number | null
}

/**
 * An unpaid teacher can genuinely trial the product — run one real class,
 * build a small library — but not operate on it indefinitely for free.
 */
export const TEACHER_FREE_LIMITS: TeacherLimits = {
  maxClasses: 1,
  maxStudentsPerClass: 25,
  // Equal to the one class times its 25 places, stated rather than implied so
  // the ceiling still holds for a teacher who kept extra classes after a
  // downgrade and is no longer bounded by `maxClasses`.
  maxStudentsTotal: 25,
  maxLibraryFiles: 2,
  maxLibraryFolders: 2,
}

/**
 * An individually bought Teacher Pro.
 *
 * Classes and library are uncapped; pupils are not. The allowance is a single
 * pool spanning every class, so there is deliberately no per-class ceiling —
 * the teacher can split their places into whatever groups they teach.
 */
export const TEACHER_PRO_LIMITS: TeacherLimits = {
  maxClasses: null,
  maxStudentsPerClass: null,
  maxStudentsTotal: TEACHER_PRO_STUDENT_SEATS,
  maxLibraryFiles: null,
  maxLibraryFolders: null,
}

/** A school plan. Teaching is uncapped here; the school's own seats are the limit. */
export const TEACHER_UNLIMITED: TeacherLimits = {
  maxClasses: null,
  maxStudentsPerClass: null,
  maxStudentsTotal: null,
  maxLibraryFiles: null,
  maxLibraryFolders: null,
}

/**
 * Which allowance applies to a teaching account.
 *
 * Keyed on the plan rather than on how it was obtained, because the plan is
 * what the allowance belongs to and the two cannot disagree: `teacher_pro` is
 * only ever produced by an individual subscription, while a teacher covered by
 * their school resolves to `school`. That is what keeps a school's staff off
 * the Teacher Pro pupil cap — their pupils are already counted against the
 * school's student seats when they join the school, so capping them here would
 * charge the same pupil to two different allowances.
 */
export function teacherLimitsFor(
  plan: EntitlementPlan,
  hasTeacherPro: boolean,
): TeacherLimits {
  if (!hasTeacherPro) return TEACHER_FREE_LIMITS
  return plan === "teacher_pro" ? TEACHER_PRO_LIMITS : TEACHER_UNLIMITED
}

/** Always two decimal places, for per-seat figures that are pennies wide. */
export function formatPricePrecise(priceInPence: number) {
  return `£${(priceInPence / 100).toFixed(2)}`
}

/**
 * A saving percentage, keeping the decimal only when it says something.
 *
 * The annual saving works out at 17.0% on one tier and 17.2% on another, so
 * the decimal has to survive where it distinguishes them — but printing "17.0%"
 * on its own reads like a rendering fault. Rounding is never applied here: the
 * value arrives already rounded to one decimal, and rounding it again to a
 * whole number would overstate a 16.7% saving as 17%.
 */
export function formatPercent(percent: number) {
  return `${percent.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`
}

/** "a month" / "a year", for prose. */
export function intervalLabel(interval: BillingInterval) {
  return interval === "year" ? "a year" : "a month"
}

/** "Monthly" / "Yearly", for controls and headings. */
export function intervalName(interval: BillingInterval) {
  return interval === "year" ? "Yearly" : "Monthly"
}
