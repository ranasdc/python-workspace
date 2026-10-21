import {
  PLANS,
  type BillingInterval,
  type PlanId,
  isSchoolPlan,
  priceFor,
} from "@/lib/plans"

// The subscription ladder and the rules for climbing it.
//
// Pure and dependency-free, for the same reason lib/school-billing.ts is: the
// server action that charges a card and the screen that promises what the card
// will be charged have to agree, and the only way to guarantee that is to have
// them read one rule rather than two implementations of it. It also means every
// upgrade path can be tested without Stripe, a database or a browser.
//
// This module decides nothing about access. lib/entitlements.ts remains the
// only authority on what a subscription actually unlocks.

/**
 * Every plan a subscriber can climb, in order.
 *
 * Teacher Pro is the bottom rung because an individual teacher upgrading to
 * their first school plan is the same journey as a school moving up a tier —
 * only the Stripe mechanics differ. Student Pro is deliberately absent: a pupil
 * does not buy a school, and school access reaches them through their teacher.
 */
export const UPGRADE_LADDER = [
  "teacher_pro",
  "school_small",
  "school_medium",
  "school_large",
] as const

export type LadderPlanId = (typeof UPGRADE_LADDER)[number]

export function isOnLadder(planId: PlanId | null | undefined): planId is LadderPlanId {
  return Boolean(planId) && (UPGRADE_LADDER as readonly string[]).includes(planId as string)
}

/** Position on the ladder, or -1 for a plan that is not on it. */
export function rungOf(planId: PlanId | null | undefined): number {
  return isOnLadder(planId) ? UPGRADE_LADDER.indexOf(planId) : -1
}

/**
 * Whether `to` is genuinely a step up from `from`.
 *
 * The server calls this before touching Stripe, so a forged request naming a
 * cheaper plan is rejected rather than quietly processed as a downgrade — which
 * this task does not implement and which Stripe would happily carry out.
 */
export function canUpgradeTo(from: PlanId | null | undefined, to: PlanId): boolean {
  if (!isOnLadder(to)) return false
  // The target must always be a school plan: the ladder's only individual rung
  // is its bottom one, so "upgrading" to Teacher Pro is never a step up.
  if (!isSchoolPlan(to)) return false
  const fromRung = rungOf(from)
  if (fromRung === -1) return false
  return UPGRADE_LADDER.indexOf(to) > fromRung
}

export type UpgradeSituation = {
  /**
   * The plan the subscriber is actually on, resolved server-side. A live school
   * plan outranks an individual one, because that is the plan whose tier would
   * change.
   */
  currentPlan: PlanId | null
  /** Whether that plan is currently paid and unexpired. */
  currentPlanLive: boolean
  /**
   * Whether this viewer may change this plan: they own it personally, or they
   * administer the school that owns it. Re-checked on the server before any
   * charge; here it only decides what to offer.
   */
  canManage: boolean
  /**
   * Whether the plan that would change is actually backed by a Stripe
   * subscription.
   *
   * A school plan arranged directly — a pilot, a migrated school, an invoice
   * settled offline — is genuinely active and genuinely grants Pro, but there
   * is no subscription to move to a new tier, so offering the upgrade could
   * only ever fail. Vacuously true when there is no school plan yet, because
   * that path buys a fresh subscription rather than changing one.
   */
  stripeManaged: boolean
}

export type UpgradeDecision = {
  /** Higher tiers this subscriber may move to, cheapest first. */
  options: LadderPlanId[]
  /** True when they already hold the highest plan sold. */
  atTopTier: boolean
  /** Why there is nothing to offer, so each case can be explained in its own words. */
  reason:
    | "available"
    | "top_tier"
    | "not_manageable"
    | "not_upgradeable"
    | "not_stripe_managed"
  /**
   * What must happen to an existing individual subscription once the school
   * plan is verified active.
   *
   * "stop_renewal" means the individual plan is set to stop at the end of the
   * term it has already been paid for: no refund to chase, no second charge,
   * and no gap in access. Anything other than "none" has to be stated on the
   * confirmation screen before the user commits, because it changes what they
   * will be billed.
   */
  individualPlanAction: "none" | "stop_renewal"
}

export function describeUpgrades(situation: UpgradeSituation): UpgradeDecision {
  const none: Pick<UpgradeDecision, "options" | "individualPlanAction"> = {
    options: [],
    individualPlanAction: "none",
  }

  // Someone who cannot change the plan is not told what they could change it
  // to. A teacher inside a school is the case that matters: the plan is real,
  // but it is their administrator's to move.
  if (!situation.canManage) {
    return { ...none, atTopTier: false, reason: "not_manageable" }
  }

  const rung = rungOf(situation.currentPlan)
  if (rung === -1) {
    // Free tier and Student Pro both land here: there is no *upgrade* to offer,
    // only the ordinary purchase the pricing page already handles.
    return { ...none, atTopTier: false, reason: "not_upgradeable" }
  }

  const options = UPGRADE_LADDER.slice(rung + 1).filter((id) => isSchoolPlan(id))

  // Checked before Stripe management, because a MAT plan has nothing above it
  // however it was arranged: "you are on the highest plan" is the true answer,
  // and "we cannot change this plan" would merely be a confusing one.
  if (options.length === 0) {
    return { ...none, atTopTier: true, reason: "top_tier" }
  }

  if (!situation.stripeManaged) {
    return { ...none, atTopTier: false, reason: "not_stripe_managed" }
  }

  return {
    options: [...options],
    atTopTier: false,
    reason: "available",
    // Only a live individual plan can double-bill. A lapsed one is already
    // charging nothing, so promising to stop it would be theatre.
    individualPlanAction:
      situation.currentPlan === "teacher_pro" && situation.currentPlanLive
        ? "stop_renewal"
        : "none",
  }
}

