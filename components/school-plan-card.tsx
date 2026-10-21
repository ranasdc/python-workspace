"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  annualSavingFor,
  costPerTeacher,
  formatPercent,
  formatPrice,
  formatPricePrecise,
  intervalsFor,
  priceFor,
  type BillingInterval,
  type Plan,
} from "@/lib/plans"
import { buttonVariants } from "@/components/ui/button"
import { CheckoutButton } from "@/components/checkout-button"

// A school tier, priced on whichever interval the reader picks.
//
// The interval lives in this component rather than on the page, so each card
// answers for itself: a visitor comparing a monthly Small School against a
// yearly MAT can see both at once, which a single page-level toggle makes
// impossible. The amounts, the saving and the percentage all come from
// lib/plans.ts, so nothing here can quote a discount the catalogue does not
// actually sell.

type Props = {
  plan: Plan
  /** Which interval starts selected. Defaults to the one the plan is sold on. */
  initialInterval?: BillingInterval
  /**
   * `setup` sends the reader into the school setup flow carrying their choice;
   * `checkout` is for an administrator who already has a school and can buy now.
   */
  action: "setup" | "checkout"
  signedIn?: boolean
  schoolId?: number
  variant?: "full" | "compact"
  className?: string
}

export function SchoolPlanCard({
  plan,
  initialInterval,
  action,
  signedIn = false,
  schoolId,
  variant = "full",
  className,
}: Props) {
  const options = intervalsFor(plan)
  const [interval, setInterval] = useState<BillingInterval>(
    initialInterval && options.includes(initialInterval) ? initialInterval : plan.interval,
  )

  const priceInPence = priceFor(plan, interval) ?? plan.priceInPence
  const saving = annualSavingFor(plan)
  const perTeacher = costPerTeacher(plan, interval)
  const compact = variant === "compact"

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card",
        compact ? "p-4" : "p-6",
        "transition-[border-color,box-shadow] duration-150 hover:border-primary hover:ring-1 hover:ring-primary",
        className,
      )}
    >
      <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>{plan.name}</h3>
      {/* Reserves two lines so a one-line blurb and MAT's two-line one occupy
          the same height, which keeps the three prices on a shared baseline. */}
      {!compact && (
        <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground text-pretty">
          {plan.blurb}
        </p>
      )}

      <IntervalChoice
        plan={plan}
        options={options}
        value={interval}
        onChange={setInterval}
        className={compact ? "mt-3" : "mt-4"}
      />

      <div className={cn("flex items-baseline gap-1", compact ? "mt-3" : "mt-4")}>
        <span className={cn("font-bold", compact ? "text-2xl" : "text-3xl")}>
          {formatPrice(priceInPence)}
        </span>
        <span className="text-sm text-muted-foreground">
          {interval === "year" ? "/year" : "/month"}
        </span>
      </div>

      {/* Announced politely so a screen-reader user who switches interval hears
          the new price and saving without being interrupted mid-sentence. */}
      <p
        aria-live="polite"
        className="mt-1 min-h-[2.5rem] text-xs text-muted-foreground text-pretty"
      >
        {saving ? (
          interval === "year" ? (
            <>
              Saves {formatPrice(saving.savingInPence)} a year against{" "}
              {formatPrice(saving.annualisedMonthlyInPence)} in monthly payments — that is{" "}
                  {formatPercent(saving.percent)} less.
            </>
          ) : (
            <>
              {formatPrice(saving.annualisedMonthlyInPence)} over 12 months. Paying yearly
              instead costs {formatPrice(saving.savingInPence)} less.
            </>
          )
        ) : null}
      </p>

      <p className={cn("text-sm", compact ? "mt-2 text-xs" : "mt-3")}>
        <span className="font-medium">{plan.teacherSeatLimit}</span>{" "}
        <span className="text-muted-foreground">teacher accounts</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium">
          {plan.studentSeatLimit?.toLocaleString("en-GB")}
        </span>{" "}
        <span className="text-muted-foreground">student seats</span>
      </p>

      {/* Shown on both intervals. Hiding it under a monthly price left one card
          a line shorter than its neighbours and staggered the buttons across a
          row meant for comparing them. */}
      {perTeacher !== null && !compact && (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPricePrecise(perTeacher)} per teacher{" "}
          {interval === "year" ? "for the year" : "a month"}
        </p>
      )}

      <div className={compact ? "mt-4" : "mt-6"}>
        {action === "checkout" ? (
          <CheckoutButton
            planId={plan.id}
            interval={interval}
            schoolId={schoolId}
            size={compact ? "default" : "lg"}
            className="w-full"
          >
            Choose {plan.name}
          </CheckoutButton>
        ) : (
          <Link
            // The choice travels with the link, so the setup flow opens on the
            // tier and interval that were actually on screen when it was clicked.
            href={
              signedIn
                ? `/school?plan=${plan.id}&interval=${interval}`
                : `/sign-up?next=${encodeURIComponent(
                    `/school?plan=${plan.id}&interval=${interval}`,
                  )}`
            }
            className={buttonVariants({
              size: compact ? "default" : "lg",
              variant: "outline",
              className: "w-full",
            })}
          >
            Choose {plan.name}
          </Link>
        )}
      </div>

      {!compact && (
        <ul className="mt-6 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The per-card Monthly / Yearly control.
 *
 * Built on real radio inputs rather than buttons with ARIA attributes: that
 * gives arrow-key movement, a single tab stop and correct "2 of 2" screen
 * reader announcements for free, which a hand-rolled version has to reimplement
 * and usually only half does. The inputs are visually hidden, and the labels
 * are styled from their checked and focused state.
 */
function IntervalChoice({
  plan,
  options,
  value,
  onChange,
  className,
}: {
  plan: Plan
  options: BillingInterval[]
  value: BillingInterval
  onChange: (interval: BillingInterval) => void
  className?: string
}) {
  // Unique per rendered card, so three cards on one page stay independent
  // groups rather than becoming one nine-way choice.
  const groupName = `${useId()}-interval`
  const saving = annualSavingFor(plan)

  if (options.length < 2) return null

  return (
    <fieldset className={className}>
      <legend className="sr-only">Billing interval for {plan.name}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => {
          const selected = option === value
          const label = option === "year" ? "Yearly" : "Monthly"

          return (
            <div key={option} className="relative">
              <input
                type="radio"
                id={`${groupName}-${option}`}
                name={groupName}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="peer sr-only"
              />
              <label
                htmlFor={`${groupName}-${option}`}
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-md px-2 py-1.5 text-center text-sm font-medium transition-colors",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {option === "year" && saving && (
                  <span
                    className={cn(
                      "text-[0.6875rem] font-normal leading-tight",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    Save {formatPercent(saving.percent)}
                  </span>
                )}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
