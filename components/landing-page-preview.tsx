"use client"

import type React from "react"
import { Fragment, useEffect, useState } from "react"
import { Reveal } from "@/components/reveal"
import { AiPoweredSection } from "@/components/ai-powered-section"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CodeTransferAnimation } from "@/components/code-transfer-animation"
import { FeatureAnimation } from "@/components/feature-animations"
import {
  Play,
  FolderTree,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Terminal,
  Zap,
  Users,
  CheckCircle2,
  Code2,
  PanelsTopLeft,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Logo, LogoWordmark } from "@/components/logo"
import { LANGUAGES } from "@/lib/ide/languages"

/* ------------------------------------------------------------------ */
/* Scroll indicator — sits in the hero flow so it can never cover the   */
/* call-to-action buttons, and fades out once the page is scrolled.     */
/* ------------------------------------------------------------------ */
function ScrollIndicator() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < 24)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none mt-7 flex flex-col items-center gap-1.5 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Scroll to explore
      </span>
      <div style={{ animation: "bounce-down 2s ease-in-out infinite" }}>
        <svg
          className="h-5 w-5 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  )
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const sections = [
  {
    id: "students",
    eyebrow: "For students",
    icon: BookOpen,
    title: "Write and run real code without leaving the browser",
    desc: "Practise on your own, or join a class or tutoring group with a single code. Pick an IDE and hit run. Python prints straight to an interactive console you can type into, HTML renders in a live preview — and every keystroke saves automatically.",
    image: "/images/students.png",
    imageAlt: "Illustration of a student writing code on a laptop",
    points: [
      "Python and HTML today, more languages on the way",
      "Interactive console and live page preview",
      "Autosave on every change",
    ],
    accent: "primary",
  },
  {
    id: "teachers",
    eyebrow: "For teachers & tutors",
    icon: GraduationCap,
    title: "Every learner's work, on one live dashboard",
    desc: "Set up a school class, a small tutoring group or a single 1-to-1 student. Share the join code and watch their work arrive. Open any file, run it yourself and give feedback, whether you teach a class of 30 or one student online.",
    image: "/images/teachers.png",
    imageAlt: "Illustration of a teacher or tutor reviewing student code on a dashboard",
    points: [
      "Classes, small groups or 1-to-1 students",
      "Run any learner's file",
      "Shareable join codes",
    ],
    accent: "chart-2",
    highlight: {
      badge: "New",
      title: "AI task generation",
      desc: "Describe a topic, year group and learning objective — get a ready-to-assign task draft in seconds, then edit anything before it reaches students.",
    },
  },
  {
    id: "organized",
    eyebrow: "Always organized",
    icon: FolderTree,
    title: "Group, then learner, then file — never lost",
    desc: "Work is filed into a clean tree the moment it's written. You always know who wrote what, in which class or lesson group, and when it was last updated.",
    image: "/images/organized.png",
    imageAlt: "Illustration of an organized folder tree of code files",
    points: ["Structured folder tree", "Last-updated timestamps", "Zero manual sorting"],
    accent: "chart-3",
  },
] as const

/**
 * The IDEs that ship today. Mirrors LANGUAGES in lib/ide/languages.ts — when a
 * third IDE lands there, add it here so the hero stops promising and starts
 * showing it.
 */
const languages = [
  {
    label: "Python",
    ext: ".py",
    blurb: "Run code, read output",
    icon: Terminal,
    color: LANGUAGES.python.accent,
  },
  {
    label: "HTML",
    ext: ".html · .css · .js",
    blurb: "Build and preview pages",
    icon: PanelsTopLeft,
    color: LANGUAGES.html.accent,
  },
] as const

const stats = [
  { icon: Zap, value: "0", label: "installs needed" },
  { icon: Code2, value: "2", label: "IDEs, one account" },
  { icon: Users, value: "1", label: "code to join a class or tutor" },
]

const audiences = [
  {
    eyebrow: "For students",
    line: "Learn, practise and build",
    icon: BookOpen,
    accent: "primary",
  },
  {
    eyebrow: "For teachers",
    line: "Teach, manage and review",
    icon: GraduationCap,
    accent: "chart-2",
  },
  {
    eyebrow: "For tutors",
    line: "Teach 1-to-1 or in small groups",
    icon: UserRound,
    accent: "chart-4",
  },
] as const

