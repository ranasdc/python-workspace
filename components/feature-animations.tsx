"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Check, FileCode2, Folder, User, Pencil, Save, Sparkles, X } from "lucide-react"

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

const STUDENT_CODE: Token[][] = [
  [{ t: "name ", c: "" }, { t: "=", c: "kw" }, { t: " ", c: "" }, { t: '"Ada"', c: "str" }],
  [{ t: "for", c: "kw" }, { t: " i ", c: "" }, { t: "in", c: "kw" }, { t: " range(", c: "" }, { t: "3", c: "num" }, { t: "):", c: "" }],
  [{ t: "    print", c: "fn" }, { t: "(", c: "" }, { t: '"Hi"', c: "str" }, { t: ", name)", c: "" }],
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

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-md [perspective:1200px]">
      <Glow className="from-primary/40" />

      {/* Laptop lid / screen */}
      <div className="relative rounded-2xl bg-[oklch(0.16_0.02_260)] p-2 shadow-2xl transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(6deg)_scale(1.02)]">
        {/* camera dot */}
        <div className="mx-auto mb-1 h-1 w-1 rounded-full bg-white/25" />

        <div className="overflow-hidden rounded-xl bg-[oklch(0.13_0.02_260)]">
          {/* window title bar */}
          <div className="flex items-center justify-between bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive/70" />
              <span className="h-2 w-2 rounded-full bg-chart-4/70" />
              <span className="h-2 w-2 rounded-full bg-chart-3/70" />
            </div>
            <span className="font-mono text-[10px] text-white/40">main.py</span>
            {/* autosave indicator */}
            <span
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                saved ? "text-chart-3" : "text-primary"
              }`}
            >
              {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3 animate-pulse" />}
              {saved ? "Saved" : "Saving"}
            </span>
          </div>

          {/* editor body */}
          <div className="min-h-[8.5rem] px-3 py-3">
            <div className="flex flex-col gap-1">
              {STUDENT_CODE.map((line, i) => {
                const done = i < lineIndex
                const isActive = i === lineIndex
                const plain = plainOf(line)
                return (
                  <div key={i} className="flex h-5 items-center gap-3">
                    <span className="w-3 select-none text-right font-mono text-[10px] text-white/25">
                      {i + 1}
                    </span>
                    <code className="whitespace-pre font-mono text-[11px] leading-none sm:text-xs">
                      {done ? (
                        line.map((tok, j) => (
                          <span key={j} className={tok.c ? TOKEN_CLASS[tok.c] : "text-white/80"}>
                            {tok.t}
                          </span>
                        ))
                      ) : isActive ? (
                        <>
                          <span className="text-white/80">{plain.slice(0, charCount)}</span>
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
        </div>
      </div>

      {/* Laptop base / hinge */}
      <div className="relative mx-auto mt-1 h-3">
        <div
          className="absolute left-1/2 top-0 h-3 w-[112%] -translate-x-1/2 rounded-b-xl rounded-t-sm bg-gradient-to-b from-white/15 to-white/5"
          style={{ clipPath: "polygon(2% 0, 98% 0, 100% 100%, 0 100%)" }}
        />
        <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-white/10" />
      </div>

      {/* floating "keystroke" spark */}
      <div
        className="absolute -right-1 top-8 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg"
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
  [{ t: "def", c: "kw" }, { t: " area", c: "fn" }, { t: "(w, h):", c: "" }],
  [{ t: "    return", c: "kw" }, { t: " w ", c: "" }, { t: "*", c: "kw" }, { t: " h", c: "" }],
  null, // blank line
  [{ t: "size ", c: "" }, { t: "=", c: "kw" }, { t: " area(", c: "" }, { t: "5", c: "num" }, { t: ", ", c: "" }, { t: "4", c: "num" }, { t: ")", c: "" }],
  [{ t: "print", c: "fn" }, { t: "(siez)", c: "" }], // typo -> error line
]
const ERROR_LINE = 4

function TeacherAnimation() {
  // marked = how many lines have been graded so far (0..len)
  const [marked, setMarked] = useState(0)
  const total = TEACHER_CODE.length
  const done = marked >= total

  useEffect(() => {
    if (!done) {
      const id = setTimeout(() => setMarked((m) => m + 1), 620)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setMarked(0), 2400)
    return () => clearTimeout(id)
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
          {done && (
            <span
              className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"
              style={{ animation: "pyide-pop 0.4s ease-out" }}
            >
              1 issue found
            </span>
          )}
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
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Organized — an animated class → student → file tree              */
/* ------------------------------------------------------------------ */

type TreeNode = { depth: 0 | 1 | 2; type: "class" | "student" | "file"; label: string }

const TREE: TreeNode[] = [
  { depth: 0, type: "class", label: "Grade 10 · Python" },
  { depth: 1, type: "student", label: "Ada Chen" },
  { depth: 2, type: "file", label: "variables.py" },
  { depth: 2, type: "file", label: "loops.py" },
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
  return <OrganizedAnimation />
}
