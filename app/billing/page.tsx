import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getBillingOverview } from "@/app/actions/billing"
import { FREE_ALLOWANCE, PLANS, formatPrice } from "@/lib/plans"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ManageBillingButton } from "@/components/manage-billing-button"

export const metadata = {
  title: "Billing",
  description: "Manage your mycodepad subscription.",
}

function formatDate(value: Date | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function BillingPage() {
  const me = await getSessionUser()
  if (!me) redirect("/sign-in")

  const { entitlement, hasBillingAccount } = await getBillingOverview()
  const home = me.role === "teacher" ? "/teacher" : "/student"
  const renewsOn = formatDate(entitlement.currentPeriodEnd)

  // Someone else's plan is not a plan of your own: a pupil covered by their
  // teacher resolves to the Student Pro tier, but has bought nothing, so no
  // price or renewal date here belongs to them.
  const coveredByOthers =
    entitlement.source === "school" || entitlement.source === "teacher"

  const paidPlan =
    !coveredByOthers && entitlement.plan !== "free" && entitlement.plan !== "school"
      ? PLANS[entitlement.plan]
      : null

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href={home}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to your workspace
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your current plan and payment details.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>
                {entitlement.source === "school"
                  ? "Covered by your school"
                  : entitlement.source === "teacher"
                    ? "Covered by your teacher"
                    : (paidPlan?.name ?? "Free")}
              </CardTitle>
              <CardDescription className="mt-1">
                {entitlement.source === "school"
                  ? "Your school pays for this. You will never be charged."
                  : entitlement.source === "teacher"
                    ? `${entitlement.coveredByTeacherName ?? "Your teacher"} pays for Teacher Pro, which covers everyone they teach. You will never be charged.`
                    : (paidPlan?.blurb ??
                      `${FREE_ALLOWANCE.student}, free forever.`)}
              </CardDescription>
            </div>
            <Badge variant={entitlement.isPro ? "default" : "secondary"}>
              {entitlement.isPro ? "Pro" : "Free"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          {paidPlan ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">
                {formatPrice(paidPlan.priceInPence)} per {paidPlan.interval}
              </span>
            </div>
          ) : null}

          {/* A teacher's renewal date and cancellation state are that teacher's
              business, so neither is presented here as if it were the pupil's. */}
          {renewsOn && entitlement.source !== "teacher" ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {entitlement.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
              </span>
              <span className="font-medium">{renewsOn}</span>
            </div>
          ) : null}

          {entitlement.cancelAtPeriodEnd && entitlement.source !== "teacher" ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              This subscription is set to cancel. You keep full access until the date
              above.
            </p>
          ) : null}

          {entitlement.source === "teacher" ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Pro lasts as long as you are in their class and their plan stays active.
              If either changes you drop back to the free tier —{" "}
              {FREE_ALLOWANCE.student} — and can subscribe yourself at any time.
            </p>
          ) : null}

          {entitlement.source === "individual" && entitlement.coveredByTeacherName ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              {entitlement.coveredByTeacherName}&apos;s Teacher Pro plan already covers
              you while you are in their class, so this subscription is paying for
              access you currently get free. Cancel it and you keep every Pro feature.
            </p>
          ) : null}

          {entitlement.schoolUnpaid ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Your school&apos;s plan is not currently active, so you are on the free
              tier. You can subscribe independently below.
            </p>
          ) : null}
        </CardContent>

        {/* A pupil covered by their teacher has nothing of their own to
            manage, and no school page to look at, so the footer goes away. */}
        {entitlement.source === "teacher" ? null : (
          <CardFooter className="flex flex-wrap gap-3">
            {/* A school-covered member has nothing of their own to manage. */}
            {entitlement.source === "school" ? (
              <Link href="/school" className={buttonVariants({ variant: "outline" })}>
                View your school
              </Link>
            ) : (
              <>
                {hasBillingAccount ? (
                  <ManageBillingButton
                    variant={entitlement.isPro ? "default" : "outline"}
                  >
                    {entitlement.isPro ? "Manage or cancel" : "Manage billing"}
                  </ManageBillingButton>
                ) : null}
                {!entitlement.isPro ? (
                  <Link href="/pricing" className={buttonVariants()}>
                    See plans
                  </Link>
                ) : null}
              </>
            )}
          </CardFooter>
        )}
      </Card>
    </main>
  )
}
