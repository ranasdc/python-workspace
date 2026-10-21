"use client"

import Link from "next/link"
import { useState } from "react"
import { Building2 } from "lucide-react"

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
 * and cancelling is not theirs to do. A school administrator is the one
 * exception: the school plan is the plan they are responsible for, so they get
 * a route to it rather than being told there is nothing to manage.
 */
export function SubscriptionPanel({ profile }: { profile: AccountProfile }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { entitlement, plan, canManageSchool } = profile

  const renewsOn = formatDate(entitlement.currentPeriodEnd)
  const endsSoon = entitlement.cancelAtPeriodEnd

  // The school plan belongs to its administrator in every sense that matters
  // here: they bought it, they can cancel it, and they are the only one who
  // can put it right. Lumping them in with ordinary members told them "there is
  // nothing for you to pay or cancel" and left them with no controls at all.
  const administersSchoolPlan = canManageSchool && plan.kind === "school"
  const coveredByOthers =
    !administersSchoolPlan && (plan.kind === "school" || plan.kind === "teacher")
  const isFree = plan.kind === "free"
  // An administrator whose school plan has lapsed needs a school plan, not a
  // personal subscription, so they are pointed at the school area instead of
  // the individual upgrade modal.
  const needsSchoolPlan = canManageSchool && isFree
  // A teacher paying for their own Teacher Pro is the one account that can move
  // up to a school plan. The upgrade screen re-resolves this server-side, so
  // this only decides whether to offer the route.
  const canUpgradeToSchool =
    plan.kind === "personal" && entitlement.plan === "teacher_pro"

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {plan.label}
            {coveredByOthers && <Badge variant="secondary">Provided for you</Badge>}
            {administersSchoolPlan && <Badge variant="secondary">You manage this</Badge>}
          </CardTitle>
          <CardDescription className="text-pretty">
            {administersSchoolPlan
              ? `${plan.providedBy}'s plan covers you and everyone else at the school.${
                  endsSoon && renewsOn
                    ? ` It is set to end on ${renewsOn}.`
                    : renewsOn
                      ? ` It renews on ${renewsOn}.`
                      : ""
                } You manage it from the school area.`
              : coveredByOthers
                ? `Your access is paid for by ${plan.providedBy}. There is nothing for you to pay or cancel.`
                : isFree
                  ? "You are on the free tier."
                  : renewsOn
                    ? endsSoon
                      ? `Your subscription ends on ${renewsOn}.`
                      : `Your subscription renews on ${renewsOn}.`
                    : "Your subscription is active."}
          </CardDescription>
        </CardHeader>

        {entitlement.schoolUnpaid && (
          <CardContent>
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive text-pretty">
              Your school&apos;s plan is not currently active, so Pro features are
              paused.{" "}
              {canManageSchool
                ? "You can choose a plan for your school from the school area."
                : "Your school administrator can restore it from the school area."}
            </p>
          </CardContent>
        )}

        <CardFooter className="flex-wrap gap-2">
          {needsSchoolPlan ? (
            <Link href="/school" className={buttonVariants()}>
              <Building2 data-icon="inline-start" />
              Choose a school plan
            </Link>
          ) : isFree ? (
            <Button onClick={() => setUpgradeOpen(true)}>Upgrade</Button>
          ) : null}

          {canUpgradeToSchool && (
            <Link href="/billing/upgrade" className={buttonVariants()}>
              <Building2 data-icon="inline-start" />
              Upgrade to a School Plan
            </Link>
          )}

          {administersSchoolPlan && (
            <Link href="/school" className={buttonVariants({ variant: "outline" })}>
              <Building2 data-icon="inline-start" />
              Manage school plan
            </Link>
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
