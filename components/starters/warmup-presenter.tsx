"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Maximize2, Play, Square, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getWarmupData, setWarmupState } from "@/app/actions/starters"
import { QuestionView } from "@/components/starters/question-view"

export function WarmupPresenter({ starterId }: { starterId: number }) {
  const { data, mutate } = useSWR(["warmup", starterId], () => getWarmupData(starterId), { refreshInterval: 2000 })

  async function update(state: Parameters<typeof setWarmupState>[1]) {
    await setWarmupState(starterId, state)
    mutate()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!data?.starter.warmupActive) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "ArrowRight") update({ index: data.starter.warmupIndex + 1 })
      if (e.key === "ArrowLeft") update({ index: data.starter.warmupIndex - 1 })
      if (e.key === " ") {
        e.preventDefault()
        update({ revealed: !data.starter.warmupRevealed })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const { starter, aggregate, enrolled } = data
  const total = starter.questions.length
  const idx = Math.min(starter.warmupIndex, total - 1)
  const q = starter.questions[idx]
  const stats = aggregate[idx]
  const revealed = starter.warmupRevealed

  if (!starter.warmupActive) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Classroom warm-up</p>
        <h1 className="max-w-3xl text-4xl font-semibold text-balance md:text-6xl">{starter.title}</h1>
        <p className="text-lg text-muted-foreground">
          {total} questions · Students join from their Daily Starter page
        </p>
        <Button size="lg" onClick={() => update({ active: true, index: 0 })}>
          <Play className="mr-2 h-5 w-5" /> Start warm-up
        </Button>
        <p className="text-sm text-muted-foreground">
          Only class totals are shown on screen. Student names never appear.
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 md:px-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Warm-up</p>
          <h1 className="text-lg font-semibold">{starter.title}</h1>
        </div>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-2 text-lg tabular-nums text-muted-foreground">
            <Users className="h-5 w-5" /> {stats.answered}/{enrolled} answered
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {idx + 1} / {total}
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10 md:px-16">
        <div className="w-full max-w-5xl">
          <QuestionView
            key={q.id}
            question={q}
            index={idx}
            disabled
            large
            counts={revealed && q.options ? stats.optionCounts : undefined}
            reveal={revealed ? { answer: q.answer, explanation: q.explanation } : undefined}
          />
          {revealed && stats.answered > 0 && (
            <p className="mt-6 text-center text-2xl font-semibold tabular-nums">
              {Math.round((stats.correct / stats.answered) * 100)}% of the class got it right
            </p>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 md:px-10">
        <Button variant="ghost" onClick={() => update({ active: false })}>
          <Square className="mr-2 h-4 w-4" /> End warm-up
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" className="bg-transparent" disabled={idx === 0} onClick={() => update({ index: idx - 1 })}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Previous
          </Button>
          <Button variant={revealed ? "outline" : "default"} size="lg" className={revealed ? "bg-transparent" : undefined} onClick={() => update({ revealed: !revealed })}>
            {revealed ? <EyeOff className="mr-2 h-5 w-5" /> : <Eye className="mr-2 h-5 w-5" />}
            {revealed ? "Hide answer" : "Reveal answer"}
          </Button>
          <Button variant="outline" size="lg" className="bg-transparent" disabled={idx === total - 1} onClick={() => update({ index: idx + 1 })}>
            Next <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
        </Button>
      </footer>
    </main>
  )
}
