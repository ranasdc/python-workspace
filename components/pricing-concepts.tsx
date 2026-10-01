"use client"

import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowRight, Building2, Check, School, Sparkles, User, Users } from "lucide-react"

import { PLANS, SCHOOL_PLAN_IDS, formatPrice, type Plan, type PlanId } from "@/lib/plans"
import { Button } from "@/components/ui/button"

const TEACHER_PRO_YEARLY_PENCE = PLANS.teacher_pro.priceInPence * 12

function ConceptFrame({
  number,
  title,
  summary,
  children,
}: {
  number: number
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`concept-${number}`} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {number}
        </span>
        <div>
          <h2 id={`concept-${number}`} className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">{summary}</p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6">{children}</div>
    </section>
  )
}

function MiniPlanCard({
  plan,
  highlighted,
  extra,
}: {
  plan: Plan
  highlighted?: boolean
  extra?: ReactNode
}) {
  return (
    <div
      className={`flex flex-col rounded-lg bg-card p-5 ${
        highlighted ? "border-2 border-primary" : "border border-border"
      }`}
    >
      <h3 className="font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{plan.blurb}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{formatPrice(plan.priceInPence)}</span>
        <span className="text-sm text-muted-foreground">/{plan.interval}</span>
      </div>
      {extra}
      <Button className="mt-4 w-full" variant={plan.audience === "school" ? "outline" : "default"}>
        {plan.audience === "school" ? "Set up your school" : "Create an account"}
      </Button>
      <ul className="mt-4 space-y-2">
        {plan.features.slice(0, 3).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

const AUDIENCES = [
  { id: "me", label: "Just me", icon: User, plans: ["student_pro"] as PlanId[] },
  { id: "classes", label: "My classes", icon: Users, plans: ["teacher_pro"] as PlanId[] },
  { id: "school", label: "My school or department", icon: Building2, plans: SCHOOL_PLAN_IDS },
] as const

function AudienceSwitchConcept() {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["id"]>("me")
  const current = AUDIENCES.find((a) => a.id === audience)!

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-medium">Who are you buying for?</p>
      <div role="group" aria-label="Who are you buying for" className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-border bg-card p-1">
        {AUDIENCES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={audience === id}
            onClick={() => setAudience(id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              audience === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div
        className={`grid w-full gap-4 ${current.plans.length === 3 ? "md:grid-cols-3" : "max-w-sm"}`}
      >
        {current.plans.map((id, i) => (
          <MiniPlanCard key={id} plan={PLANS[id]} highlighted={current.plans.length === 3 && i === 1} />
        ))}
      </div>
    </div>
  )
}

function SavingsBannerConcept() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-5 py-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <School className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-pretty">
            <span className="font-semibold">Buying for 3 or more teachers?</span> A school plan
            costs less: 10 teachers and 150 students from {formatPrice(PLANS.school_small.priceInPence)}/yr.
          </p>
        </div>
        <Button size="sm" className="flex-shrink-0">
          See school plans
          <ArrowDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid gap-4 opacity-60 md:grid-cols-2" aria-hidden="true">
        <MiniPlanCard plan={PLANS.student_pro} highlighted />
        <MiniPlanCard plan={PLANS.teacher_pro} />
      </div>
    </div>
  )
}

function cheapestSchoolPlanFor(teachers: number) {
  return SCHOOL_PLAN_IDS.map((id) => PLANS[id]).find(
    (plan) => (plan.teacherSeatLimit ?? 0) >= teachers,
  )
}

function SeatCalculatorConcept() {
  const [teachers, setTeachers] = useState(4)
  const individualPence = teachers * TEACHER_PRO_YEARLY_PENCE
  const schoolPlan = cheapestSchoolPlanFor(teachers)
  const savingPence = schoolPlan ? individualPence - schoolPlan.priceInPence : 0
  const schoolWins = savingPence > 0

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="teacher-count" className="font-medium">
          How many teachers?
        </label>
        <span className="text-2xl font-bold tabular-nums">{teachers}</span>
      </div>
      <input
        id="teacher-count"
        type="range"
        min={1}
        max={30}
        value={teachers}
        onChange={(e) => setTeachers(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {teachers} × Teacher Pro
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${schoolWins ? "text-muted-foreground line-through" : ""}`}>
            {formatPrice(individualPence)}
            <span className="text-sm font-normal">/yr</span>
          </p>
        </div>
        <div
          className={`rounded-md p-4 ${
            schoolWins ? "border-2 border-emerald-500 bg-emerald-500/10" : "border border-border"
          }`}
        >
          <p className="text-sm text-muted-foreground">{schoolPlan?.name ?? "Talk to us"} plan</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {schoolPlan ? formatPrice(schoolPlan.priceInPence) : "Custom"}
            <span className="text-sm font-normal">/yr</span>
          </p>
          {schoolPlan && (
            <p className="mt-1 text-xs text-muted-foreground">
              Includes up to {schoolPlan.studentSeatLimit?.toLocaleString("en-GB")} students
            </p>
          )}
        </div>
      </div>
      <p
        className={`text-center text-sm font-medium ${schoolWins ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {schoolWins
          ? `Save ${formatPrice(savingPence)} a year, and every student gets Pro too.`
          : "For 1 or 2 teachers, Teacher Pro is the better deal."}
      </p>
    </div>
  )
}

function ThirdCardConcept() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MiniPlanCard plan={PLANS.student_pro} highlighted />
      <MiniPlanCard plan={PLANS.teacher_pro} />
      <div className="flex flex-col rounded-lg bg-foreground p-5 text-background">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden="true" />
          <h3 className="font-semibold">Schools & departments</h3>
        </div>
        <p className="mt-1 text-sm opacity-75 text-pretty">
          One subscription. Every teacher and student gets Pro.
        </p>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-sm opacity-75">from</span>
          <span className="text-3xl font-bold">{formatPrice(PLANS.school_small.priceInPence)}</span>
          <span className="text-sm opacity-75">/year</span>
        </div>
        <Button variant="secondary" className="mt-4 w-full">
          Compare school plans
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
        <ul className="mt-4 space-y-2">
          {["10 to 100 teacher seats", "Up to 2,500 student seats", "Central admin dashboard"].map(
            (feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {feature}
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  )
}

function InlineNudgeConcept() {
  return (
    <div className="mx-auto max-w-sm">
      <MiniPlanCard
        plan={PLANS.teacher_pro}
        extra={
          <a
            href="#concept-4"
            className="mt-3 flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-pretty hover:bg-primary/15"
          >
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="font-semibold">Buying for your team?</span> Small School covers 10
              teachers for less than 3 of these.
            </span>
          </a>
        }
      />
    </div>
  )
}

function FloatingPillConcept() {
  return (
    <div className="relative h-64 overflow-hidden rounded-lg border border-border bg-card">
      <div className="space-y-3 p-5 opacity-50" aria-hidden="true">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
      </div>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <Button className="rounded-full shadow-lg">
          <School className="mr-1.5 h-4 w-4" aria-hidden="true" />
          School plans
          <ArrowDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function PricingConcepts() {
  return (
    <div className="flex flex-col gap-14">
      <ConceptFrame
        number={1}
        title={`"Who's it for?" switch`}
        summary="Visitors pick who they're buying for before they see prices. Click the options to see the cards change."
      >
        <AudienceSwitchConcept />
      </ConceptFrame>
      <ConceptFrame
        number={2}
        title="Cost comparison banner"
        summary="A slim strip above the cards that leads with the saving and jumps to school plans."
      >
        <SavingsBannerConcept />
      </ConceptFrame>
      <ConceptFrame
        number={3}
        title="Seat calculator"
        summary="Drag the slider. Once there are 3 or more teachers, the school plan turns green and shows the saving."
      >
        <SeatCalculatorConcept />
      </ConceptFrame>
      <ConceptFrame
        number={4}
        title={`A third "Schools" card`}
        summary="A dark third card in the main row, so school plans show up without scrolling."
      >
        <ThirdCardConcept />
      </ConceptFrame>
      <ConceptFrame
        number={5}
        title="Line inside the Teacher Pro card"
        summary="Catches teachers just as they look at the per-teacher price."
      >
        <InlineNudgeConcept />
      </ConceptFrame>
      <ConceptFrame
        number={6}
        title="Floating pill while scrolling"
        summary="Stays at the bottom of the screen until the school plans section scrolls into view."
      >
        <FloatingPillConcept />
      </ConceptFrame>
    </div>
  )
}
