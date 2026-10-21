"use server"

import { revalidatePath } from "next/cache"
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { schoolMembers, schoolSubscriptions, schools, subscriptions } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { stripe } from "@/lib/stripe"
import { getSchoolMembership } from "@/lib/account"
import { isSubscriptionLive, requireSchoolAdmin } from "@/lib/entitlements"
import {
  readStripeSubscriptionState,
  syncSubscriptionFromStripe,
} from "@/lib/billing-sync"
import { createPlanPrice, createSubscriptionCheckout, getRequestOrigin } from "@/lib/checkout"
import {
  PLANS,
  formatPrice,
  resolvePurchase,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans"
import {
  canUpgradeTo,
  describeUpgrades,
  offersFor,
  type UpgradeDecision,
  type UpgradeOffer,
} from "@/lib/plan-upgrades"

// Moving up the subscription ladder.
//
// Two mechanics sit behind one idea. An individual teacher buying their first
// school plan needs a new Stripe subscription, so that path goes through
// Checkout. A school already paying needs its existing subscription moved to a
// new tier, so that path edits the subscription in place — issuing a second
// Checkout would leave the school with two live subscriptions billing in
// parallel, which is the exact duplicate this module exists to avoid.
//
// Both paths resolve the caller's position from the database and re-check it
// here. Nothing is believed because the client said it: not the plan, not the
// price, and not the school id.

export type UpgradeContext = {
  /** Which mechanic applies, resolved from what the caller actually holds. */
  scope: "individual" | "school" | "none"
  schoolId: number | null
  schoolName: string | null
  /**
   * Whether the caller administers that school. An administrator whose school
   * has no plan yet has nothing to *upgrade*, but is one click from buying
   * their school's first plan, which is a different sentence entirely.
   */
  isSchoolAdmin: boolean
  /** True when buying a school plan also means naming a school for the first time. */
  needsSchool: boolean
  currentPlanId: PlanId | null
  currentPlanName: string
  currentPlanLive: boolean
  currentPriceInPence: number | null
  currentInterval: BillingInterval | null
  currentPeriodEnd: Date | null
  decision: UpgradeDecision
  offers: UpgradeOffer[]
}

/**
 * Where the caller sits on the ladder, and who is allowed to move them.
 *
 * Shared by the screen and by both mutations, so what a user is offered and
 * what the server will actually accept are decided by one piece of code.
 */
async function resolvePosition(userId: string) {
  const [membership, individualRow] = await Promise.all([
    getSchoolMembership(userId),
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        interval: subscriptions.interval,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
      .then((rows) => rows[0]),
  ])

  // A teacher or pupil inside a school is not the person who changes its plan,
  // even if they also happen to hold a personal subscription. Their
  // administrator owns that decision, and letting them "upgrade" would try to
  // found a second school around an account that already belongs to one.
  const memberWithoutAdmin = Boolean(membership) && !membership!.isAdmin

  const schoolRow = membership?.isAdmin
    ? await db
        .select({
          tier: schoolSubscriptions.tier,
          status: schoolSubscriptions.status,
          currentPeriodEnd: schoolSubscriptions.currentPeriodEnd,
          stripeSubscriptionId: schoolSubscriptions.stripeSubscriptionId,
        })
        .from(schoolSubscriptions)
        .where(eq(schoolSubscriptions.schoolId, membership.schoolId))
        .limit(1)
        .then((rows) => rows[0])
    : undefined

  const schoolLive = schoolRow
    ? isSubscriptionLive(schoolRow.status, schoolRow.currentPeriodEnd)
    : false
  const individualLive = individualRow
    ? isSubscriptionLive(individualRow.status, individualRow.currentPeriodEnd)
    : false
  const holdsTeacherPro = individualRow?.plan === "teacher_pro"

  // A live school plan outranks a personal one, because it is the plan whose
  // tier an upgrade would change. An administrator whose school plan has
  // lapsed, or who has not bought one yet, is treated by their personal plan —
  // which is what lets them buy their school's first plan as an upgrade.
  const onSchoolPlan = schoolLive && Boolean(schoolRow?.tier)

  const scope: UpgradeContext["scope"] = memberWithoutAdmin
    ? "none"
    : onSchoolPlan
      ? "school"
      : holdsTeacherPro
        ? "individual"
        : "none"

  const currentPlanId = onSchoolPlan
    ? (schoolRow!.tier as PlanId)
    : ((individualRow?.plan as PlanId | undefined) ?? null)

  return {
    scope,
    membership,
    schoolRow,
    individualRow,
    currentPlanId,
    currentPlanLive: onSchoolPlan ? schoolLive : individualLive,
    situation: {
      currentPlan: currentPlanId,
      currentPlanLive: onSchoolPlan ? schoolLive : individualLive,
      canManage: !memberWithoutAdmin && scope !== "none",
      // Only an existing school subscription can fail this: the individual
      // path buys a brand-new one, so there is nothing yet to be unmanageable.
      stripeManaged: onSchoolPlan ? Boolean(schoolRow?.stripeSubscriptionId) : true,
    },
  }
}

/** Everything the upgrade screen needs, resolved server-side. */
export async function getUpgradeContext(): Promise<UpgradeContext> {
  const me = await requireUser()
  const position = await resolvePosition(me.id)
  const { currentPlanId, situation } = position

  const currentPlan = currentPlanId ? PLANS[currentPlanId] : null

  return {
    scope: position.scope,
    schoolId: position.membership?.schoolId ?? null,
    schoolName: position.membership?.schoolName ?? null,
    isSchoolAdmin: Boolean(position.membership?.isAdmin),
    needsSchool: position.scope === "individual" && !position.membership,
    currentPlanId,
    currentPlanName: currentPlan?.name ?? "Free",
    currentPlanLive: position.currentPlanLive,
    // Quoted from the catalog for the plan they hold, so the comparison puts
    // the same kind of number on both sides.
    currentPriceInPence: currentPlan?.priceInPence ?? null,
    currentInterval: currentPlan?.interval ?? null,
    currentPeriodEnd:
      (position.scope === "school"
        ? position.schoolRow?.currentPeriodEnd
        : position.individualRow?.currentPeriodEnd) ?? null,
    decision: describeUpgrades(situation),
    offers: offersFor(situation),
  }
}

/**
 * Finds the school this upgrade belongs to, creating it only if the teacher has
 * none.
 *
 * Locked against the user row for the same reason seat claims are: two
 * simultaneous upgrades must not both decide "no school yet" and found one
 * each. The membership check and the insert happen inside that lock, so the
 * second request sees the first one's school and joins it instead.
 */
async function resolveSchoolForUpgrade(userId: string, requestedName: string | undefined) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from "user" where id = ${userId} for update`)

    const [existing] = await tx
      .select({ schoolId: schoolMembers.schoolId, role: schoolMembers.role })
      .from(schoolMembers)
      .where(and(eq(schoolMembers.userId, userId), eq(schoolMembers.status, "active")))
      .limit(1)

    if (existing) {
      if (existing.role !== "school_admin") {
        throw new Error("Your school's plan is managed by your school administrator")
      }
      return existing.schoolId
    }

    const name = String(requestedName ?? "").trim()
    if (!name) throw new Error("Enter the name of your school to continue")

    const [school] = await tx.insert(schools).values({ name, createdBy: userId }).returning()
    await tx.insert(schoolMembers).values({
      schoolId: school.id,
      userId,
      role: "school_admin",
    })

    return school.id
  })
}

/**
 * Individual Teacher Pro to a school plan.
 *
 * The school is created up front because Stripe needs to know which school the
 * subscription is for before it can carry that in its metadata — which is what
 * later makes the webhook self-describing. A school with no plan yet is a state
 * the school area already handles, and the same one the existing "create a
 * school, then choose a plan" flow produces, so an abandoned payment leaves
 * nothing broken behind. The existing individual subscription is untouched
 * here: it is stopped only once Stripe confirms the school plan is paid for.
 */
export async function startSchoolUpgrade(
  planId: PlanId,
  schoolName?: string,
  interval?: string | null,
) {
  const me = await requireUser()
  const position = await resolvePosition(me.id)
  const decision = describeUpgrades(position.situation)

  if (position.scope !== "individual") {
    throw new Error(
      position.scope === "school"
        ? "Your school already has a plan. Change its tier from the school area."
        : "This account cannot be upgraded to a school plan.",
    )
  }

  // Re-checked against the caller's verified position, so a forged plan id
  // cannot buy a tier that was never on offer.
  if (decision.reason !== "available" || !canUpgradeTo(position.currentPlanId, planId)) {
    throw new Error("That is not an available upgrade for this account")
  }

  // Validated here rather than trusted: an interval the tier is not sold on
  // throws instead of quietly falling back to a different amount.
  const purchase = resolvePurchase(planId, interval)
  const schoolId = await resolveSchoolForUpgrade(me.id, schoolName)
  const origin = await getRequestOrigin()

  const metadata: Record<string, string> = {
    userId: me.id,
    planId,
    schoolId: String(schoolId),
  }

  // The instruction to wind the personal plan down, carried by the subscription
  // itself. Stamped only when there is a live plan to wind down, and read back
  // after payment is verified — never acted on here.
  if (decision.individualPlanAction === "stop_renewal") {
    metadata.upgradedFrom = "teacher_pro"
  }

  const { url } = await createSubscriptionCheckout({
    purchase,
    customerEmail: me.email,
    clientReferenceId: me.id,
    metadata,
    successUrl: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    // Cancelling returns to the comparison rather than dropping the user on the
    // public pricing page, which would have lost their place entirely.
    cancelUrl: `${origin}/billing/upgrade?cancelled=1`,
    // The interval is part of the key: changing it is a different purchase, and
    // collapsing the two would hand back the session for the amount the buyer
    // just moved away from.
    idempotencyKey: `upgrade:${me.id}:${planId}:${purchase.interval}:${schoolId}:${Math.floor(
      Date.now() / 60000,
    )}`,
  })

  revalidatePath("/school")
  return { url }
}

export type TierChangeResult = {
  ok: boolean
  status: string
  /** True when this exact change had already been applied, e.g. by a double click. */
  alreadyApplied: boolean
  planName: string
}

/**
 * Moves an existing school subscription up a tier, in place.
 *
 * Stripe is asked to swap the subscription's single item onto a price built
 * from the configured amount for the new tier, and to invoice the difference
 * now — the school gains the seats immediately, so it is charged for them
 * immediately rather than being quietly given them until renewal.
 *
 * Entitlements are not written from this function's optimism: the updated
 * subscription Stripe returns is handed to the one sync writer, so the tier and
 * seat limits recorded are whatever Stripe actually holds. A failed proration
 * invoice leaves the subscription past_due, which grants nothing.
 */
export async function changeSchoolTier(
  planId: PlanId,
  schoolId: number,
): Promise<TierChangeResult> {
  // The school id arrives from the client and is never trusted: this is what
  // stops one school's administrator moving another school's plan.
  const admin = await requireSchoolAdmin(schoolId)

  const [row] = await db
    .select({
      tier: schoolSubscriptions.tier,
      status: schoolSubscriptions.status,
      currentPeriodEnd: schoolSubscriptions.currentPeriodEnd,
      stripeSubscriptionId: schoolSubscriptions.stripeSubscriptionId,
    })
    .from(schoolSubscriptions)
    .where(eq(schoolSubscriptions.schoolId, admin.schoolId))
    .limit(1)

  if (!row) throw new Error("This school does not have a plan to upgrade yet")

  // The duplicate-click guard. The first click has already moved the tier, so
  // the second finds nothing to do and says so rather than charging again.
  if (row.tier === planId) {
    return {
      ok: isSubscriptionLive(row.status, row.currentPeriodEnd),
      status: row.status,
      alreadyApplied: true,
      planName: PLANS[planId].name,
    }
  }

  if (!canUpgradeTo(row.tier as PlanId, planId)) {
    throw new Error("That is not an available upgrade for this school's plan")
  }

  if (!row.stripeSubscriptionId) {
    throw new Error(
      "This plan was arranged directly rather than paid by card, so its tier cannot be changed here.",
    )
  }

  if (!isSubscriptionLive(row.status, row.currentPeriodEnd)) {
    throw new Error(
      "This plan is not currently active. Restore it from the billing portal before upgrading.",
    )
  }

  const current = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)
  const item = current.items?.data?.[0]
  if (!item) throw new Error("This subscription has no billable item to upgrade")

  // The interval comes from Stripe's own copy of what this school renews on,
  // not from the catalogue default and not from our stored column. A tier
  // change must never also move someone between monthly and yearly: doing so
  // would re-date their renewal and re-price their plan by a factor of ten
  // without them ever asking for it. Taking it from the live subscription also
  // means a row synced before the interval column existed is still handled
  // correctly.
  const currentInterval = item.price?.recurring?.interval
  if (currentInterval !== "month" && currentInterval !== "year") {
    throw new Error(
      "This subscription does not renew on a monthly or yearly cycle, so its tier cannot be changed here.",
    )
  }

  const purchase = resolvePurchase(planId, currentInterval)
  const plan = purchase.plan
  const price = await createPlanPrice(purchase)

  const updated = await stripe.subscriptions.update(
    row.stripeSubscriptionId,
    {
      items: [{ id: item.id, price, quantity: 1 }],
      // Bill the difference now, so seats are paid for at the moment they are
      // granted rather than at renewal.
      proration_behavior: "always_invoice",
      // The metadata is what the sync writer reads to decide the tier, so it
      // has to name the new plan. Spread first so the upgrade marker and the
      // school id set at purchase survive.
      metadata: { ...current.metadata, planId, schoolId: String(admin.schoolId) },
    },
    {
      idempotencyKey: `tier:${admin.schoolId}:${planId}:${Math.floor(Date.now() / 60000)}`,
    },
  )

  await syncSubscriptionFromStripe(updated)

  revalidatePath("/school")
  revalidatePath("/billing")
  revalidatePath("/account")

  return {
    // Reported from Stripe's status, not from the call having returned. An
    // upgrade whose proration invoice fails is not a successful upgrade.
    ok: readStripeSubscriptionState(updated).live,
    status: updated.status,
    alreadyApplied: false,
    planName: `${plan.name} (${formatPrice(purchase.priceInPence)} per ${purchase.interval})`,
  }
}
