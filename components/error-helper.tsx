"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Lock, Sparkles, Loader2, Clock, RotateCcw } from "lucide-react"

// The student must attempt the fix themselves for this long before AI help is offered.
const HELP_DELAY_MS = 10 * 60 * 1000 // 10 minutes

type Phase = "prompt" | "counting" | "loading" | "help" | "failed"

function storageKey(fileId: number) {
  return `pyide-error-help:${fileId}`
}

type Saved = { signature: string; unlockAt: number; help?: string }

function readSaved(fileId: number): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(fileId))
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function writeSaved(fileId: number, data: Saved) {
  try {
    localStorage.setItem(storageKey(fileId), JSON.stringify(data))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export function ErrorHelper({
  error,
  code,
  fileId,
}: {
  error: string
  code: string
  fileId: number
}) {
  const [phase, setPhase] = useState<Phase>("prompt")
  const [remaining, setRemaining] = useState(HELP_DELAY_MS)
  const [help, setHelp] = useState("")

  const unlockAtRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  // Keep the latest code without retriggering the fetch callback.
  const codeRef = useRef(code)
  codeRef.current = code

  const fetchHelp = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true
    setPhase("loading")
    try {
      const res = await fetch("/api/error-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeRef.current, error }),
      })
      if (!res.ok) throw new Error("Request failed")
      const data = (await res.json()) as { help?: string; error?: string }
      if (!data.help) throw new Error(data.error || "No hint returned")
      setHelp(data.help)
      setPhase("help")
      writeSaved(fileId, {
        signature: error,
        unlockAt: unlockAtRef.current ?? Date.now(),
        help: data.help,
      })
    } catch {
      startedRef.current = false
      setPhase("failed")
    }
  }, [error, fileId])

  // On mount (and whenever the error changes), restore any in-progress timer
  // or already-delivered hint for this exact error so a refresh doesn't reset it.
  useEffect(() => {
    const saved = readSaved(fileId)
    if (saved && saved.signature === error) {
      if (saved.help) {
        setHelp(saved.help)
        setPhase("help")
        return
      }
      unlockAtRef.current = saved.unlockAt
      const left = saved.unlockAt - Date.now()
      if (left <= 0) {
        fetchHelp()
      } else {
        setRemaining(left)
        setPhase("counting")
      }
    }
  }, [error, fileId, fetchHelp])

  // Drive the countdown.
  useEffect(() => {
    if (phase !== "counting") return
    const tick = () => {
      const left = (unlockAtRef.current ?? 0) - Date.now()
      if (left <= 0) {
        fetchHelp()
      } else {
        setRemaining(left)
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [phase, fetchHelp])

  function unlock() {
    const at = Date.now() + HELP_DELAY_MS
    unlockAtRef.current = at
    setRemaining(HELP_DELAY_MS)
    setPhase("counting")
    writeSaved(fileId, { signature: error, unlockAt: at })
  }

  function retry() {
    startedRef.current = false
    fetchHelp()
  }

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const clock = `${mins}:${String(secs).padStart(2, "0")}`
  const progress = Math.min(100, Math.max(0, (1 - remaining / HELP_DELAY_MS) * 100))

  return (
    <div className="shrink-0 border-t border-border bg-card">
      <div className="max-h-64 overflow-auto p-3">
        {phase === "prompt" && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Try resolving the error yourself first</p>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Read the error above carefully and review your code. Working through it on your own
                is the best way to learn. Still stuck? You can unlock an AI hint.
              </p>
              <Button size="sm" className="mt-3" onClick={unlock}>
                <Lock className="mr-1.5 h-4 w-4" />
                Unlock AI help
              </Button>
            </div>
          </div>
        )}

        {phase === "counting" && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                AI help unlocks in <span className="tabular-nums text-primary">{clock}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Keep experimenting while you wait — you might crack it yourself! The hint will appear
                here automatically when the timer ends.
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
            <p className="text-sm text-muted-foreground">Preparing a hint for your error...</p>
          </div>
        )}

        {phase === "help" && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">AI hint</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground text-pretty">
                {help}
              </p>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Couldn&apos;t load a hint</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Something went wrong while generating help.
              </p>
              <Button size="sm" variant="outline" className="mt-3 bg-transparent" onClick={retry}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