const journey = ["Learn", "Code", "Teach", "Share"] as const

function AudienceRow() {
  return (
    <section aria-labelledby="audiences-heading" className="mt-8 w-full">
      <h2 id="audiences-heading" className="sr-only">
        A coding platform for students, teachers and tutors
      </h2>
      <ol
        aria-label="How myCodePad works"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
      >
        {journey.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className={i === 0 ? "text-foreground" : undefined}>{step}</span>
            {i < journey.length - 1 && (
              <ArrowRight aria-hidden className="h-3 w-3 text-muted-foreground/60" />
            )}
          </li>
        ))}
      </ol>
      <ul className="mx-auto mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {audiences.map((a) => (
          <li
            key={a.eyebrow}
            className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 text-left backdrop-blur transition-colors hover:border-primary/40"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklch, var(--${a.accent}) 16%, transparent)` }}
            >
              <a.icon aria-hidden className="h-4 w-4" style={{ color: `var(--${a.accent})` }} />
            </span>
            <span className="flex flex-col leading-tight">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: `var(--${a.accent})` }}
              >
                {a.eyebrow}
              </span>
              <span className="mt-1 text-sm text-foreground">{a.line}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LandingPagePreview() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const top = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(top > 12)
      setProgress(height > 0 ? Math.min(1, top / height) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <main className="flex min-h-svh flex-col scroll-smooth">
      {/* Scroll progress bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
        <div
          className="h-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Sticky header */}
      <header
        className={`sticky top-0 z-40 flex items-center justify-between px-6 py-4 transition-all duration-300 sm:px-10 ${
          scrolled
            ? "border-b border-border bg-background/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <Link href="#top">
          <Logo iconClassName="h-9 w-9" textClassName="text-lg" showTagline />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {sections
            .filter((s) => s.id !== "organized")
            .map((s) => (
              <a key={s.id} href={`#${s.id}`} className="transition-colors hover:text-foreground">
                {s.eyebrow}
              </a>
            ))}
            <a href="#organized" className="transition-colors hover:text-foreground">
              Always organized
            </a>
            <a href="#ai" className="transition-colors hover:text-foreground">
              AI powered
            </a>
            <Link href="/pricing" className="font-medium text-foreground transition-colors hover:text-primary">
              Pricing
            </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost">
            Sign in
          </Button>
          <Button render={<Link href="/sign-up" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section
        id="top"
        className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24 pt-10 text-center sm:pt-16"
      >
        {/* Animated background glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 animate-pulse rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-10 top-40 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute left-10 top-52 h-56 w-56 rounded-full bg-chart-2/20 blur-3xl" />
        </div>

        <Reveal>
          <div 
            className="mb-5 inline-flex items-center gap-2 rounded-full border-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2 text-xs font-semibold text-primary"
            style={{
              animation: 'border-glow 10s ease-in-out infinite'
            }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <Play className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="shimmer-text">Run your code right in the browser</span>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            <span className="rainbow-text">More than</span> just an IDE. Built for learning,
            teaching and coding.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Whether you&apos;re learning on your own, teaching a class, or tutoring students
            1-to-1, myCodePad gives you one simple place to write, run, share and manage code.
          </p>
        </Reveal>
        <Reveal delay={180} className="w-full">
          <AudienceRow />
        </Reveal>

        {/* Languages: what ships today, and what is coming next */}
        <Reveal delay={200} className="mt-7">
          <p
            id="languages-label"
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            What you can build today
          </p>
          <ul
            aria-labelledby="languages-label"
            className="mt-3 flex flex-wrap items-center justify-center gap-2"
          >
            {languages.map((lang) => (
              <li
                key={lang.label}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 py-2 pl-2.5 pr-4 text-left backdrop-blur transition-colors hover:border-primary/40"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in oklch, ${lang.color} 18%, transparent)` }}
                >
                  <lang.icon className="h-4 w-4" style={{ color: lang.color }} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">
                    {lang.label}
                    <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">
                      {lang.ext}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{lang.blurb}</span>
                </span>
              </li>
            ))}
            <li
              className="flex items-center gap-2 rounded-xl border border-dashed px-3.5 py-3 text-sm font-medium"
              style={{
                borderColor: "color-mix(in oklch, var(--chart-3) 50%, transparent)",
                color: "var(--chart-3)",
              }}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              More languages coming soon
            </li>
          </ul>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg" className="group">
              Start coding
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg" variant="outline">
              I already have an account
            </Button>
          </div>
        </Reveal>

        <ScrollIndicator />

        {/* Hero: live "student → teacher" code transfer animation */}
        <Reveal delay={320} className="mt-12 w-full">
          <CodeTransferAnimation />
        </Reveal>

        {/* Stats band */}
        <Reveal delay={120} className="mt-16 w-full">
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/50 px-4 py-5 backdrop-blur transition-colors hover:border-primary/40"
              >
                <s.icon className="mb-1 h-5 w-5 text-primary" />
                <span className="text-2xl font-semibold">{s.value}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Feature sections */}
      {sections.map((s, i) => {
        const Icon = s.icon
        const flipped = i % 2 === 1
        return (
          <Fragment key={s.id}>
          <section
            id={s.id}
            className="scroll-mt-24 border-t border-border/60 py-20 sm:py-28"
          >
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
              {/* Text */}
              <Reveal className={flipped ? "md:order-2" : ""}>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `color-mix(in oklch, var(--${s.accent}) 15%, transparent)`,
                    color: `var(--${s.accent})`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.eyebrow}
                </span>
                <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {s.title}
                </h2>
                <p className="mt-4 text-pretty text-lg text-muted-foreground">{s.desc}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                {"highlight" in s && s.highlight && (
                  <div
                    className="group relative mt-6 overflow-hidden rounded-2xl border-2 p-5"
                    style={{
                      borderColor: "color-mix(in oklch, var(--primary) 45%, transparent)",
                      background:
                        "linear-gradient(120deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 4%, transparent) 55%, transparent)",
                      animation: "border-glow 10s ease-in-out infinite",
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl"
                    />
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{s.highlight.title}</h3>
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                            {s.highlight.badge}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                          {s.highlight.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Reveal>

              {/* Interactive animation */}
              <Reveal delay={120} className={flipped ? "md:order-1" : ""}>
                <FeatureAnimation id={s.id} />
              </Reveal>
            </div>
          </section>
          {s.id === "organized" && <AiPoweredSection />}
          </Fragment>
        )
      })}

      {/* Final CTA */}
      <section className="border-t border-border/60 px-6 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/50 px-6 py-14 text-center backdrop-blur-xl sm:px-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to start coding?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
              Learning, teaching a class or tutoring? Create a free account and open the editor in
              seconds. No setup, no installs.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg" className="group">
                Get started free
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg" variant="outline">
                Sign in
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div className="max-w-xs">
              <Logo iconClassName="h-8 w-8" textClassName="text-base" />
              <p className="mt-3 text-sm text-muted-foreground text-pretty">
                The online coding IDE and coding platform for students, teachers and tutors. Write,
                run, share and review real Python and HTML code without leaving the browser.
              </p>
            </div>

            <FooterColumn
              heading="Product"
              links={[
                { label: "For students", href: "#students" },
                { label: "For teachers & tutors", href: "#teachers" },
              { label: "Always organized", href: "#organized" },
              { label: "AI powered", href: "#ai" },
                { label: "Pricing", href: "/pricing" },
              ]}
            />
            <FooterColumn
              heading="Company"
              links={[
                { label: "About us", href: "#" },
                { label: "Contact", href: "#" },
                { label: "Blog", href: "#" },
              ]}
            />
            <FooterColumn
              heading="Get started"
              links={[
                { label: "Create account", href: "/sign-up" },
                { label: "Sign in", href: "/sign-in" },
                { label: "For tutors", href: "/pricing" },
                { label: "For schools", href: "/pricing#school-plans" },
              ]}
            />
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
            <span>
              © {new Date().getFullYear()} <LogoWordmark className="text-sm" />. All rights
              reserved.
            </span>
            <div className="flex items-center gap-5">
              <a href="#" className="transition-colors hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-foreground">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
