import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getBillingOverview } from "@/app/actions/billing"
import { PLANS, formatPrice } from "@/lib/plans"
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

  const paidPlan =
    entitlement.plan !== "free" && entitlement.plan !== "school"
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
                {entitlement.plan === "school"
                  ? "Covered by your school"
                  : (paidPlan?.name ?? "Free")}
              </CardTitle>
              <CardDescription className="mt-1">
                {entitlement.plan === "school"
                  ? "Your school pays for this. You will never be charged."
                  : (paidPlan?.blurb ?? "Two files and one folder, free forever.")}
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

          {renewsOn ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {entitlement.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
              </span>
              <span className="font-medium">{renewsOn}</span>
            </div>
          ) : null}

          {entitlement.cancelAtPeriodEnd ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              This subscription is set to cancel. You keep full access until the date
              above.
            </p>
          ) : null}

          {entitlement.schoolUnpaid ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Your school&apos;s plan is not currently active, so you are on the free
              tier. You can subscribe independently below.
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-3">
          {/* A school-covered member has nothing of their own to manage. */}
          {entitlement.source === "school" ? (
            <Link href="/school" className={buttonVariants({ variant: "outline" })}>
              View your school
            </Link>
          ) : (
            <>
              {hasBillingAccount ? (
                <ManageBillingButton variant={entitlement.isPro ? "default" : "outline"}>
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
      </Card>
    </main>
  )
}
