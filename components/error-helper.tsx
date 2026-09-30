"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Lock, Sparkles, Loader2, Clock, RotateCcw, ShieldOff } from "lucide-react"
import { getAiHelpState, requestAiHelpUnlock, type AiHelpState } from "@/app/actions/ai-help"

type Phase = "prompt" | "counting" | "loading" | "help" | "failed"

function hintKey(fileId: number) {
  return `pyide-error-hint:${fileId}`
}

// Only the delivered hint text is cached locally, to avoid paying for the same
// hint twice. The unlock timing always comes from the server.
function readHint(fileId: number, error: string) {
  try {
    const raw = localStorage.getItem(hintKey(fileId))
    const saved = raw ? (JSON.parse(raw) as { error: string; help: string }) : null
    return saved && saved.error === error ? saved.help : null
  } catch {
    return null
  }
}

function writeHint(fileId: number, error: string, help: string) {
  try {
    localStorage.setItem(hintKey(fileId), JSON.stringify({ error, help }))
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
  const { data: policy, mutate } = useSWR<AiHelpState>(
    ["ai-help", fileId, error],
    () => getAiHelpState(fileId, error),
    // Re-check so a teacher toggling the class setting takes effect quickly.
    { refreshInterval: 20000, revalidateOnFocus: true },
  )

  const [phase, setPhase] = useState<Phase>("prompt")
  const [help, setHelp] = useState("")
  const [now, setNow] = useState(() => Date.now())
  // Difference between server and client clocks, so the countdown is accurate.
  const skewRef = useRef(0)
  const startedRef = useRef(false)
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
        body: JSON.stringify({ code: codeRef.current, error, fileId }),
      })
      const data = (await res.json().catch(() => ({}))) as { help?: string; error?: string }
      if (!res.ok || !data.help) throw new Error(data.error || "No hint returned")
      setHelp(data.help)
      setPhase("help")
      writeHint(fileId, error, data.help)
    } catch {
      startedRef.current = false
      setPhase("failed")
      mutate()
    }
  }, [error, fileId, mutate])

  useEffect(() => {
    const cached = readHint(fileId, error)
    if (cached) {
      setHelp(cached)
      setPhase("help")
    }
  }, [fileId, error])

  // Sync phase with the server policy.
  useEffect(() => {
    if (!policy || phase === "help" || phase === "loading") return
    skewRef.current = policy.serverNow - Date.now()
    if (policy.enabled && policy.unlockAt !== null) setPhase("counting")
  }, [policy, phase])

  useEffect(() => {
    if (phase !== "counting" || !policy?.unlockAt) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (policy.unlockAt! - (t + skewRef.current) <= 0) fetchHelp()
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [phase, policy, fetchHelp])

  async function unlock() {
    const next = await requestAiHelpUnlock(fileId, error)
    await mutate(next, { revalidate: false })
  }

  function retry() {
    startedRef.current = false
    fetchHelp()
  }

  const disabled = policy && !policy.enabled && phase !== "help"
  const delayMs = (policy?.delayMinutes ?? 10) * 60000
  const remaining = policy?.unlockAt ? Math.max(0, policy.unlockAt - (now + skewRef.current)) : delayMs
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const clock = `${mins}:${String(secs).padStart(2, "0")}`
  const progress = delayMs === 0 ? 100 : Math.min(100, Math.max(0, (1 - remaining / delayMs) * 100))

  return (
    <div className="shrink-0 border-t border-border bg-card">
      <div className="max-h-64 overflow-auto p-3">
        {disabled ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldOff className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">AI Help is off for this class</p>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Your teacher has turned off AI Help. Read the error carefully, check the line it
                points to, and ask your teacher if you are still stuck.
              </p>
            </div>
          </div>
        ) : (
          <>
            {phase === "prompt" && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Try resolving the error yourself first</p>
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">
                    Read the error above carefully and review your code. Still stuck? Unlock an AI
                    hint
                    {policy && policy.delayMinutes > 0
                      ? ` — it becomes available ${policy.delayMinutes} minute${policy.delayMinutes === 1 ? "" : "s"} after you ask.`
                      : "."}
                  </p>
                  <Button size="sm" className="mt-3" onClick={unlock} disabled={!policy}>
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
                    Keep experimenting while you wait. The hint appears here automatically when the
                    timer ends.
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
          </>
        )}
      </div>
    </div>
  )
}
