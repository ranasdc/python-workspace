"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  Check,
  FileCode2,
  Folder,
  KeyRound,
  User,
  Pencil,
  Save,
  Sparkles,
  X,
  MessageSquare,
} from "lucide-react"

/* ================================================================== *
 * Borderless, looping feature animations for the landing page.        *
 * All motion is pure CSS/React state — no images, no data fetching.   *
 * Themed with app tokens: primary (students), chart-2 (teachers),     *
 * chart-3 (organized), destructive (errors).                          *
 * ================================================================== */

type Token = { t: string; c?: "kw" | "fn" | "str" | "num" }

const TOKEN_CLASS: Record<NonNullable<Token["c"]>, string> = {
  kw: "text-primary font-medium",
  fn: "text-chart-2",
  str: "text-chart-3",
  num: "text-accent-foreground",
}

const plainOf = (line: Token[]) => line.map((t) => t.t).join("")

/* ------------------------------------------------------------------ */
/* 1. Student — typing Python into a laptop                            */
/* ------------------------------------------------------------------ */

// Tokens with no `c` render as plain code; only highlighted spans name a class.
const STUDENT_CODE: Token[][] = [
  [{ t: "name " }, { t: "=", c: "kw" }, { t: " " }, { t: '"Ada"', c: "str" }],
  [{ t: "for", c: "kw" }, { t: " i " }, { t: "in", c: "kw" }, { t: " range(" }, { t: "3", c: "num" }, { t: "):" }],
  [{ t: "    print", c: "fn" }, { t: "(" }, { t: '"Hi"', c: "str" }, { t: ", name)" }],
]

