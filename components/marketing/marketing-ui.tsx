import type { ComponentType, CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { marketingRoute } from "@/lib/seo/marketing"

/**
 * Layout pieces shared by the marketing pages.
 *
 * All static markup. Nothing here fades in on scroll, so the copy a crawler
 * reads is the copy a visitor sees, with no opacity animation in between.
 */

export function PageHero({
  eyebrow,
  title,
  lede,
  bullets,
  primary = { href: "/sign-up", label: "Start coding free" },
  secondary,
}: {
  eyebrow: string
  title: ReactNode
  lede: ReactNode
  bullets?: string[]
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string }
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-16 top-32 h-48 w-48 rounded-full bg-chart-2/20 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center sm:py-24">
        <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">{lede}</p>

        {bullets && (
          <ul className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={primary.href} className={cn(buttonVariants({ size: "lg" }), "group")}>
            {primary.label}
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export function Section({
  id,
  title,
  lede,
  children,
  muted = false,
}: {
  id?: string
  title: string
  lede?: ReactNode
  children: ReactNode
  muted?: boolean
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 border-b border-border/60 py-16 sm:py-20", muted && "bg-card/30")}
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        {lede && <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">{lede}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

export type Feature = {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>
  title: string
  desc: string
  /** Theme token the card's icon is tinted with. */
  accent?: string
}

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ icon: Icon, title, desc, accent = "var(--primary)" }) => (
        <li
          key={title}
          className="flex flex-col rounded-2xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)` }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </span>
          <h3 className="mt-4 text-base font-semibold">{title}</h3>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">{desc}</p>
        </li>
      ))}
    </ul>
  )
}

export function StepList({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <ol className="grid gap-5 sm:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="rounded-2xl border border-border bg-card/50 p-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {i + 1}
          </span>
          <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">{step.desc}</p>
        </li>
      ))}
    </ol>
  )
}

export type Faq = { q: string; a: string }

/**
 * Plain markup rather than an accordion: an answer hidden behind a click is an
 * answer Google has to guess at, and these pages exist to be read.
 */
export function FaqSection({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  return (
    <Section title={title} muted>
      <dl className="grid gap-5 md:grid-cols-2">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-2xl border border-border bg-background/60 p-6">
            <dt className="text-base font-semibold">{faq.q}</dt>
            <dd className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              {faq.a}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/**
 * Contextual links to sibling pages. Keeps every marketing page one hop from
 * the others, which is what stops any of them reading as a dead end.
 */
export function RelatedPages({ paths, title = "Keep exploring" }: { paths: string[]; title?: string }) {
  return (
    <Section title={title}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => {
          const route = marketingRoute(path)
          return (
            <li key={path}>
              <Link
                href={path}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/50"
              >
                <span className="flex items-center justify-between gap-3 text-base font-semibold">
                  {route.label}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </span>
                <span className="mt-2 text-pretty text-sm text-muted-foreground">
                  {route.description}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

export function FinalCta({
  title,
  desc,
  primary = { href: "/sign-up", label: "Create a free account" },
  secondary = { href: "/pricing", label: "See pricing" },
}: {
  title: string
  desc: string
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string }
}) {
  return (
    <section className="px-6 py-20 sm:py-24">
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-card/50 px-6 py-14 text-center sm:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">{desc}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={primary.href} className={cn(buttonVariants({ size: "lg" }), "group")}>
            {primary.label}
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href={secondary.href}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  )
}
