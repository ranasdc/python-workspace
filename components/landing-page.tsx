"use client"

import type React from "react"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
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
  Building2,
  CheckCircle2,
  Code2,
  PanelsTopLeft,
  Sparkles,
  Menu,
  X,
  Tag,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { MarketingFooter } from "@/components/marketing/marketing-chrome"
import { LANGUAGES } from "@/lib/ide/languages"
import { IDE_ROUTES } from "@/lib/seo/marketing"

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

const sections = [
  {
    id: "students",
    eyebrow: "For Students",
    icon: BookOpen,
    title: "Write and run real code without leaving the browser",
    desc: "Join a class with a single code, pick an IDE, and hit run. Python prints straight to an interactive console you can type into, HTML renders in a live preview — and every keystroke saves automatically.",
    image: "/images/students.png",
    imageAlt: "Illustration of a student writing code on a laptop",
    points: [
      "Python and HTML today, more languages on the way",
      "Interactive console and live page preview",
      "Autosave on every change",
    ],
    accent: "primary",
    href: "/for-students",
    cta: "Explore the student workspace",
  },
  {
    id: "teachers",
    eyebrow: "For Educators",
    icon: GraduationCap,
    title: "Every student's work, on one live dashboard",
    desc: "Spin up a class, share the join code, and watch submissions flow in. Open any file, run it yourself, and give feedback — all from a dashboard built for the classroom. Perfect for school classrooms and tutoring.",
    image: "/images/teachers.png",
    imageAlt: "Illustration of a teacher reviewing student code on a dashboard",
    points: ["One-click class creation", "Run any student file", "Shareable join codes"],
    accent: "chart-2",
    href: "/for-teachers",
    cta: "See how teaching works",
    highlight: {
      badge: "New",
      title: "AI task generation",
      desc: "Describe a topic, year group and learning objective — get a ready-to-assign task draft in seconds, then edit anything before it reaches students.",
    },
  },
  {
    id: "schools",
    eyebrow: "For Schools",
    icon: Building2,
    title: "One plan, and the whole department is covered",
    desc: "A school admin invites staff with a single code, each teacher brings their own classes in, and everyone who joins lands on Pro. No per-pupil licences to chase, and no student is ever asked for a card.",
    points: [
      "School admin invites teachers with a staff code",
      "Teachers add their students with a class join code",
      "Every teacher and student is on Pro automatically",
    ],
    accent: "chart-4",
    href: "/for-schools",
    cta: "See how school / MAT works",
  },
  {
    id: "organized",
    eyebrow: "Always Organized",
    icon: FolderTree,
    title: "Class, then student, then file — never lost",
    desc: "Work is filed into a clean tree the moment it's written. You always know who wrote what, in which class, and when it was last updated.",
    image: "/images/organized.png",
    imageAlt: "Illustration of an organized folder tree of code files",
    points: ["Structured folder tree", "Last-updated timestamps", "Zero manual sorting"],
    accent: "chart-3",
  },
] as const

/**
 * The in-page anchors the nav tracks, in the order they appear down the page.
 * Derived from `sections` so a new feature section is picked up by both the
 * nav and the scroll highlight without a second list to keep in step. The AI
 * section is appended because it renders after the last feature section.
 */
const NAV_SECTION_IDS: string[] = [...sections.map((s) => s.id), "ai"]

/**
 * The same destinations as the desktop nav, carrying an icon each so the
 * slide-down panel can be scanned down a column rather than read across a row.
 * Built from `sections` for the same reason as NAV_SECTION_IDS — one list to
 * keep in step instead of three.
 */
const MOBILE_NAV_ITEMS = [
  ...sections.map((s) => ({ id: s.id, href: `#${s.id}`, label: s.eyebrow, icon: s.icon })),
  { id: "ai", href: "#ai", label: "AI Powered", icon: Sparkles },
  { id: "pricing", href: "/pricing", label: "Pricing", icon: Tag },
] as const

/**
 * A nav anchor that underlines itself while its section owns the viewport.
 * The underline grows from the centre rather than fading, so the highlight
 * visibly travels from one item to the next as the reader scrolls.
 */
