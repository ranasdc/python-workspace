import Link from "next/link"
import { Check } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { getEntitlement } from "@/lib/entitlements"
import { PLANS, SCHOOL_PLAN_IDS, formatPrice, type Plan } from "@/lib/plans"
import { Button, buttonVariants } from "@/components/ui/button"
import { CheckoutButton } from "@/components/checkout-button"
import { LogoIcon, LogoWordmark } from "@/components/logo"

export const metadata = {
  title: "Pricing",
  description:
    "Student Pro, Teacher Pro and school plans for MyCodePad. School plans give every student and teacher Pro at no personal cost.",
}

export default async function PricingPage() {
  const sessionUser = await getSessionUser()
  const entitlement = sessionUser ? await getEntitlement(sessionUser.id) : null

  const coveredBySchool = entitlement?.source === "school"

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <header className="flex flex-col items-center text-center">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <LogoIcon className="h-10 w-10" />
          <LogoWordmark className="text-xl" />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Simple pricing for learners, teachers and schools
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
          Start free with 2 files and 1 folder. Upgrade when you outgrow it — or get
          everything through your school.
        </p>
      </header>

      {coveredBySchool && (
        <div
          className="mx-auto mt-10 max-w-2xl rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-center text-sm"
          role="status"
        >
          Your school already covers you. You have full Pro access at no personal cost —
          there is nothing to buy here.
        </div>
      )}

      <section className="mt-12 grid gap-6 md:grid-cols-2" aria-label="Individual plans">
        <PlanCard
          plan={PLANS.student_pro}
          signedIn={Boolean(sessionUser)}
          hideCheckout={coveredBySchool}
          highlighted
        />
        <PlanCard
          plan={PLANS.teacher_pro}
          signedIn={Boolean(sessionUser)}
          hideCheckout={coveredBySchool}
        />
      </section>

      <section className="mt-16" aria-labelledby="school-plans">
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
}: {
  plan: Plan
  signedIn: boolean
  highlighted?: boolean
  hideCheckout?: boolean
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
            Covered by your school
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
        href={signedIn ? "/school" : "/sign-up"}
        className={buttonVariants({
          size: "lg",
          variant: "outline",
          className: "mt-6 w-full",
        })}
      >
        {signedIn ? "Set up your school" : "Create an account"}
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
