import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2, AlertCircle } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { reconcileCheckoutSession } from "@/app/actions/billing"
import { buttonVariants } from "@/components/ui/button"
import { PLANS, type PlanId, isSchoolPlan } from "@/lib/plans"
import type { SettlementOutcome } from "@/lib/plan-transition"

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")

  const { session_id: sessionId } = await searchParams

  let ok = false
  let message = "We couldn't find that checkout session."
  let planId: PlanId | null = null
  let settlement: SettlementOutcome | null = null

  if (sessionId) {
    try {
      // Reads the result straight from Stripe and writes the entitlement, so
      // access is granted immediately rather than waiting on webhook delivery.
      const result = await reconcileCheckoutSession(sessionId)
      ok = result.ok
      if (result.ok) {
        planId = result.planId
        settlement = result.settlement
      } else {
        message = "Your payment is still processing. Check back in a moment."
      }
    } catch (error) {
      message = error instanceof Error ? error.message : "Something went wrong."
    }
  }

  // A school plan's next step is the school area — invite codes, seats and the
  // teachers who still need adding — not the workspace the teacher came from.
  const school = planId !== null && isSchoolPlan(planId)
  const home = sessionUser.role === "teacher" ? "/teacher" : "/student"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {ok ? (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            {school && planId
              ? `${PLANS[planId].name} is active. Every teacher and student at your school now gets Pro.`
              : "Your subscription is active. Unlimited files and folders are unlocked."}
          </p>

          {/* The old plan should have stopped renewing by now. If Stripe
              refused, saying nothing would leave the teacher paying twice
              without knowing it. */}
          {settlement === "failed" && (
            <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive text-pretty">
              Your school plan is active, but we could not stop your previous Teacher Pro
              subscription renewing. Please cancel it from your billing page so you are
              not charged for both.
            </p>
          )}

          {settlement === "stopped" && (
            <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-pretty">
              Your individual Teacher Pro subscription has been set to stop renewing, so
              you will not be charged for both. You keep it until the end of the period
              you have already paid for.
            </p>
          )}
        </>
      ) : (
        <>
          <AlertCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Not quite done</h1>
          <p className="mt-2 text-pretty text-muted-foreground">{message}</p>
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {ok && school ? (
          <>
            <Link href="/school" className={buttonVariants({ size: "lg" })}>
              Set up your school
            </Link>
            <Link
              href={home}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Back to your workspace
            </Link>
          </>
        ) : (
          <Link href={home} className={buttonVariants({ size: "lg" })}>
            Back to your workspace
          </Link>
        )}
      </div>
    </main>
  )
}