function NavLink({
  href,
  active,
  className = "",
  children,
}: {
  href: string
  active: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-current={active ? "location" : undefined}
      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
        active ? "text-foreground" : "hover:text-foreground"
      } ${className}`}
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out"
        style={{ width: active ? "100%" : "0%", opacity: active ? 1 : 0 }}
      />
    </a>
  )
}

/** Marks the nav while its labels are folded onto two lines. */
const NAV_STACKED_CLASS = "nav-labels-stacked"

/**
 * Empty pixels the header insists on keeping around a one-line nav. The row is
 * justified apart, so this is shared between the logo-to-nav and nav-to-buttons
 * gaps — roughly 72px each. Below that the three groups read as one crowded
 * block, and any extra demand (a wider fallback font, a classic Windows
 * scrollbar) starts pushing the account buttons off the right edge. A 1920px
 * panel at 150% display scaling reports 1280 CSS pixels and lands here, which
 * is the case this guards.
 */
const NAV_MIN_SLACK = 144

/** useLayoutEffect in the browser, useEffect on the server — measuring before
 *  paint without tripping React's server-rendering warning. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * A two-word nav label that can fold after its first word, with the second
 * word centred underneath. Whether it folds is decided by the header measuring
 * its own row, not by a viewport breakpoint.
 */
function NavLabel({ children, className = "" }: { children: string; className?: string }) {
  const [first, ...rest] = children.split(" ")
  return (
    <span className={`nav-stack-label ${className}`}>
      <span>{first}</span>
      {rest.length > 0 ? <span>{rest.join(" ")}</span> : null}
    </span>
  )
}

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
    href: IDE_ROUTES.python,
  },
  {
    label: "HTML",
    ext: ".html · .css · .js",
    blurb: "Build and preview pages",
    icon: PanelsTopLeft,
    color: LANGUAGES.html.accent,
    href: IDE_ROUTES.html,
  },
] as const

const stats = [
  { icon: Zap, value: "0", label: "installs needed" },
    { icon: Code2, value: "Multiple", label: "IDEs, one account" },
  { icon: Users, value: "1", label: "code to join a class" },
]

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [navStacked, setNavStacked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const headerRef = useRef<HTMLElement>(null)
  const logoRef = useRef<HTMLAnchorElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      const top = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(top > 12)
      setProgress(height > 0 ? Math.min(1, top / height) : 0)

      // A single horizontal scanline a third of the way down the viewport
      // decides which section the reader is "in". Measuring against one line
      // rather than intersection ratios keeps exactly one nav item lit, even
      // when a short section and a tall one are on screen together.
      const line = window.innerHeight / 3
      let current: string | null = null
      for (const id of NAV_SECTION_IDS) {
        const el = document.getElementById(id)
        if (!el) continue
        const box = el.getBoundingClientRect()
        if (box.top <= line && box.bottom > line) {
          current = id
          break
        }
      }
      setActiveSection(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  /**
   * While the slide-down panel is open: Escape closes it, and so does growing
   * past the point where the full nav returns — otherwise the panel would be
   * left open behind a header that no longer has a button to close it.
   */
  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    const desktop = window.matchMedia("(min-width: 1024px)")
    const onBreakpoint = () => {
      if (desktop.matches) setMenuOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    desktop.addEventListener("change", onBreakpoint)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      desktop.removeEventListener("change", onBreakpoint)
    }
  }, [menuOpen])

  /**
   * Fold the nav labels only when this particular row has genuinely run out of
   * room. Browser or display zoom shrinks the usable width without changing
   * anything else, so measuring the row catches it, while a fixed breakpoint
   * would either fire early on a roomy screen or miss a crowded one.
   *
   * The nav is measured with the fold removed every time, so the next decision
   * is read from the one-line width rather than from the state the last
   * decision produced — that is what stops it flipping back and forth.
   */
  useIsomorphicLayoutEffect(() => {
    const header = headerRef.current
    const nav = navRef.current
    const logo = logoRef.current
    const actions = actionsRef.current
    if (!header || !nav || !logo || !actions) return

    const measure = () => {
      const headerWidth = header.clientWidth

      // Below lg the nav is display:none and the buttons own the row.
      if (nav.offsetParent === null) {
        setNavStacked(false)
        return
      }

      const folded = nav.classList.contains(NAV_STACKED_CLASS)
      if (folded) nav.classList.remove(NAV_STACKED_CLASS)
      const oneLineNavWidth = nav.getBoundingClientRect().width
      if (folded) nav.classList.add(NAV_STACKED_CLASS)

      const style = getComputedStyle(header)
      const room = headerWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const slack =
        room -
        logo.getBoundingClientRect().width -
        actions.getBoundingClientRect().width -
        oneLineNavWidth

      setNavStacked(slack < NAV_MIN_SLACK)
    }

    measure()

    // Measuring from the one-line width makes the result independent of the
    // fold it produces, so re-running after our own change settles rather than
    // oscillates. Batching into a frame keeps the class swap out of the
    // observer callback that triggered it.
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    // The header catches zoom and window resizes; the nav catches anything that
    // changes what the labels themselves demand.
    const observer = new ResizeObserver(schedule)
    observer.observe(header)
    observer.observe(nav)
    window.addEventListener("resize", schedule)
    // Label widths shift when the webfont swaps in, which no resize reports.
    document.fonts?.ready.then(schedule).catch(() => {})

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", schedule)
    }
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

      {/* Scrim for the slide-down panel. It has to sit outside the header:
          the header's backdrop-blur makes it the containing block for fixed
          children, which would shrink this to the header's own box instead of
          covering the viewport. Below the header's z-40, above the page. */}
      {menuOpen ? (
        <div
          aria-hidden
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      {/* Sticky header */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-40 flex items-center justify-between px-6 py-4 transition-all duration-300 sm:px-10 ${
          // An open panel needs an opaque row above it, or the dimmed page
          // shows through behind the logo and close button.
          scrolled || menuOpen
            ? "border-b border-border bg-background/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <Link href="#top" ref={logoRef}>
          {/* Six nav labels need the full width, so the tagline steps aside
              until there is room for both. Holding it back below 1280px is
              what lets the nav still sit on one line on a 1920px panel at 150%
              display scaling, which reports roughly 1264 usable pixels. */}
          <Logo
            iconClassName="h-9 w-9"
            textClassName="text-lg"
            showTagline
            taglineClassName="hidden xl:inline-block"
          />
        </Link>
        <nav
          ref={navRef}
          className={`hidden items-center gap-5 text-sm text-muted-foreground lg:flex ${
            navStacked ? NAV_STACKED_CLASS : ""
          }`}
        >
          {/* Driven by `sections`, so the nav order always matches the page order. */}
          {sections.map((s) => (
            <NavLink key={s.id} href={`#${s.id}`} active={activeSection === s.id}>
              <NavLabel>{s.eyebrow}</NavLabel>
            </NavLink>
          ))}
          <NavLink href="#ai" active={activeSection === "ai"} className="ai-nav-pill font-semibold">
            <Sparkles aria-hidden className="ai-nav-pill-spark h-3.5 w-3.5" />
            <NavLabel className="ai-nav-pill-label">AI Powered</NavLabel>
          </NavLink>
          <Link
            href="/pricing"
            className="whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary"
          >
            Pricing
          </Link>
        </nav>
        <div ref={actionsRef} className="hidden items-center gap-2 lg:flex">
          <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost">
            Sign in
          </Button>
          <Button render={<Link href="/sign-up" />} nativeButton={false}>
            Get started free
          </Button>
        </div>

        {/* Below lg the links have nowhere to sit, so they move into a panel
            behind this button rather than disappearing. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        {menuOpen ? (
          /* Absolutely positioned so opening the panel overlays the page
             instead of pushing it down — the header row above stays a plain
             flex line, which is what the width measuring depends on. */
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="absolute inset-x-0 top-full animate-in border-b border-border bg-background px-3 pb-4 pt-2 shadow-lg duration-200 fade-in slide-in-from-top-2 lg:hidden"
          >
              <ul className="flex flex-col">
                {MOBILE_NAV_ITEMS.map((item) => {
                  const active = activeSection === item.id
                  const content = (
                    <Fragment>
                      <item.icon
                        aria-hidden
                        className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                      />
                      {item.label}
                    </Fragment>
                  )
                  const className = `flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] transition-colors hover:bg-muted ${
                    active ? "bg-muted font-medium text-foreground" : "text-foreground"
                  } ${item.id === "ai" ? "font-semibold" : ""}`

                  return (
                    <li key={item.id}>
                      {item.href.startsWith("#") ? (
                        <a
                          href={item.href}
                          aria-current={active ? "location" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link href={item.href} className={className}>
                          {content}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-3 flex flex-col gap-2 border-t border-border px-1 pt-4">
                <Button
                  render={<Link href="/sign-in" />}
                  nativeButton={false}
                  variant="outline"
                  className="w-full justify-center"
                >
                  Sign in
                </Button>
                <Button
                  render={<Link href="/sign-up" />}
                  nativeButton={false}
                  className="w-full justify-center"
                >
                  Get started free
                </Button>
              </div>
          </nav>
        ) : null}
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
            {/* Keep "More than" in its own span so the rainbow shimmer survives copy edits. */}
            <span className="rainbow-text">More than</span>
            {" just an IDE — free online coding editors for Python, HTML and more"}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            MyCodePad is a free online coding platform with multiple IDEs. Write, run and practise
            code in your browser — whether you&apos;re a student, teacher or developer.
          </p>
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
              <li key={lang.label}>
                {/* Each card is the entry point to that IDE's own page, so the
                    hero doubles as the homepage's main internal link set. */}
                <Link
                  href={lang.href}
                  className="flex h-full items-center gap-2.5 rounded-xl border border-border bg-card/60 py-2 pl-2.5 pr-4 text-left backdrop-blur transition-colors hover:border-primary/40"
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
                </Link>
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
                  Start coding for free
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

                {"href" in s && (
                  <Link
                    href={s.href}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-foreground"
                  >
                    {s.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

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

      {/* Shared with every marketing page, so the internal links a crawler
          follows from the homepage are the same ones it finds anywhere else. */}
      <MarketingFooter />
    </main>
  )
}
