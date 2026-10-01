import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Building2, Check, GraduationCap, School } from "lucide-react"

import { JoinSchoolDialog } from "@/components/join-school-dialog"
import { JoinClassDialog } from "@/components/join-class-dialog"

import { getSessionUser } from "@/lib/session"
import { getEntitlement } from "@/lib/entitlements"
import { PLANS, SCHOOL_PLAN_IDS, formatPrice, type Plan } from "@/lib/plans"
import { Button, buttonVariants } from "@/components/ui/button"
import { CheckoutButton } from "@/components/checkout-button"
import { LogoIcon, LogoWordmark } from "@/components/logo"

export const metadata = {
  title: "Pricing",
  description:
    "Student Pro, Teacher Pro and school plans for MyCodePad, the classroom workspace for Python and HTML. School plans give every student and teacher Pro at no personal cost.",
}

export default async function PricingPage() {
  const sessionUser = await getSessionUser()
  const entitlement = sessionUser ? await getEntitlement(sessionUser.id) : null

  const coveredBySchool = entitlement?.source === "school"
  // A teacher on Teacher Pro covers every pupil they teach, so a student in
  // one of their classes has nothing to buy here either.
  const coveredByTeacher = entitlement?.source === "teacher"
  const covered = coveredBySchool || coveredByTeacher
  const coveredLabel = coveredBySchool ? "Covered by your school" : "Covered by your teacher"
  // A teaching account cannot enrol in a class, and a pupil cannot redeem a
  // teacher code, so each card only offers the route its viewer can take.
  const isTeacher = entitlement?.isTeacher ?? false
  const isKnownStudent = Boolean(sessionUser) && !isTeacher

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon className="h-9 w-9" />
          <LogoWordmark className="text-lg" />
        </Link>
        {sessionUser ? (
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Go to dashboard
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants({})}>
              Get started
            </Link>
          </div>
        )}
      </nav>

      <header className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Simple pricing for learners, teachers and schools
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
          {/* Deliberately not a single number: the free allowance is metered per
              IDE, so quoting "2 files" would be wrong the moment you open the
              HTML IDE, which allows 3. */}
          Start free with a small file allowance in each IDE. Upgrade when you outgrow it
          — or get everything through a teacher on Teacher Pro, or your school.
        </p>
      </header>

      {covered && (
        <div
          className="mx-auto mt-10 max-w-2xl rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-center text-sm"
          role="status"
        >
          {coveredBySchool
            ? "Your school already covers you. You have full Pro access at no personal cost — there is nothing to buy here."
            : "Your teacher's Teacher Pro plan already covers you. You have full Pro access at no personal cost — there is nothing to buy here."}
        </div>
      )}

      <section className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Plans">
        <PlanCard
          plan={PLANS.student_pro}
          signedIn={Boolean(sessionUser)}
          hideCheckout={covered}
          coveredLabel={coveredLabel}
          highlighted
          footer={
            covered || isTeacher ? null : (
              <div className="mt-3 rounded-md border border-dashed border-border px-3 py-3 text-center">
                <p className="text-sm text-muted-foreground text-pretty">
                  Learning with a teacher? Ask them for your class code — they may
                  already have one for you. If they are on Teacher Pro, or your school
                  subscribes, every Pro feature is yours at no cost.
                </p>
                {sessionUser ? (
                  <JoinClassDialog
                    trigger={
                      <Button variant="outline" size="sm" className="mt-3">
                        <GraduationCap className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Join a class with a code
                      </Button>
                    }
                  />
                ) : (
                  <Link
                    href="/sign-up"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-3",
                    })}
                  >
                    <GraduationCap className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Sign up, then join your class
                  </Link>
                )}
              </div>
            )
          }
        />
        <PlanCard
          plan={PLANS.teacher_pro}
          signedIn={Boolean(sessionUser)}
          hideCheckout={coveredBySchool}
          footer={
            coveredBySchool || isKnownStudent ? null : (
              <div className="mt-3 rounded-md border border-dashed border-border px-3 py-3 text-center">
                <p className="text-sm text-muted-foreground text-pretty">
                  Does your school already subscribe? Join with the teacher code from your
                  school administrator to get every Pro feature at no personal cost.
                </p>
                {sessionUser ? (
                  <JoinSchoolDialog
                    trigger={
                      <Button variant="outline" size="sm" className="mt-3">
                        <School className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Join a school with a code
                      </Button>
                    }
                  />
                ) : (
                  <Link
                    href="/sign-up"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-3",
                    })}
                  >
                    <School className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Sign up, then join your school
                  </Link>
                )}
              </div>
            )
          }
        />
        <SchoolsTeaserCard />
      </section>

      <section className="mt-16 scroll-mt-8" id="school-plans-section" aria-labelledby="school-plans">
        <div className="flex flex-col items-center text-center">
          <h2 id="school-plans" className="text-2xl font-semibold tracking-tight">
            School plans
          </h2>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            One subscription covers everyone. Every student and teacher in the school gets
            full Pro access — they are never asked to pay or upgrade individually.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SCHOOL_PLAN_IDS.map((id) => (
            <SchoolPlanCard key={id} plan={PLANS[id]} signedIn={Boolean(sessionUser)} />
          ))}
        </div>
      </section>
    </main>
  )
}

