"use client"

import { useEffect, useState } from "react"
import { Check, GraduationCap, User, Sparkles } from "lucide-react"

/* ------------------------------------------------------------------ *
 * Hero animation: a student types Python, the file flies across a     *
 * connector to the teacher, who scans and approves it — then loops.   *
 * Pure CSS/React, no data fetching. Themed with the app tokens.       *
 * ------------------------------------------------------------------ */

type Token = { t: string; c?: "kw" | "fn" | "str" | "num" }

// Each line is a list of colored tokens. Empty array = blank line.
const CODE: Token[][] = [
  [{ t: "def", c: "kw" }, { t: " total", c: "fn" }, { t: "(scores):" }],
  [{ t: "    return", c: "kw" }, { t: " sum(scores) " }, { t: "/", c: "kw" }, { t: " len(scores)" }],
  [],
  [{ t: "avg " }, { t: "=", c: "kw" }, { t: " total([", c: "" }, { t: "88", c: "num" }, { t: ", " }, { t: "92", c: "num" }, { t: ", " }, { t: "79", c: "num" }, { t: "])" }],
  [{ t: "print", c: "fn" }, { t: "(" }, { t: '"Average:"', c: "str" }, { t: ", avg)" }],
]

const TOKEN_CLASS: Record<NonNullable<Token["c"]>, string> = {
  kw: "text-primary font-medium",
  fn: "text-chart-2",
  str: "text-chart-3",
  num: "text-accent-foreground",
}

const plainOf = (line: Token[]) => line.map((t) => t.t).join("")

type Phase = "typing" | "sending" | "reviewing" | "approved"

