"use client"

/*
 * TEMPORARY preview route for choosing the small-screen (<1024px) nav pattern.
 * Delete this file once the option is picked — nothing links to it.
 *
 * Each variant is rendered inside a fixed 390px frame so all three can be
 * compared side by side on a desktop screen. The frames use explicit layout
 * rather than viewport breakpoints for exactly that reason.
 */

import { useState } from "react"
import {
  BookOpen,
  Building2,
  ChevronDown,
  FolderTree,
  GraduationCap,
  Menu,
  Sparkles,
  Tag,
  X,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { id: "students", label: "For Students", icon: BookOpen },
  { id: "teachers", label: "For Educators", icon: GraduationCap },
  { id: "schools", label: "For Schools", icon: Building2 },
  { id: "organized", label: "Always Organized", icon: FolderTree },
  { id: "ai", label: "AI Powered", icon: Sparkles, accent: true },
  { id: "pricing", label: "Pricing", icon: Tag },
]

/** A 390px-wide stand-in for a phone screen, so the variants can be compared. */
function PhoneFrame({
  option,
  title,
  note,
  children,
}: {
  option: string
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Option {option}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-[390px] text-sm leading-relaxed text-muted-foreground">{note}</p>
      </div>
      <div className="w-[390px] overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {children}
        {/* Tall enough that Option C's anchored dropdown is not clipped by the
            frame's rounded overflow. */}
        <div className="flex min-h-[280px] flex-col border-t border-border bg-muted/30 px-5 py-8">
          <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
          <div className="mt-2 h-3 w-5/6 rounded-full bg-foreground/[0.07]" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-foreground/[0.07]" />
          <p className="mt-auto pt-4 text-center text-xs text-muted-foreground">page content</p>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Option A — hamburger that slides a full panel down under the header */
/* ---------------------------------------------------------------- */
function OptionSlideDown() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Logo iconClassName="h-8 w-8" textClassName="text-base" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open ? (
        <div className="border-b border-border bg-background px-3 py-3">
          <nav className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] transition-colors hover:bg-muted ${
                  item.accent ? "font-semibold text-primary" : "text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t border-border px-1 pt-3">
            <Button variant="outline" className="w-full justify-center">
              Sign in
            </Button>
            <Button className="w-full justify-center">Get started free</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Option B — always-visible strip of pills that scrolls sideways     */
/* ---------------------------------------------------------------- */
function OptionPillStrip() {
  const [active, setActive] = useState("students")

  return (
    <div>
      <header className="flex items-center justify-between px-5 py-3">
        <Logo iconClassName="h-8 w-8" textClassName="text-base" />
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
          <Button size="sm">Get started</Button>
        </div>
      </header>
      <div className="relative border-b border-border">
        {/* Fades the cut-off pill so the sideways scroll reads as an affordance
            rather than a clipping bug. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        />
        <div
          className="flex gap-2 overflow-x-auto px-5 pb-3"
          style={{ scrollbarWidth: "none" }}
          aria-label="Page sections"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              } ${item.accent && active !== item.id ? "font-semibold text-primary" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Option C — compact Menu dropdown, primary button stays in the row  */
/* ---------------------------------------------------------------- */
function OptionDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Logo iconClassName="h-8 w-8" textClassName="text-base" />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Menu
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          <Button size="sm">Get started</Button>
        </div>
      </header>

      {open ? (
        <div className="absolute right-4 top-[58px] z-10 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          <nav className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  item.accent ? "font-semibold text-primary" : "text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              Sign in
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function NavMenuPreviewPage() {
  return (
    <main className="min-h-dvh bg-muted/20 px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Temporary preview
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold text-foreground">
            Small-screen navigation options
          </h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            Below 1024px the section links are hidden with no way to reach them. Each option below
            is interactive — open the menus and scroll the strip, then tell me which to build. Every
            frame is 390px wide, about the width of a phone.
          </p>
        </header>

        <div className="mt-10 flex flex-wrap gap-x-12 gap-y-14">
          <PhoneFrame
            option="A"
            title="Slide-down panel"
            note="A hamburger opens a full-width panel under the header. Roomy tap targets, icons for scanning, and both account buttons sit at the bottom. The most conventional choice."
          >
            <OptionSlideDown />
          </PhoneFrame>

          <PhoneFrame
            option="B"
            title="Scrolling pill strip"
            note="No menu to open — the sections are always on screen as pills you swipe sideways. One tap to anywhere, and it shows the active section. Costs a second row of header height on every page."
          >
            <OptionPillStrip />
          </PhoneFrame>

          <PhoneFrame
            option="C"
            title="Compact Menu dropdown"
            note="A small Menu button opens an anchored dropdown, keeping Get started free visible in the row. Lightest touch and closest to the desktop header, but the smallest tap targets."
          >
            <OptionDropdown />
          </PhoneFrame>
        </div>
      </div>
    </main>
  )
}
