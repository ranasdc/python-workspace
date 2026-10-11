import "server-only"

import type Stripe from "stripe"
import { eq } from "drizzle-orm"

import { getBaseURL } from "@/lib/app-url"
import {
  billingEmailForEvent,
  billingEmailIdempotencyKey,
  touchesCancellation,
} from "@/lib/billing-email-rules"
import { db } from "@/lib/db"
import { schools, user } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"
import {
  cancellationScheduledEmail,
  formatDate,
  formatMoney,
  paymentFailedEmail,
  paymentSucceededEmail,
  subscriptionActivatedEmail,
  subscriptionEndedEmail,
  welcomeEmail,
} from "@/lib/email-templates"
import { PLANS, type PlanId } from "@/lib/plans"
import { stripe } from "@/lib/stripe"

/**
 * Sent once per account from Better Auth's `user.create.after` hook. A retried
 * sign-up with the same email fails the unique constraint before this runs, and
 * the Resend idempotency key covers any retry of the hook itself.
 */
export async function sendWelcomeEmail(newUser: {
  id: string
  email: string
  name?: string | null
  role?: string | null
}) {
  try {
    const result = await sendEmail({
      to: newUser.email,
      ...welcomeEmail({
        name: newUser.name,
        role: newUser.role,
        dashboardUrl: `${getBaseURL()}/dashboard`,
      }),
      idempotencyKey: `welcome/${newUser.id}`,
    })
    if (!result.ok) console.warn("[email] welcome email not sent:", result.reason, newUser.id)
  } catch (error) {
    console.error("[email] welcome email failed:", error instanceof Error ? error.message : error)
  }
}

async function resolveRecipient(sub: Stripe.Subscription | null, event: Stripe.Event) {
  const userId = sub?.metadata?.userId
  if (userId) {
    const [row] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    if (row?.email) return row
  }
  // Fall back to the address Stripe billed, e.g. if the account was deleted.
  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice
    if (invoice.customer_email) return { email: invoice.customer_email, name: invoice.customer_name }
  }
  return null
}

async function describePlan(sub: Stripe.Subscription | null) {
  const planId = sub?.metadata?.planId as PlanId | undefined
  const planName = (planId && PLANS[planId]?.name) || "MyCodePad"
  const schoolId = Number(sub?.metadata?.schoolId)
  if (!Number.isFinite(schoolId) || schoolId <= 0) return planName
  const [school] = await db
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1)
  return school ? `${planName} (${school.name})` : planName
}

/**
 * Called by the Stripe webhook only after the event has been applied and its
 * `stripe_event` marker committed, so duplicate deliveries never reach here.
 * Never throws: an email problem must not make Stripe retry a handled event.
 */
export async function sendBillingEmailForEvent(
  event: Stripe.Event,
  subscription: Stripe.Subscription | null,
) {
  try {
    let sub = subscription
    if (touchesCancellation(event) && sub) {
      sub = await stripe.subscriptions.retrieve(sub.id)
    }

    const decision = billingEmailForEvent(event, sub)
    if (!decision) return

    const recipient = await resolveRecipient(sub, event)
    if (!recipient) {
      console.warn("[email] billing email skipped, no recipient:", decision.kind, event.id)
      return
    }

    const planName = await describePlan(sub)
    const billingUrl = `${getBaseURL()}/billing`
    const name = recipient.name

    const message = (() => {
      switch (decision.kind) {
        case "subscription_activated":
          return subscriptionActivatedEmail({
            name,
            planName,
            amount: formatMoney(decision.amountPaid, decision.currency),
            renewsOn: decision.renewsAt ? formatDate(decision.renewsAt) : null,
            billingUrl,
          })
        case "payment_succeeded":
          return paymentSucceededEmail({
            name,
            planName,
            amount: formatMoney(decision.amountPaid, decision.currency),
            renewsOn: decision.renewsAt ? formatDate(decision.renewsAt) : null,
            billingUrl,
          })
        case "payment_failed":
          return paymentFailedEmail({
            name,
            planName,
            amount: formatMoney(decision.amountDue, decision.currency),
            nextAttemptOn: decision.nextAttemptAt ? formatDate(decision.nextAttemptAt) : null,
            billingUrl,
          })
        case "cancellation_scheduled":
          return cancellationScheduledEmail({
            name,
            planName,
            endsOn: decision.endsAt ? formatDate(decision.endsAt) : null,
            billingUrl,
          })
        case "subscription_ended":
          return subscriptionEndedEmail({ name, planName, billingUrl })
      }
    })()

    const result = await sendEmail({
      to: recipient.email,
      ...message,
      idempotencyKey: billingEmailIdempotencyKey(event),
    })
    if (!result.ok) {
      console.warn("[email] billing email not sent:", decision.kind, event.id, result.reason)
    }
  } catch (error) {
    console.error(
      "[email] billing email failed:",
      event.id,
      error instanceof Error ? error.message : error,
    )
  }
}