export function CodeTransferAnimation() {
  const [phase, setPhase] = useState<Phase>("typing")
  const [lineIndex, setLineIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [packetAtEnd, setPacketAtEnd] = useState(false)

  // Typewriter: advance char-by-char, then line-by-line, then hand off.
  useEffect(() => {
    if (phase !== "typing") return
    const active = CODE[lineIndex]
    const plain = plainOf(active)

    if (charCount < plain.length) {
      const id = setTimeout(() => setCharCount((c) => c + 1), 42)
      return () => clearTimeout(id)
    }
    if (lineIndex < CODE.length - 1) {
      const id = setTimeout(
        () => {
          setLineIndex((i) => i + 1)
          setCharCount(0)
        },
        plain.length ? 240 : 90,
      )
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setPhase("sending"), 700)
    return () => clearTimeout(id)
  }, [phase, lineIndex, charCount])

  // Non-typing phase timeline.
  useEffect(() => {
    if (phase === "sending") {
      const id = setTimeout(() => setPhase("reviewing"), 1500)
      return () => clearTimeout(id)
    }
    if (phase === "reviewing") {
      const id = setTimeout(() => setPhase("approved"), 1400)
      return () => clearTimeout(id)
    }
    if (phase === "approved") {
      const id = setTimeout(() => {
        setLineIndex(0)
        setCharCount(0)
        setPhase("typing")
      }, 2100)
      return () => clearTimeout(id)
    }
  }, [phase])

  // Drive the packet position (rAF so the transition animates from start).
  useEffect(() => {
    if (phase === "sending") {
      const id = requestAnimationFrame(() => setPacketAtEnd(true))
      return () => cancelAnimationFrame(id)
    }
    setPacketAtEnd(false)
  }, [phase])

  const received = phase === "reviewing" || phase === "approved"
  const scanning = phase === "reviewing"
  const approved = phase === "approved"

  const status: Record<Phase, string> = {
    typing: "Student is writing code…",
    sending: "Submitting to teacher…",
    reviewing: "Teacher is reviewing…",
    approved: "Approved — great job!",
  }

  function renderCode(fullyTyped: boolean) {
    return (
      <div className="flex flex-col gap-0.5">
        {CODE.map((line, i) => {
          const done = fullyTyped || i < lineIndex
          const isActive = !fullyTyped && i === lineIndex
          const plain = plainOf(line)
          return (
            <div key={i} className="flex h-5 items-center gap-3">
              <span className="w-4 select-none text-right text-[10px] text-muted-foreground/50">
                {i + 1}
              </span>
              <code className="whitespace-pre font-mono text-[11px] leading-none sm:text-xs">
                {done ? (
                  line.map((tok, j) => (
                    <span key={j} className={tok.c ? TOKEN_CLASS[tok.c] : "text-foreground/85"}>
                      {tok.t}
                    </span>
                  ))
                ) : isActive ? (
                  <>
                    <span className="text-foreground/85">{plain.slice(0, charCount)}</span>
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
    )
  }

  return (
    <div className="pyide-anim group relative mx-auto w-full max-w-4xl [perspective:1400px]">
      {/* soft glow behind the whole scene */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(40% 60% at 20% 40%, color-mix(in oklch, var(--primary) 30%, transparent), transparent), radial-gradient(40% 60% at 80% 60%, color-mix(in oklch, var(--chart-3) 30%, transparent), transparent)",
        }}
      />

      <div className="flex items-stretch gap-2 rounded-2xl border border-white/20 bg-card/50 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-transform duration-500 ease-out will-change-transform group-hover:[transform:rotateX(3deg)_scale(1.01)] sm:gap-3 sm:p-5">
        {/* ---------- Student panel ---------- */}
        <Panel
          role="Student"
          Icon={User}
          accentVar="--primary"
          active={phase === "typing"}
          activeLabel="typing"
        >
          {renderCode(false)}
        </Panel>

        {/* ---------- Connector ---------- */}
        <div className="relative w-16 shrink-0 sm:w-28">
          <svg
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="color-mix(in oklch, var(--primary) 45%, transparent)"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              style={phase === "sending" ? { animation: "pyide-dash 0.5s linear infinite" } : undefined}
              opacity={phase === "sending" ? 1 : 0.35}
            />
          </svg>

          {/* Traveling code packet */}
          <div
            className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-primary/40 bg-primary text-primary-foreground shadow-lg ${
              phase === "sending" ? "duration-[1450ms]" : "duration-0"
            } transition-[left,opacity] ease-in-out`}
            style={{
              left: packetAtEnd ? "calc(100% - 1.75rem)" : "0px",
              opacity: phase === "sending" ? 1 : 0,
            }}
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* ---------- Teacher panel ---------- */}
        <Panel
          role="Teacher"
          Icon={GraduationCap}
          accentVar="--chart-3"
          active={received}
          activeLabel={approved ? "approved" : "reviewing"}
        >
          <div className="relative">
            {received ? (
              renderCode(true)
            ) : (
              // Waiting skeleton before the file arrives.
              <div className="flex flex-col gap-1.5 py-1">
                {[70, 90, 40, 80, 60].map((w, i) => (
                  <div
                    key={i}
                    className="h-2.5 animate-pulse rounded bg-muted-foreground/15"
                    style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}

            {/* Scan bar */}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded">
                <div
                  className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-chart-3/30 to-transparent"
                  style={{ animation: "pyide-scan 1.4s ease-in-out" }}
                />
              </div>
            )}

            {/* Approved badge */}
            {approved && (
              <div
                className="absolute -right-1 -top-1 flex items-center gap-1 rounded-full bg-chart-3 px-2 py-1 text-[10px] font-semibold text-background shadow-lg"
                style={{ animation: "pyide-pop 0.5s ease-out" }}
              >
                <Check className="h-3 w-3" />
                Approved
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Status line */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${approved ? "bg-chart-3" : "bg-primary"}`}
          style={{ animation: "pyide-caret 1.1s ease-in-out infinite" }}
        />
        <span className="tabular-nums">{status[phase]}</span>
      </div>
    </div>
  )
}

/* A single labelled editor-style panel. */
function Panel({
  role,
  Icon,
  accentVar,
  active,
  activeLabel,
  children,
}: {
  role: string
  Icon: React.ComponentType<{ className?: string }>
  accentVar: string
  active: boolean
  activeLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/60">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md"
            style={{
              backgroundColor: `color-mix(in oklch, var(${accentVar}) 18%, transparent)`,
              color: `var(${accentVar})`,
            }}
          >
            <Icon className="h-3 w-3" />
          </span>
          <span className="text-[11px] font-medium">{role}</span>
        </div>
        <span
          className={`flex items-center gap-1 text-[10px] transition-opacity duration-300 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          style={{ color: `var(${accentVar})` }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: `var(${accentVar})` }}
          />
          {activeLabel}
        </span>
      </div>
      {/* Body */}
      <div className="min-h-[9.5rem] flex-1 px-3 py-3">{children}</div>
    </div>
  )
}