function PlanCard({
  plan,
  signedIn,
  highlighted,
  hideCheckout,
  coveredLabel = "Covered by your school",
  footer,
}: {
  plan: Plan
  signedIn: boolean
  highlighted?: boolean
  hideCheckout?: boolean
  /** Who is paying instead, shown on the disabled button. */
  coveredLabel?: string
  footer?: ReactNode
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-card p-6 ${
        highlighted ? "border-2 border-primary" : "border-border"
      }`}
    >
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{plan.blurb}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{formatPrice(plan.priceInPence)}</span>
        <span className="text-sm text-muted-foreground">/{plan.interval}</span>
      </div>

      <div className="mt-6">
        {hideCheckout ? (
          <Button className="w-full" size="lg" disabled>
            {coveredLabel}
          </Button>
        ) : signedIn ? (
          <CheckoutButton planId={plan.id} className="w-full">
            Get {plan.name}
          </CheckoutButton>
        ) : (
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Create an account
          </Link>
        )}
        {footer}
      </div>

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SchoolsTeaserCard() {
  const schoolPlans = SCHOOL_PLAN_IDS.map((id) => PLANS[id])
  const cheapest = schoolPlans.reduce((a, b) => (a.priceInPence <= b.priceInPence ? a : b))
  const teacherSeats = schoolPlans.map((p) => p.teacherSeatLimit ?? 0)
  const studentSeats = schoolPlans.map((p) => p.studentSeatLimit ?? 0)
  const teacherProYearly = PLANS.teacher_pro.priceInPence * 12
  const breakEvenTeachers = Math.ceil(cheapest.priceInPence / teacherProYearly)

  return (
    <div className="flex flex-col rounded-lg bg-foreground p-6 text-background md:col-span-2 lg:col-span-1">
      <span className="mb-2 self-start rounded-full bg-background/15 px-2 py-0.5 text-xs font-medium">
        Best value for teams
      </span>
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <h3 className="text-lg font-semibold">Schools & departments</h3>
      </div>
      <p className="mt-1 text-sm opacity-75 text-pretty">
        One subscription. Every teacher and student gets Pro.
      </p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-sm opacity-75">from</span>
        <span className="text-4xl font-bold">{formatPrice(cheapest.priceInPence)}</span>
        <span className="text-sm opacity-75">/{cheapest.interval}</span>
      </div>

      <div className="mt-6">
        <a
          href="#school-plans-section"
          className={buttonVariants({ size: "lg", variant: "secondary", className: "w-full" })}
        >
          Compare school plans
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </a>
        <p className="mt-3 rounded-md bg-background/10 px-3 py-3 text-center text-sm text-pretty">
          Buying for {breakEvenTeachers} or more teachers? {cheapest.name} covers{" "}
          {cheapest.teacherSeatLimit} teachers for less than {breakEvenTeachers} Teacher Pro
          subscriptions.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {[
          `${Math.min(...teacherSeats)} to ${Math.max(...teacherSeats)} teacher seats`,
          `Up to ${Math.max(...studentSeats).toLocaleString("en-GB")} student seats`,
          "Nobody is ever asked to pay individually",
          "Central admin and teacher invite codes",
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SchoolPlanCard({ plan, signedIn }: { plan: Plan; signedIn: boolean }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{plan.blurb}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{formatPrice(plan.priceInPence)}</span>
        <span className="text-sm text-muted-foreground">/{plan.interval}</span>
      </div>

      <Link
        href={signedIn ? "/school" : "/sign-up?next=/school"}
        className={buttonVariants({
          size: "lg",
          variant: "outline",
          className: "mt-6 w-full",
        })}
      >
        Set up your school
      </Link>

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