/**
 * What the old individual plan's fate depends on.
 *
 * All of it is read from Stripe's own copy of the school subscription and from
 * our record of the individual one — never from anything the client sent.
 */
export type SettlementInputs = {
  /** The upgrade marker stamped on the school subscription at checkout. */
  upgradedFrom: string | null | undefined
  /** The plan that subscription is for. */
  targetPlan: PlanId | null | undefined
  /** Whether Stripe currently reports the school plan as paid and unexpired. */
  schoolPlanLive: boolean
  /** The plan our records show the teacher paying for personally. */
  individualPlan: PlanId | null | undefined
  /** Whether that individual plan is backed by a Stripe subscription. */
  individualHasStripeSubscription: boolean
  /** Whether it is already set to stop at the end of its term. */
  individualAlreadyStopping: boolean
}

export type SettlementVerdict =
  | "stop_renewal"
  | "not_applicable"
  | "nothing_to_settle"
  | "already_settled"

/**
 * Whether an upgraded teacher's personal plan should stop renewing yet.
 *
 * This is the ordering rule the whole upgrade depends on, which is why it lives
 * here as a pure function rather than inline beside the Stripe call: the plan
 * being replaced must not stop until the plan replacing it is verified paid, or
 * a teacher who abandons payment is left with nothing. Separating the decision
 * from the act means that guarantee can be tested exhaustively without Stripe.
 *
 * Deliberately conservative: every uncertain case resolves to leaving the
 * individual plan alone. The cost of wrongly keeping it is one more month
 * billed and refundable; the cost of wrongly stopping it is a paying teacher
 * losing access to their classes.
 */
export function decideSettlement(inputs: SettlementInputs): SettlementVerdict {
  // Only a subscription explicitly stamped as an upgrade is eligible, so an
  // ordinary school purchase can never stop a bystander's personal plan.
  if (inputs.upgradedFrom !== "teacher_pro") return "not_applicable"

  // The target must really be a school plan. A corrupted or forged marker
  // naming something else is not an upgrade and settles nothing.
  if (!inputs.targetPlan || !isSchoolPlan(inputs.targetPlan)) return "not_applicable"

  // The verification gate. Until Stripe says the school plan is live, the old
  // plan is the only thing granting this teacher access.
  if (!inputs.schoolPlanLive) return "not_applicable"

  if (inputs.individualPlan !== "teacher_pro") return "nothing_to_settle"
  if (!inputs.individualHasStripeSubscription) return "nothing_to_settle"
  if (inputs.individualAlreadyStopping) return "already_settled"

  return "stop_renewal"
}

/**
 * One upgrade, priced and sized.
 *
 * Returned as plain data rather than as a `Plan` so it can cross to a client
 * component, and priced on one explicit interval, resolved here on the server
 * at the moment of asking. The price quoted on screen is therefore the same
 * number the server will charge.
 */
export type UpgradeOffer = {
  planId: LadderPlanId
  name: string
  blurb: string
  features: string[]
  priceInPence: number
  /** Null when the tier has no verified list price, i.e. is not sale priced. */
  originalPriceInPence: number | null
  interval: BillingInterval
  teacherSeatLimit: number | null
  studentSeatLimit: number | null
  /**
   * Seats gained over the current plan, or null when the two cannot be
   * compared — an individual plan has no seat allowance to count up from, so
   * quoting "+5 teacher seats" would be inventing a baseline of zero.
   */
  extraTeacherSeats: number | null
  extraStudentSeats: number | null
}

function seatLimits(planId: PlanId) {
  const plan = PLANS[planId]
  return {
    teacher: plan.teacherSeatLimit ?? null,
    student: plan.studentSeatLimit ?? null,
  }
}

/**
 * @param interval The interval the buyer is already on, when they are on one.
 *   An upgrade must not move a monthly subscriber onto an annual bill, so a
 *   school paying monthly has to be quoted the monthly amount for the tier
 *   above — quoting the annual price would be showing them a figure the
 *   upgrade is never going to charge. Falls back to the tier's own default for
 *   a buyer who has no interval yet.
 */
export function offerFor(
  from: PlanId | null | undefined,
  to: LadderPlanId,
  interval?: BillingInterval | null,
): UpgradeOffer {
  const plan = PLANS[to]
  const target = seatLimits(to)
  const current = from ? seatLimits(from) : { teacher: null, student: null }

  const delta = (next: number | null, now: number | null) =>
    next !== null && now !== null ? next - now : null

  const quoted = interval && priceFor(plan, interval) !== null ? interval : plan.interval

  return {
    planId: to,
    name: plan.name,
    blurb: plan.blurb,
    features: plan.features,
    priceInPence: priceFor(plan, quoted) ?? plan.priceInPence,
    originalPriceInPence:
      quoted === plan.interval ? (plan.originalPriceInPence ?? null) : null,
    interval: quoted,
    teacherSeatLimit: target.teacher,
    studentSeatLimit: target.student,
    extraTeacherSeats: delta(target.teacher, current.teacher),
    extraStudentSeats: delta(target.student, current.student),
  }
}

export function offersFor(
  situation: UpgradeSituation,
  interval?: BillingInterval | null,
): UpgradeOffer[] {
  return describeUpgrades(situation).options.map((id) =>
    offerFor(situation.currentPlan, id, interval),
  )
}
