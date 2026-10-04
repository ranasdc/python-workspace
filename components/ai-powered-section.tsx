"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  FileCode2,
  GraduationCap,
  Lightbulb,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  Timer,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react"
import { Reveal } from "@/components/reveal"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/** Steps through `durations` in a loop. With reduced motion, holds on `restPhase`. */
function usePhase(durations: number[], restPhase: number) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reduced) return
    const id = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase])
    return () => clearTimeout(id)
  }, [phase, reduced, durations])
  return reduced ? restPhase : phase
}

/* Shared product-window frame, matching the IDE's card styling. */
function Window({
  icon: Icon,
  title,
  meta,
  accent,
  children,
}: {
  icon: React.ElementType
  title: string
  meta?: React.ReactNode
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-60 blur-3xl"
        style={{ background: `radial-gradient(closest-side, color-mix(in oklch, var(--${accent}) 22%, transparent), transparent)` }}
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-xl shadow-black/5 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ backgroundColor: `color-mix(in oklch, var(--${accent}) 15%, transparent)`, color: `var(--${accent})` }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            {title}
          </span>
          {meta && <span className="text-[11px] text-muted-foreground">{meta}</span>}
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1. Daily Starter                                                    */
/* ------------------------------------------------------------------ */

const STARTER_QUESTIONS = [
  {
    kind: "Predict the output",
    code: ["x = 10", "y = 2", "", "print(x / y)"],
    prompt: "What will the program output?",
    options: ["2", "5.0", "8", "20"],
    answer: 1,
  },
  {
    kind: "Spot the bug",
    code: ["for i in range(3)", "    print(i)"],
    prompt: "Which line contains the error?",
    options: ["Line 1", "Line 2", "Neither", "Both"],
    answer: 0,
  },
  {
    kind: "Fill the blank",
    code: ["age = int(input())", "___ age >= 18:", '    print("Adult")'],
    prompt: "Which keyword completes line 2?",
    options: ["for", "if", "while", "def"],
    answer: 1,
  },
] as const

function DailyStarterMock() {
  // phases per question: 0 reading, 1 selected + correct
  const phase = usePhase([1800, 2200, 1800, 2200, 1800, 2200], 1)
  const qIndex = Math.floor(phase / 2)
  const answered = phase % 2 === 1
  const q = STARTER_QUESTIONS[qIndex]
  const questionNumber = qIndex + 2

  return (
    <Window icon={Zap} title="Daily Starter" accent="primary" meta={<span className="flex items-center gap-1"><Timer className="h-3 w-3" /> 5 min</span>}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">Question {questionNumber} of 5</span>
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < questionNumber - 1 || (i === questionNumber - 1 && answered)
                  ? "w-4 bg-primary"
                  : i === questionNumber - 1
                    ? "w-4 bg-primary/40"
                    : "w-1.5 bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      </div>

      <div key={qIndex} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <span className="mt-4 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {q.kind}
        </span>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/60 px-3 py-2.5 font-mono text-xs leading-relaxed">
          {q.code.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-3 select-none text-right text-muted-foreground/50">{i + 1}</span>
              <span className="text-foreground/85">{line || " "}</span>
            </div>
          ))}
        </pre>
        <p className="mt-3 text-sm font-medium">{q.prompt}</p>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {q.options.map((opt, i) => {
            const correct = answered && i === q.answer
            return (
              <li
                key={opt}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-colors duration-300 ${
                  correct ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/80"
                }`}
              >
                {correct ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                {opt}
              </li>
            )
          })}
        </ul>
      </div>
    </Window>
  )
}

/* ------------------------------------------------------------------ */
/* 2. AI Help (teacher-controlled unlock)                              */
/* ------------------------------------------------------------------ */

function AiHelpMock() {
  // 0-3 locked countdown ticks, 4 available, 5 hint shown
  const phase = usePhase([1000, 1000, 1000, 1000, 1800, 3600], 5)
  const locked = phase < 4
  const seconds = 452 - phase
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

  return (
    <Window icon={FileCode2} title="area.py" accent="chart-2" meta="Year 9 · Python">
      <pre className="rounded-lg bg-muted/60 px-3 py-2.5 font-mono text-xs leading-relaxed">
        <div className="flex gap-3"><span className="w-3 text-right text-muted-foreground/50">1</span><span><span className="text-primary">size</span> = 5 * 4</span></div>
        <div className="flex gap-3"><span className="w-3 text-right text-muted-foreground/50">2</span><span>print(siez)</span></div>
      </pre>
      <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-[11px] text-destructive">
        {"NameError: name 'siez' is not defined"}
      </div>

      <div className="mt-3 rounded-xl border border-border p-3.5">
        {locked ? (
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-sm font-medium">
                AI Help
                <span className="font-mono text-xs tabular-nums text-muted-foreground">Available in {clock}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Try solving it yourself first.</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-chart-2">
                <Sparkles className="h-4 w-4" /> AI Help available
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  phase === 5 ? "bg-muted text-muted-foreground" : "bg-chart-2 text-primary-foreground"
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" /> Get a hint
              </span>
            </div>
            {phase === 5 && (
              <p className="mt-3 animate-in fade-in slide-in-from-bottom-1 border-l-2 border-chart-2 pl-3 text-xs leading-relaxed text-foreground/85 duration-500">
                Python can&apos;t find a variable called <code className="font-mono">siez</code>. Compare the name on line 2
                with the one you created on line 1 — is the spelling the same?
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">Teacher settings</span>
        <span className="rounded-full border border-border px-2 py-0.5">AI Help: On</span>
        <span className="rounded-full border border-border px-2 py-0.5">Unlocks after 10 min</span>
      </div>
    </Window>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Teacher task creation                                            */
/* ------------------------------------------------------------------ */

const TASK_FIELDS = [
  ["Topic", "Selection"],
  ["Difficulty", "Medium"],
  ["Year group", "Year 9"],
  ["Learning objective", "Use IF / ELSE statements"],
] as const

function TaskGeneratorMock() {
  // 0 form, 1 generating, 2 draft
  const phase = usePhase([2400, 1400, 4200], 2)

  return (
    <Window icon={Wand2} title="Create task" accent="chart-2" meta="age_check.py">
      {phase < 2 ? (
        <div className="animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-2.5">
            {TASK_FIELDS.map(([label, value]) => (
              <div key={label} className={label === "Learning objective" ? "col-span-2" : ""}>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              {phase === 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {phase === 1 ? "Generating draft…" : "Generate with AI"}
            </span>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chart-3">
              Draft · review before assigning
            </span>
          </div>
          <h4 className="mt-3 text-sm font-semibold">Python Selection Challenge</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Write a program that asks the user for their age and tells them whether they are old enough to
            learn to drive.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {["Use IF / ELSE", "Ask for input", "Display an appropriate message"].map((c) => (
              <li key={c} className="flex items-center gap-2 text-xs">
                <Check className="h-3.5 w-3.5 text-primary" /> {c}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium">
              <Pencil className="h-3.5 w-3.5" /> Edit task
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              <FileCode2 className="h-3.5 w-3.5" /> Save to file
            </span>
          </div>
        </div>
      )}
    </Window>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Class results                                                    */
/* ------------------------------------------------------------------ */

const RESULT_STATES = [
  { completed: 19, inProgress: 6, notStarted: 3, average: 76, perQuestion: [92, 84, 51, 80, 71] },
  { completed: 24, inProgress: 3, notStarted: 1, average: 78, perQuestion: [93, 86, 48, 82, 76] },
] as const

function ClassResultsMock() {
  const phase = usePhase([2600, 4000], 1)
  const r = RESULT_STATES[phase]
  const scores: readonly number[] = r.perQuestion
  const hardest = scores.indexOf(Math.min(...scores))

  return (
    <Window icon={BarChart3} title="Year 9 · Daily Starter" accent="chart-3" meta={<span className="flex items-center gap-1"><Users className="h-3 w-3" /> 28 students</span>}>
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: CheckCircle2, label: "Completed", value: r.completed, cls: "text-primary" },
          { icon: CircleDashed, label: "In progress", value: r.inProgress, cls: "text-chart-3" },
          { icon: Circle, label: "Not started", value: r.notStarted, cls: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border px-2.5 py-2">
            <s.icon className={`h-3.5 w-3.5 ${s.cls}`} />
            <p className="mt-1 text-lg font-semibold tabular-nums transition-all">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="font-medium">Correct answers by question</span>
        <span className="text-muted-foreground">
          Class average <span className="font-semibold tabular-nums text-foreground">{r.average}%</span>
        </span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {r.perQuestion.map((pct, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[11px]">
            <span className="w-5 text-muted-foreground">Q{i + 1}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={`block h-full rounded-full transition-[width] duration-700 ease-out ${i === hardest ? "bg-destructive/70" : "bg-primary/70"}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{pct}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 rounded-md bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
        <X className="h-3 w-3" /> Most missed: Question {hardest + 1} — worth revisiting in class
      </p>
    </Window>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const features = [
  {
    eyebrow: "Daily Starters",
    accent: "primary",
    icon: Zap,
    title: "5-minute coding warm-ups, generated for the class",
    desc: "Generate a short Computer Science starter for your class in one click. Every student in the class gets the same starter, while their answers and progress stay individual.",
    points: ["Predict the output, spot the bug, fill the blank and more", "Mixed difficulty, age-appropriate questions", "Only a student's first attempt counts — retakes are practice"],
    Mock: DailyStarterMock,
  },
  {
    eyebrow: "AI Help",
    accent: "chart-2",
    icon: Lightbulb,
    title: "AI Help, when students need it",
    desc: "When code throws an error, AI Help explains what went wrong and nudges students towards the fix — a hint, not the answer.",
    points: ["Turn AI Help on or off for each class", "Unlock it only after students have had a go", "Choose how long students try first"],
    Mock: AiHelpMock,
  },
  {
    eyebrow: "Task creation",
    accent: "chart-2",
    icon: Wand2,
    title: "Create coding tasks with AI",
    desc: "Describe the topic, difficulty, year group and learning objective. AI drafts the task — you review it, edit anything, and decide when it reaches students.",
    points: ["Created straight from the IDE", "Always a draft until you save it", "Success criteria included"],
    Mock: TaskGeneratorMock,
  },
  {
    eyebrow: "Built for teachers",
    accent: "chart-3",
    icon: GraduationCap,
    title: "See what your class finds difficult",
    desc: "Starter results arrive as students finish. See who has completed, who is still working, and which questions the class found hardest.",
    points: ["Live completion status", "Class average from first attempts", "Question-by-question breakdown"],
    Mock: ClassResultsMock,
  },
] as const

const flow = [
  { who: "Teacher", steps: ["Create with AI", "Review", "Assign"] },
  { who: "Student", steps: ["Practise", "Get help when ready", "Build understanding"] },
  { who: "Class", steps: ["Same starter", "Individual answers", "Teacher sees results"] },
] as const

export function AiPoweredSection() {
  return (
    <section id="ai" aria-labelledby="ai-heading" className="scroll-mt-24 border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI powered
          </span>
          <h2 id="ai-heading" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Smarter tools for teaching and learning.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            MyCodePad uses AI to give students meaningful coding practice and give teachers and
            tutors the tools to create, support and understand learning — without getting in the
            way.
          </p>
        </Reveal>

        <Reveal delay={100} className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
          {flow.map((f) => (
            <div key={f.who} className="rounded-xl border border-border bg-card/50 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{f.who}</p>
              <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                {f.steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden className="text-muted-foreground/60">→</span>}
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </Reveal>

        <div className="mt-16 flex flex-col gap-20 sm:mt-24 sm:gap-28">
          {features.map((f, i) => {
            const flipped = i % 2 === 1
            const Icon = f.icon
            return (
              <div key={f.title} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
                <Reveal className={flipped ? "md:order-2" : ""}>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `color-mix(in oklch, var(--${f.accent}) 15%, transparent)`,
                      color: `var(--${f.accent})`,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {f.eyebrow}
                  </span>
                  <h3 className="mt-4 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    {f.title}
                  </h3>
                  <p className="mt-4 text-pretty text-lg text-muted-foreground">{f.desc}</p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={120} className={flipped ? "md:order-1" : ""}>
                  <f.Mock />
                </Reveal>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
