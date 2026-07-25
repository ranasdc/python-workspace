"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
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
} from "lucide-react"
import { Logo, LogoWordmark } from "@/components/logo"

/* ------------------------------------------------------------------ */
/* Scroll-reveal wrapper: fades + slides children in when they enter   */
/* the viewport, using IntersectionObserver (no data fetching).        */
/* ------------------------------------------------------------------ */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-sm"
      } ${className}`}
    >
      {children}
    </div>
  )
}

const sections = [
  {
    id: "students",
    eyebrow: "For students",
    icon: BookOpen,
    title: "Write and run Python without leaving the browser",
    desc: "Join a class with a single code, open a clean editor, and hit run. Output appears instantly in an interactive console you can type into — and every keystroke saves automatically.",
    image: "/images/students.png",
    imageAlt: "Illustration of a student writing Python code on a laptop",
    points: ["Real Python via Pyodide", "Interactive input in the console", "Autosave on every change"],
    accent: "primary",
  },
  {
    id: "teachers",
    eyebrow: "For teachers",
    icon: GraduationCap,
    title: "Every student's work, on one live dashboard",
    desc: "Spin up a class, share the join code, and watch submissions flow in. Open any file, run it yourself, and give feedback — all from a dashboard built for the classroom.",
    image: "/images/teachers.png",
    imageAlt: "Illustration of a teacher reviewing student code on a dashboard",
    points: ["One-click class creation", "Run any student file", "Shareable join codes"],
    accent: "chart-2",
  },
  {
    id: "organized",
    eyebrow: "Always organized",
    icon: FolderTree,
    title: "Class, then student, then file — never lost",
    desc: "Work is filed into a clean tree the moment it's written. You always know who wrote what, in which class, and when it was last updated.",
    image: "/images/organized.png",
    imageAlt: "Illustration of an organized folder tree of code files",
    points: ["Structured folder tree", "Last-updated timestamps", "Zero manual sorting"],
    accent: "chart-3",
  },
] as const

const stats = [
  { icon: Zap, value: "0", label: "installs needed" },
  { icon: Terminal, value: "100%", label: "browser-based" },
  { icon: Users, value: "1", label: "code to join a class" },
]

export function LandingPage() {
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
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="transition-colors hover:text-foreground">
              {s.eyebrow}
            </a>
          ))}
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
        className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-24"
      >
        {/* Animated background glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 animate-pulse rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-10 top-40 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute left-10 top-52 h-56 w-56 rounded-full bg-chart-2/20 blur-3xl" />
        </div>

        <Reveal>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Play className="h-3 w-3 text-primary" />
            Runs Python right in the browser
          </span>
        </Reveal>
      <Reveal delay={80}>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          A more than Python IDE built for teachers and students
        </h1>
      </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Students write and run code in a clean editor. Their code flows straight to the
            teacher&apos;s dashboard, neatly organized by class, student, and file.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg" className="group">
              Start coding
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg" variant="outline">
              I already have an account
            </Button>
          </div>
        </Reveal>

        {/* Hero: live "student → teacher" code transfer animation */}
        <Reveal delay={320} className="mt-16 w-full">
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
          <section
            key={s.id}
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
              </Reveal>

              {/* Interactive animation */}
              <Reveal delay={120} className={flipped ? "md:order-1" : ""}>
                <FeatureAnimation id={s.id} />
              </Reveal>
            </div>
          </section>
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
              Create a free account and open the editor in seconds. No setup, no installs.
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

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <LogoWordmark className="text-sm" /> — Python IDE for classrooms.
      </footer>
    </main>
  )
}