function StudentAnimation() {
  const [lineIndex, setLineIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [saved, setSaved] = useState(false)

  // Typewriter that loops: type all lines, hold + show "Saved", then reset.
  useEffect(() => {
    const active = STUDENT_CODE[lineIndex]
    const plain = plainOf(active)

    if (charCount < plain.length) {
      const id = setTimeout(() => setCharCount((c) => c + 1), 55)
      return () => clearTimeout(id)
    }
    if (lineIndex < STUDENT_CODE.length - 1) {
      const id = setTimeout(() => {
        setLineIndex((i) => i + 1)
        setCharCount(0)
      }, plain.length ? 260 : 100)
      return () => clearTimeout(id)
    }
    // Finished typing.
    const saveId = setTimeout(() => setSaved(true), 500)
    const resetId = setTimeout(() => {
      setSaved(false)
      setLineIndex(0)
      setCharCount(0)
    }, 2600)
    return () => {
      clearTimeout(saveId)
      clearTimeout(resetId)
    }
  }, [lineIndex, charCount])

  const rowH = 1.6 // rem — matches the teacher animation

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-md [perspective:1200px]">
      <Glow className="from-primary/40" />

      {/* code sheet — floats directly on the section (no card, no dark screen) */}
      <div className="relative px-1 transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(6deg)_scale(1.01)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Pencil className="h-3 w-3" />
            </span>
            Writing code
          </span>
          {/* autosave status pill, styled like the teacher badges */}
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              saved ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"
            }`}
          >
            {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3 animate-pulse" />}
            {saved ? "Saved" : "Saving"}
          </span>
        </div>

        <div className="flex flex-col">
          {STUDENT_CODE.map((line, i) => {
            const done = i < lineIndex
            const isActive = i === lineIndex
            const plain = plainOf(line)
            return (
              <div key={i} className="flex items-center gap-3 pl-5" style={{ height: `${rowH}rem` }}>
                <span className="w-3 select-none text-right font-mono text-[10px] text-muted-foreground/50">
                  {i + 1}
                </span>
                <code className="whitespace-pre font-mono text-[11px] leading-none sm:text-xs">
                  {done ? (
                    line.map((tok, j) => (
                      <span key={j} className={tok.c ? TOKEN_CLASS[tok.c] : "text-foreground/80"}>
                        {tok.t}
                      </span>
                    ))
                  ) : isActive ? (
                    <>
                      <span className="text-foreground/80">{plain.slice(0, charCount)}</span>
                      <span
                        className="ml-px inline-block h-3.5 w-[2px] -translate-y-[1px] bg-primary align-middle"
                        style={{ animation: "pyide-caret 1s steps(1) infinite" }}
                      />
                    </>
                  ) : null}
                </code>
              </div>
            )
          })}
        </div>
      </div>

      {/* floating "keystroke" spark */}
      <div
        className="absolute -left-2 top-10 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg"
        style={{ animation: "pyide-float 3s ease-in-out infinite" }}
      >
        <Sparkles className="h-3 w-3" />
        live
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Teacher — marking code and flagging an error                     */
/* ------------------------------------------------------------------ */

const TEACHER_CODE: (Token[] | null)[] = [
  [{ t: "def", c: "kw" }, { t: " area", c: "fn" }, { t: "(w, h):" }],
  [{ t: "    return", c: "kw" }, { t: " w " }, { t: "*", c: "kw" }, { t: " h" }],
  null, // blank line
  [{ t: "size " }, { t: "=", c: "kw" }, { t: " area(" }, { t: "5", c: "num" }, { t: ", " }, { t: "4", c: "num" }, { t: ")" }],
  [{ t: "print", c: "fn" }, { t: "(siez)" }], // typo -> error line
]
const ERROR_LINE = 4

function TeacherAnimation() {
  // marked = how many lines have been graded so far (0..len)
  const [marked, setMarked] = useState(0)
  // commentIn = the teacher's correction note has slid into view
  const [commentIn, setCommentIn] = useState(false)
  const total = TEACHER_CODE.length
  const done = marked >= total

  useEffect(() => {
    if (!done) {
      const id = setTimeout(() => setMarked((m) => m + 1), 620)
      return () => clearTimeout(id)
    }
    // Grading finished: reveal the comment, hold, then loop.
    const showId = setTimeout(() => setCommentIn(true), 450)
    const resetId = setTimeout(() => {
      setCommentIn(false)
      setMarked(0)
    }, 3800)
    return () => {
      clearTimeout(showId)
      clearTimeout(resetId)
    }
  }, [marked, done])

  // Pen sits on the line currently being graded.
  const penLine = Math.min(marked, total - 1)
  const rowH = 1.6 // rem

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-md [perspective:1200px]">
      <Glow className="from-chart-2/40" />

      {/* code sheet — floats directly on the section (no card, no border) */}
      <div className="relative px-1 transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(6deg)_scale(1.01)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-chart-2/15 text-chart-2">
              <Pencil className="h-3 w-3" />
            </span>
            Reviewing submission
          </span>

          {/* Mark mode: AI (active) or Manual */}
          <div className="flex items-center rounded-full bg-muted/60 p-0.5 text-[10px] font-semibold">
            <span className="flex items-center gap-1 rounded-full bg-chart-2 px-2 py-0.5 text-primary-foreground shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 text-muted-foreground">
              Manual
            </span>
          </div>
        </div>

        <div className="relative">
          {/* grading pen follows the active line */}
          {!done && (
            <div
              className="pointer-events-none absolute -left-1 z-10 text-chart-2 transition-[top] duration-500 ease-out"
              style={{ top: `${penLine * rowH + 0.1}rem`, animation: "pyide-wiggle 0.6s ease-in-out infinite" }}
            >
              <Pencil className="h-4 w-4 drop-shadow" />
            </div>
          )}

          <div className="flex flex-col">
            {TEACHER_CODE.map((line, i) => {
              const graded = i < marked
              const isError = i === ERROR_LINE
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-3 pl-5"
                  style={{ height: `${rowH}rem` }}
                >
                  <span className="w-3 select-none text-right font-mono text-[10px] text-muted-foreground/50">
                    {line ? i + 1 : ""}
                  </span>
                  <code className="relative whitespace-pre font-mono text-[11px] leading-none sm:text-xs">
                    {line ? (
                      line.map((tok, j) => (
                        <span key={j} className={tok.c ? TOKEN_CLASS[tok.c] : "text-foreground/80"}>
                          {tok.t}
                        </span>
                      ))
                    ) : (
                      <span>&nbsp;</span>
                    )}
                    {/* red wavy underline on the error line once graded */}
                    {line && isError && graded && (
                      <svg
                        className="absolute -bottom-1 left-0 h-1.5 w-full"
                        viewBox="0 0 100 6"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path
                          d="M0 3 Q 2.5 0 5 3 T 10 3 T 15 3 T 20 3 T 25 3 T 30 3 T 35 3 T 40 3 T 45 3 T 50 3 T 55 3 T 60 3 T 65 3 T 70 3 T 75 3 T 80 3 T 85 3 T 90 3 T 95 3 T 100 3"
                          fill="none"
                          stroke="var(--destructive)"
                          strokeWidth="1.2"
                        />
                      </svg>
                    )}
                  </code>

                  {/* per-line status marker */}
                  {line && graded && (
                    <span
                      className="ml-auto flex items-center gap-1"
                      style={{ animation: "pyide-pop 0.35s ease-out" }}
                    >
                      {isError ? (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
                          <X className="h-2.5 w-2.5" />
                          NameError
                        </span>
                      ) : (
                        <Check className="h-3.5 w-3.5 text-chart-3" />
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Teacher's correction comment — reserves space so the layout
            doesn't jump as it fades in/out each loop. */}
        <div className="mt-4 min-h-[3.75rem]">
          <div
            className="flex items-start gap-2 transition-all duration-500 ease-out"
            style={{
              opacity: commentIn ? 1 : 0,
              transform: commentIn ? "translateY(0)" : "translateY(8px)",
            }}
          >
            {/* teacher avatar */}
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chart-2 text-[10px] font-bold text-primary-foreground">
              MR
            </span>
            <div className="rounded-xl rounded-tl-sm bg-chart-2/10 px-3 py-2">
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-foreground/90">Ms. Rivera</span>
                <MessageSquare className="h-2.5 w-2.5 text-chart-2" />
                <span className="text-[9px] font-medium text-muted-foreground">on line 5</span>
              </div>
              <p className="text-[11px] leading-snug text-foreground/75">
                Typo here —{" "}
                <code className="rounded bg-destructive/15 px-1 font-mono text-destructive">siez</code>{" "}
                should be{" "}
                <code className="rounded bg-chart-3/15 px-1 font-mono text-chart-3">size</code>. Fix
                the name and re-run.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Organized — an animated class → student → file tree              */
/* ------------------------------------------------------------------ */

type TreeNode = { depth: 0 | 1 | 2; type: "class" | "student" | "file"; label: string }

// Deliberately mixes .py and .html: the tree is the clearest place to show a
// teacher that both IDEs land in the same organised place.
const TREE: TreeNode[] = [
  { depth: 0, type: "class", label: "Grade 10 · Computing" },
  { depth: 1, type: "student", label: "Ada Chen" },
  { depth: 2, type: "file", label: "variables.py" },
  { depth: 2, type: "file", label: "index.html" },
  { depth: 1, type: "student", label: "Sam Lee" },
  { depth: 2, type: "file", label: "functions.py" },
]

const INDENT = 1.5 // rem per depth level
const ROW_H = 2.1 // rem

// Precompute connector guides for each row from the flat tree.
function useGuides() {
  return useMemo(() => {
    return TREE.map((node, i) => {
      const d = node.depth
      if (d === 0) return { verticals: [] as number[], hasElbow: false, elbowHalf: false }

      // Is this the last sibling at its own depth?
      let isLast = true
      for (let j = i + 1; j < TREE.length; j++) {
        if (TREE[j].depth < d) break
        if (TREE[j].depth === d) {
          isLast = false
          break
        }
      }
      // Ancestor columns (1..d-1) that still have a following sibling → full vertical.
      const verticals: number[] = []
      for (let c = 1; c < d; c++) {
        let ancestorHasNext = false
        for (let j = i + 1; j < TREE.length; j++) {
          if (TREE[j].depth < c) break
          if (TREE[j].depth === c) {
            ancestorHasNext = true
            break
          }
        }
        if (ancestorHasNext) verticals.push(c)
      }
      return { verticals, hasElbow: true, elbowHalf: isLast }
    })
  }, [])
}

function OrganizedAnimation() {
  const guides = useGuides()
  const [step, setStep] = useState(0)
  const total = TREE.length
  const complete = step >= total

  useEffect(() => {
    if (!complete) {
      const id = setTimeout(() => setStep((s) => s + 1), 520)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setStep(0), 2600)
    return () => clearTimeout(id)
  }, [step, complete])

  const iconFor = (t: TreeNode["type"]) => {
    if (t === "class") return <Folder className="h-3.5 w-3.5 text-chart-3" />
    if (t === "student") return <User className="h-3.5 w-3.5 text-chart-2" />
    return <FileCode2 className="h-3.5 w-3.5 text-primary" />
  }

  // x-center of a gutter column c (1-based), in rem
  const colX = (c: number) => (c - 1) * INDENT + INDENT / 2

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-md [perspective:1200px]">
      <Glow className="from-chart-3/40" />

      <div className="relative px-1 transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(6deg)_scale(1.01)]">
        <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-chart-3/15 text-chart-3">
              <Folder className="h-3 w-3" />
            </span>
            Auto-filed workspace
          </span>
          {complete && (
            <span
              className="flex items-center gap-1 rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-semibold text-chart-3"
              style={{ animation: "pyide-pop 0.4s ease-out" }}
            >
              <Check className="h-3 w-3" />
              Organized
            </span>
          )}
        </div>

        <div className="flex flex-col">
          {TREE.map((node, i) => {
            const visible = i < step
            const g = guides[i]
            const pillLeft = node.depth * INDENT
            return (
              <div
                key={i}
                className="relative transition-all duration-500 ease-out"
                style={{
                  height: `${ROW_H}rem`,
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateX(0)" : "translateX(-8px)",
                }}
              >
                {/* ancestor vertical spines */}
                {g.verticals.map((c) => (
                  <span
                    key={`v-${c}`}
                    className="absolute w-px bg-chart-3/30"
                    style={{ left: `${colX(c)}rem`, top: 0, bottom: 0 }}
                  />
                ))}

                {/* elbow connector to this node */}
                {g.hasElbow && (
                  <>
                    <span
                      className="absolute w-px bg-chart-3/40"
                      style={{
                        left: `${colX(node.depth)}rem`,
                        top: 0,
                        height: g.elbowHalf ? "50%" : "100%",
                      }}
                    />
                    <span
                      className="absolute h-px bg-chart-3/40"
                      style={{
                        left: `${colX(node.depth)}rem`,
                        top: "50%",
                        width: `${pillLeft - colX(node.depth)}rem`,
                      }}
                    />
                  </>
                )}

                {/* the node pill (no border) */}
                <div
                  className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-background/60 px-2.5 py-1.5 shadow-sm"
                  style={{ left: `${pillLeft}rem` }}
                >
                  {iconFor(node.type)}
                  <span className="whitespace-nowrap text-[11px] font-medium text-foreground/85">
                    {node.label}
                  </span>
                  {node.type === "file" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-chart-3" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Schools — admin invites staff, staff add students, everyone Pro   */
/* ------------------------------------------------------------------ */

/**
 * Two teachers is the smallest cast that still reads as a department rather
 * than a single classroom, and each carries its own class code so the
 * admin → teacher → student chain is visible in one frame.
 */
const SCHOOL_STAFF = [
  { initials: "MR", name: "Ms. Rivera", code: "9B-COMP", students: ["AC", "SL"] },
  { initials: "JP", name: "Mr. Patel", code: "10A-CS", students: ["TM", "KO"] },
] as const

/** Fades a tier in from above as the roll-out reaches it. */
function Appear({
  visible,
  delay = 0,
  className = "",
  children,
}: {
  visible: boolean
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`transition-all duration-500 ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/** A short vertical run of the org chart's connector line. */
function Stem({ visible, height }: { visible: boolean; height: string }) {
  return (
    <span
      aria-hidden
      className="mx-auto block w-px bg-chart-4/40 transition-all duration-500 ease-out"
      style={{ height, opacity: visible ? 1 : 0 }}
    />
  )
}

function SchoolsAnimation() {
  const [step, setStep] = useState(0)
  const TOTAL = 6
  const done = step >= TOTAL

  useEffect(() => {
    if (!done) {
      const id = setTimeout(() => setStep((s) => s + 1), 560)
      return () => clearTimeout(id)
    }
    // Hold the finished org chart long enough to read, then run it again.
    const id = setTimeout(() => setStep(0), 3400)
    return () => clearTimeout(id)
  }, [step, done])

  const at = (n: number) => step >= n
  // Cover lands on every member at once — that is the whole point of the plan.
  const pro = at(6)

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-md [perspective:1200px]">
      <Glow className="from-chart-4/40" />

      <div className="relative px-1 transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(6deg)_scale(1.01)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-chart-4/15 text-chart-4">
              <Building2 className="h-3 w-3" />
            </span>
            Rolling out a school
          </span>
          {pro && (
            <span
              className="flex items-center gap-1 rounded-full bg-chart-4/15 px-2 py-0.5 text-[10px] font-semibold text-chart-4"
              style={{ animation: "pyide-pop 0.4s ease-out" }}
            >
              <Check className="h-3 w-3" />
              Everyone on Pro
            </span>
          )}
        </div>

        {/* Tier 0 — the school itself */}
        <Appear visible={at(1)}>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-xl bg-background/70 px-3 py-2 shadow-sm">
            <Building2 className="h-4 w-4 shrink-0 text-chart-4" />
            <span className="text-[11px] font-semibold text-foreground/85">Northwood Academy</span>
            <span className="rounded-full bg-chart-4/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-chart-4">
              School plan
            </span>
          </div>
        </Appear>

        {/* The admin's staff invite code */}
        <Stem visible={at(2)} height="0.75rem" />
        <Appear visible={at(2)}>
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-lg bg-chart-4/10 px-2.5 py-1">
            <KeyRound className="h-3 w-3 shrink-0 text-chart-4" />
            <span className="font-mono text-[10px] font-semibold text-chart-4">STAFF-7K2</span>
            <span className="text-[9px] font-medium text-muted-foreground">admin invites staff</span>
          </div>
        </Appear>

        {/* Fork from the school down into each teacher's column */}
        <div className="relative h-5" aria-hidden>
          <span
            className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-chart-4/40 transition-opacity duration-500"
            style={{ opacity: at(3) ? 1 : 0 }}
          />
          <span
            className="absolute left-1/4 right-1/4 top-2.5 h-px bg-chart-4/40 transition-opacity duration-500"
            style={{ opacity: at(3) ? 1 : 0 }}
          />
          <span
            className="absolute left-1/4 top-2.5 h-2.5 w-px bg-chart-4/40 transition-opacity duration-500"
            style={{ opacity: at(3) ? 1 : 0 }}
          />
          <span
            className="absolute right-1/4 top-2.5 h-2.5 w-px bg-chart-4/40 transition-opacity duration-500"
            style={{ opacity: at(3) ? 1 : 0 }}
          />
        </div>

        {/* Tiers 1 and 2 — teachers, then the students each one brings in */}
        <div className="grid grid-cols-2 gap-3">
          {SCHOOL_STAFF.map((staff, col) => (
            <div key={staff.initials} className="flex flex-col">
              <Appear visible={at(3)} delay={col * 110}>
                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-background/70 px-2 py-1.5 shadow-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chart-2 text-[9px] font-bold text-primary-foreground">
                    {staff.initials}
                  </span>
                  <span className="truncate text-[10px] font-semibold text-foreground/85">
                    {staff.name}
                  </span>
                  {pro && (
                    <span
                      className="rounded-full bg-chart-2/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-chart-2"
                      style={{ animation: "pyide-pop 0.35s ease-out" }}
                    >
                      Pro
                    </span>
                  )}
                </div>
              </Appear>

              {/* That teacher's own class join code */}
              <Stem visible={at(4)} height="0.6rem" />
              <Appear visible={at(4)} delay={col * 110}>
                <div className="mx-auto w-fit rounded-md bg-chart-2/10 px-2 py-0.5">
                  <span className="font-mono text-[9px] font-semibold text-chart-2">
                    {staff.code}
                  </span>
                </div>
              </Appear>

              {/* Fork down to the two students in that class */}
              <div className="relative h-4" aria-hidden>
                <span
                  className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-chart-2/40 transition-opacity duration-500"
                  style={{ opacity: at(5) ? 1 : 0 }}
                />
                <span
                  className="absolute left-1/4 right-1/4 top-2 h-px bg-chart-2/40 transition-opacity duration-500"
                  style={{ opacity: at(5) ? 1 : 0 }}
                />
                <span
                  className="absolute left-1/4 top-2 h-2 w-px bg-chart-2/40 transition-opacity duration-500"
                  style={{ opacity: at(5) ? 1 : 0 }}
                />
                <span
                  className="absolute right-1/4 top-2 h-2 w-px bg-chart-2/40 transition-opacity duration-500"
                  style={{ opacity: at(5) ? 1 : 0 }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {staff.students.map((initials, i) => (
                  <Appear key={initials} visible={at(5)} delay={col * 110 + i * 90}>
                    <div className="relative mx-auto w-fit">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                        {initials}
                      </span>
                      {/* Pro tick on each pupil, since cover is per member */}
                      {pro && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          style={{ animation: "pyide-pop 0.35s ease-out" }}
                        >
                          <Check className="h-2 w-2" />
                        </span>
                      )}
                    </div>
                  </Appear>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared soft glow (borderless depth cue)                             */
/* ------------------------------------------------------------------ */
function Glow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr to-transparent opacity-60 blur-3xl ${className}`}
    />
  )
}

export function FeatureAnimation({ id }: { id: string }) {
  if (id === "students") return <StudentAnimation />
  if (id === "teachers") return <TeacherAnimation />
  if (id === "schools") return <SchoolsAnimation />
  return <OrganizedAnimation />
}
