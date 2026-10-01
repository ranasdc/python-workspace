"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ManageBillingButton } from "@/components/manage-billing-button"
import { SubscriptionModal } from "@/components/subscription-modal"
import type { AccountProfile } from "@/lib/account"

function formatDate(value: Date | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * The plan, and — just as importantly — who is paying for it.
 *
 * Someone covered by their school or teacher is shown that fact instead of
 * billing controls, because they have no subscription of their own to manage
 * and cancelling is not theirs to do.
 */
export function SubscriptionPanel({ profile }: { profile: AccountProfile }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { entitlement, plan } = profile

  const renewsOn = formatDate(entitlement.currentPeriodEnd)
  const coveredByOthers = plan.kind === "school" || plan.kind === "teacher"
  const isFree = plan.kind === "free"

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan.label}
            {coveredByOthers && <Badge variant="secondary">Provided for you</Badge>}
          </CardTitle>
          <CardDescription>
            {coveredByOthers
              ? `Your access is paid for by ${plan.providedBy}. There is nothing for you to pay or cancel.`
              : isFree
                ? "You are on the free tier."
                : renewsOn
                  ? `Your subscription renews on ${renewsOn}.`
                  : "Your subscription is active."}
          </CardDescription>
        </CardHeader>

        {entitlement.schoolUnpaid && (
          <CardContent>
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Your school&apos;s plan is not currently active, so Pro features are
              paused. Your school administrator can restore it from the school area.
            </p>
          </CardContent>
        )}

        <CardFooter className="flex-wrap gap-2">
          {isFree && (
            <Button onClick={() => setUpgradeOpen(true)}>Upgrade</Button>
          )}
          {plan.billable && !isFree && <ManageBillingButton variant="outline" />}
          <Link
            href="/billing"
            className={buttonVariants({ variant: isFree ? "outline" : "ghost" })}
          >
            Billing details
          </Link>
        </CardFooter>
      </Card>

      <SubscriptionModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        role={entitlement.isTeacher ? "teacher" : "student"}
      />
    </div>
  )
}
