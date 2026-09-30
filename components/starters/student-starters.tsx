"use client"

import { useEffect, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { PENDING_STARTERS_KEY } from "@/hooks/use-pending-starters"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, Play, Presentation, RotateCcw, Timer, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getStudentStarter,
  getStudentStarters,
  markStarterOpened,
  retakeStarter,
  saveStarterAnswer,
  startStarter,
  submitStarter,
  type StudentStarterDetail,
  type StudentStarterSummary,
} from "@/app/actions/starters"
import { QuestionView } from "@/components/starters/question-view"

export function StudentStarters({ initialOpenId = null }: { initialOpenId?: number | null }) {
  const [openId, setOpenId] = useState<number | null>(initialOpenId)
  const { data, mutate } = useSWR("student-starters", () => getStudentStarters(), { refreshInterval: 15000 })

  if (openId !== null) {
    return (
      <StarterRunner
        starterId={openId}
        onBack={() => {
          setOpenId(null)
          mutate()
        }}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-balance">Daily Starter</h1>
      <p className="mt-1 text-sm text-muted-foreground">Five quick questions to warm up for the lesson.</p>

      <section aria-labelledby="today" className="mt-6">
        <h2 id="today" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today</h2>
        <div className="mt-3 flex flex-col gap-3">
          {!data && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {data?.today.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Zap className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-3 font-medium">No starter today</p>
              <p className="mt-1 text-sm text-muted-foreground">When your teacher sets one, it appears here.</p>
            </div>
          )}
          {data?.today.map((s) => <StarterCard key={s.id} starter={s} onOpen={() => setOpenId(s.id)} highlight />)}
        </div>
      </section>

      {data && data.history.length > 0 && (
        <section aria-labelledby="history" className="mt-10">
          <h2 id="history" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Previous starters</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.history.map((s) => <StarterCard key={s.id} starter={s} onOpen={() => setOpenId(s.id)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function StarterCard({ starter: s, onOpen, highlight }: { starter: StudentStarterSummary; onOpen: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        highlight && s.status !== "submitted" ? "border-primary/40" : "border-border",
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", s.status === "submitted" ? "bg-chart-3/15 text-chart-3" : "bg-primary/10 text-primary")}>
        {s.warmupActive ? <Presentation className="h-5 w-5" /> : s.status === "submitted" ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{s.title}</span>
        <span className="block text-xs text-muted-foreground">
          {s.className} · {s.starterDate} · {s.questionCount} questions
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium">
        {s.warmupActive ? (
          <span className="text-primary">Live now</span>
        ) : s.status === "submitted" ? (
          <span className="tabular-nums">{s.score}/{s.total}</span>
        ) : s.status === "in_progress" ? (
          <span className="text-primary">Continue</span>
        ) : (
          <span className="text-primary">Start</span>
        )}
      </span>
    </button>
  )
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function StarterRunner({ starterId, onBack }: { starterId: number; onBack: () => void }) {
  const { data, mutate } = useSWR(["student-starter", starterId], () => getStudentStarter(starterId), {
    refreshInterval: (d?: StudentStarterDetail) => (d?.warmup.active && !d.result ? 2000 : 0),
  })
  const { mutate: mutatePending } = useSWRConfig()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const offsetRef = useRef(0)
  const seeded = useRef(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (!data) return
    offsetRef.current = data.serverNow - Date.now()
    if (!seeded.current || data.result) {
      setAnswers(data.answers)
      seeded.current = true
    }
  }, [data])

  useEffect(() => {
    markStarterOpened(starterId)
      .then(() => mutatePending(PENDING_STARTERS_KEY))
      .catch(() => {})
  }, [starterId, mutatePending])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const warmup = data?.warmup.active ?? false
  const deadline = data?.startedAt ? data.startedAt + data.timeLimitSeconds * 1000 : null
  const remaining = deadline ? deadline - (now + offsetRef.current) : null
  const current = warmup ? (data?.warmup.index ?? 0) : index

  async function submit() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const result = await submitStarter(starterId, answers)
      mutate(result, { revalidate: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit")
    } finally {
      setBusy(false)
      submitting.current = false
    }
  }

  useEffect(() => {
    if (!warmup && remaining !== null && remaining <= 0 && data && !data.result) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining !== null && remaining <= 0, warmup])

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const header = (
    <div className="flex items-center justify-between gap-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> All starters
      </Button>
      {!data.result && warmup && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Presentation className="h-3.5 w-3.5" /> Live warm-up · follow your teacher
        </span>
      )}
      {!data.result && !warmup && remaining !== null && (
        <span
          role="timer"
          aria-live="off"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm tabular-nums",
            remaining < 30000 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
          )}
        >
          <Clock className="h-3.5 w-3.5" /> {formatTime(remaining)}
        </span>
      )}
    </div>
  )

  const practiceNotice =
    data.isPractice && data.recordedAttempt ? (
      <p className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Practice attempt.</span> Your teacher only sees your first
        score ({data.recordedAttempt.score}/{data.recordedAttempt.total}), so this one won&apos;t change it.
      </p>
    ) : null

  if (data.result) {
    const pct = Math.round((data.result.score / Math.max(1, data.result.total)) * 100)
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        {header}
        {practiceNotice}
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{data.title}</p>
          <p className="mt-2 text-5xl font-semibold tabular-nums">
            {data.result.score}<span className="text-2xl text-muted-foreground">/{data.result.total}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {pct === 100 ? "Perfect score. Great start to the lesson." : pct >= 60 ? "Nice work. Check the explanations below." : "Good effort. Read the explanations to lock it in."}
          </p>
          {data.allowRetake && (
            <Button
              variant="outline"
              className="mt-4 bg-transparent"
              onClick={async () => {
                const r = await retakeStarter(starterId)
                seeded.current = false
                setIndex(0)
                mutate(r, { revalidate: false })
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Retake
            </Button>
          )}
        </div>
        <ol className="mt-6 flex flex-col gap-4">
          {data.result.questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-border bg-card p-5">
              <QuestionView
                question={q}
                index={i}
                value={answers[q.id]}
                disabled
                reveal={{ answer: q.answer, explanation: q.explanation, correct: data.result!.correct[q.id] }}
              />
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (!data.startedAt && !warmup) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        {header}
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center">
          <Zap className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-2xl font-semibold text-balance">{data.title}</h1>
          {data.topic && <p className="mt-1 text-sm text-muted-foreground">{data.topic}</p>}
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" /> {data.questions.length} questions · {Math.round(data.timeLimitSeconds / 60)} minutes
          </p>
          <p className="mt-2 text-sm text-muted-foreground">The timer starts when you press Start.</p>
          <Button
            className="mt-6"
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                mutate(await startStarter(starterId), { revalidate: false })
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />} Start
          </Button>
        </div>
      </div>
    )
  }

  const q = data.questions[Math.min(current, data.questions.length - 1)]
  const answeredCount = data.questions.filter((x) => (answers[x.id] ?? "").trim() !== "").length
  const isLast = current === data.questions.length - 1

  function setAnswer(value: string) {
    setAnswers((a) => ({ ...a, [q.id]: value }))
  }

  function persist(questionId: string) {
    const value = answers[questionId]
    if (value === undefined) return
    saveStarterAnswer(starterId, questionId, value).catch(() => {})
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      {header}
      {practiceNotice}

      <div className="mt-6 flex items-center gap-1.5" aria-label={`Question ${current + 1} of ${data.questions.length}`}>
        {data.questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            disabled={warmup}
            onClick={() => {
              persist(q.id)
              setIndex(i)
            }}
            aria-label={`Go to question ${i + 1}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i === current ? "bg-primary" : (answers[x.id] ?? "").trim() ? "bg-primary/40" : "bg-muted",
            )}
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <QuestionView
          key={q.id}
          question={q}
          index={current}
          value={answers[q.id]}
          onChange={(v) => {
            setAnswer(v)
            if (q.options) saveStarterAnswer(starterId, q.id, v).catch(() => {})
          }}
        />
        {warmup && data.warmup.revealed && (
          <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            Your teacher is revealing the answer. Look at the board.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {warmup ? (
          <span className="text-sm text-muted-foreground">{answeredCount}/{data.questions.length} answered</span>
        ) : (
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={current === 0}
            onClick={() => {
              persist(q.id)
              setIndex((i) => i - 1)
            }}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        )}
        {isLast || warmup ? (
          <Button onClick={submit} disabled={busy} variant={warmup && !isLast ? "outline" : "default"} className={warmup && !isLast ? "bg-transparent" : undefined}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Submit {answeredCount < data.questions.length ? `(${answeredCount}/${data.questions.length})` : ""}
          </Button>
        ) : (
          <Button
            onClick={() => {
              persist(q.id)
              setIndex((i) => i + 1)
            }}
          >
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
