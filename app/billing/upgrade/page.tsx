import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, Building2, Check, Users } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getUpgradeContext } from "@/app/actions/upgrades"
import { PLANS, SCHOOL_PLAN_IDS, formatPrice } from "@/lib/plans"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PriceTag } from "@/components/price-tag"
import { SaleBanner } from "@/components/sale-banner"
import { ConfirmUpgrade } from "@/components/billing/confirm-upgrade"
import type { UpgradeOffer } from "@/lib/plan-upgrades"

export const metadata = {
  title: "Upgrade to a school plan",
  description: "Move your mycodepad subscription up to a school-wide plan.",
}

function formatDate(value: Date | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function seatLine(offer: UpgradeOffer) {
  const teachers =
    offer.teacherSeatLimit === null ? null : `${offer.teacherSeatLimit} teacher seats`
  const students =
    offer.studentSeatLimit === null
      ? null
      : `${offer.studentSeatLimit.toLocaleString("en-GB")} student seats`
  return [teachers, students].filter(Boolean).join(" · ")
}

/**
 * What every school tier has in common, which is what "a school plan" means
 * here. Derived by intersecting the configured feature lists rather than
 * written out again, so a tier-specific line — each plan's own seat counts,
 * which the cards above already state — can never leak into a claim made about
 * all of them.
 */
function sharedSchoolFeatures() {
  const [first, ...rest] = SCHOOL_PLAN_IDS.map((id) => PLANS[id].features)
  return first.filter((feature) => rest.every((features) => features.includes(feature)))
}

function extraSeatLine(offer: UpgradeOffer) {
  const parts: string[] = []
  if (offer.extraTeacherSeats !== null) {
    parts.push(`+${offer.extraTeacherSeats} teacher seats`)
  }
  if (offer.extraStudentSeats !== null) {
    parts.push(`+${offer.extraStudentSeats.toLocaleString("en-GB")} student seats`)
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cancelled?: string }>
}) {
  const me = await getSessionUser()
  if (!me) redirect("/sign-in?next=/billing/upgrade")

  const [context, { plan: planParam, cancelled }] = await Promise.all([
    getUpgradeContext(),
    searchParams,
  ])

  // The selected plan is only honoured if the server independently offered it,
  // so a hand-typed query string cannot reach a confirmation screen for a tier
  // this account was never eligible for.
  const selected = context.offers.find((offer) => offer.planId === planParam) ?? null
  const backHref = context.scope === "school" ? "/school" : "/billing"

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {context.scope === "school" ? "Back to your school" : "Back to billing"}
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
        {context.scope === "school"
          ? "Upgrade your school plan"
          : "Upgrade to a School Plan"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        You are currently on {context.currentPlanName}
        {context.currentPriceInPence !== null && context.currentInterval
          ? ` at ${formatPrice(context.currentPriceInPence)} per ${context.currentInterval}`
          : ""}
        {formatDate(context.currentPeriodEnd)
          ? `, renewing on ${formatDate(context.currentPeriodEnd)}`
          : ""}
        .
      </p>

      {cancelled && (
        <p className="mt-6 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground text-pretty">
          Checkout was cancelled, so nothing has changed and you have not been charged.
          Your current plan is still running.
        </p>
      )}

      {context.decision.reason === "available" && !selected && (
        <>
          <SaleBanner className="mt-8" />

          <section className="mt-6" aria-label="Available school plans">
            <div className="grid gap-4 md:grid-cols-3">
              {context.offers.map((offer) => (
                <article
                  key={offer.planId}
                  className="flex flex-col rounded-lg border border-border bg-card p-6"
                >
                  <h2 className="font-medium">{offer.name}</h2>
                  <PriceTag plan={PLANS[offer.planId]} size="md" className="mt-2" />
                  <p className="mt-3 text-sm text-muted-foreground text-pretty">
                    {offer.blurb}
                  </p>

                  <dl className="mt-4 flex flex-col gap-1 text-sm">
                    <div className="flex items-start gap-2">
                      <Users
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="sr-only">Seat allowance</dt>
                        <dd>{seatLine(offer)}</dd>
                      </div>
                    </div>
                    {extraSeatLine(offer) && (
                      <div className="flex items-start gap-2">
                        <ArrowRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div>
                          <dt className="sr-only">Added by this upgrade</dt>
                          <dd className="text-muted-foreground">{extraSeatLine(offer)}</dd>
                        </div>
                      </div>
                    )}
                  </dl>

                  <Link
                    href={`/billing/upgrade?plan=${offer.planId}`}
                    className={buttonVariants({ className: "mt-6 w-full" })}
                  >
                    Choose {offer.name}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              What a school plan adds
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {context.scope === "school"
                ? "Everything your school has today, with more room in it."
                : "Everything in Teacher Pro, plus the school-level administration an individual plan has no place for."}
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {sharedSchoolFeatures().map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {context.decision.reason === "available" && selected && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Confirm your upgrade</h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Check the plan below before anything is charged.
              </p>
            </div>
            <Badge variant="secondary">
              {context.currentPlanName} → {selected.name}
            </Badge>
          </div>

          <dl className="mt-6 flex flex-col gap-3 border-t border-border pt-6 text-sm">
            <div className="flex flex-wrap justify-between gap-4">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{selected.name}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-4">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="font-medium">
                {formatPrice(selected.priceInPence)} per {selected.interval}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-4">
              <dt className="text-muted-foreground">Billing interval</dt>
              <dd className="font-medium">
                {selected.interval === "year" ? "Yearly" : "Monthly"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-4">
              <dt className="text-muted-foreground">Teacher seats</dt>
              <dd className="font-medium">
                {selected.teacherSeatLimit ?? "—"}
                {selected.extraTeacherSeats !== null && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    (+{selected.extraTeacherSeats})
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-4">
              <dt className="text-muted-foreground">Student seats</dt>
              <dd className="font-medium">
                {selected.studentSeatLimit?.toLocaleString("en-GB") ?? "—"}
                {selected.extraStudentSeats !== null && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    (+{selected.extraStudentSeats.toLocaleString("en-GB")})
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {/* The billing consequences, stated before the button rather than
              discovered on a statement afterwards. */}
          <div className="mt-6 flex flex-col gap-3">
            {context.decision.individualPlanAction === "stop_renewal" && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-pretty">
                Your {context.currentPlanName} subscription will stop renewing once this
                school plan is active, so you are never charged for both. You keep the
                month you have already paid for
                {formatDate(context.currentPeriodEnd)
                  ? `, up to ${formatDate(context.currentPeriodEnd)}`
                  : ""}
                , and it is not cancelled unless the payment succeeds.
              </p>
            )}

            {context.scope === "school" && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-pretty">
                Your school keeps its current subscription and moves up a tier on it, so
                there is no second plan and no second renewal date. Stripe charges the
                difference for the rest of this billing period straight away, and the
                full {formatPrice(selected.priceInPence)} from{" "}
                {formatDate(context.currentPeriodEnd) ?? "the next renewal"}.
              </p>
            )}

            {context.scope === "school" && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-pretty">
                Every teacher, student, class, file and piece of student work stays
                exactly where it is. Only the seat allowance changes.
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <ConfirmUpgrade
              planId={selected.planId}
              planName={selected.name}
              scope={context.scope === "school" ? "school" : "individual"}
              schoolId={context.schoolId}
              needsSchool={context.needsSchool}
            />
            <Link
              href="/billing/upgrade"
              className={buttonVariants({
                variant: "ghost",
                className: "mt-3 w-full sm:w-auto",
              })}
            >
              Compare the other plans
            </Link>
          </div>
        </section>
      )}

      {context.decision.reason !== "available" && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          {context.decision.reason === "top_tier" && (
            <>
              <h2 className="text-lg font-semibold">
                You are on the highest plan we offer
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {context.currentPlanName} is the top of the range, so there is nothing
                above it to upgrade to. If you need more seats than it allows, get in
                touch and we will work something out.
              </p>
            </>
          )}

          {context.decision.reason === "not_manageable" && (
            <>
              <h2 className="text-lg font-semibold">
                {context.isSchoolAdmin
                  ? "Your school does not have a plan yet"
                  : "Your school administrator manages this plan"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {context.isSchoolAdmin
                  ? "There is nothing to upgrade from yet. Choose your school's first plan from the school area."
                  : `Your access is provided by ${context.schoolName ?? "your school"}, so changing the plan is your administrator's to do. Ask them if your school needs more seats.`}
              </p>
              {context.isSchoolAdmin && (
                <Link href="/school" className={buttonVariants({ className: "mt-5" })}>
                  <Building2 data-icon="inline-start" />
                  Choose a school plan
                </Link>
              )}
            </>
          )}

          {context.decision.reason === "not_stripe_managed" && (
            <>
              <h2 className="text-lg font-semibold">
                This plan was arranged directly
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {context.currentPlanName} was set up for your school outside Stripe, so
                there is no card subscription here to move to a new tier. Whoever
                arranged it can upgrade it for you.
              </p>
            </>
          )}

          {context.decision.reason === "not_upgradeable" && (
            <>
              <h2 className="text-lg font-semibold">
                There is no school upgrade for this account
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                School plans are bought by the teacher who will administer them.
                {context.currentPlanName === "Student Pro"
                  ? " Your Student Pro plan covers your own workspace; if your school wants a plan, a teacher there can set one up."
                  : " Have a look at the plans to find the one that fits."}
              </p>
              <Link
                href="/pricing"
                className={buttonVariants({ variant: "outline", className: "mt-5" })}
              >
                See all plans
              </Link>
            </>
          )}
        </section>
      )}
    </main>
  )
}
