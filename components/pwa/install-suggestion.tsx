"use client"

import { useEffect, useState } from "react"
import { Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoIcon } from "@/components/logo"
import { installMode, installPitch, promptInstall, usePwa } from "@/lib/pwa"

const SEEN_KEY = "mcp:install-suggestion"
const DELAY_MS = 20_000

/** A one-time nudge, recorded as seen the moment it appears so it never returns. */
export function InstallSuggestion({ isTeacher }: { isTeacher: boolean }) {
  const pwa = usePwa()
  const mode = installMode(pwa)
  const isIos = pwa.platform === "ios"
  const eligible = pwa.ready && (mode === "prompt" || (mode === "instructions" && isIos))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!eligible) return
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch {
      return
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(SEEN_KEY, new Date().toISOString())
      } catch {}
      setVisible(true)
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [eligible])

  if (!visible || mode === "installed") return null

  async function handleInstall() {
    setVisible(false)
    await promptInstall()
  }

  return (
    <aside
      aria-labelledby="install-suggestion-title"
      className="fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2"
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-5">
        <LogoIcon className="size-10 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 id="install-suggestion-title" className="text-sm font-semibold">
            Make MyCodePad one click away
          </h2>
          <p className="text-sm text-muted-foreground">{installPitch(isTeacher)}</p>
          {isIos ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm">
              Tap <Share className="size-4 text-primary" aria-label="Share" /> then{" "}
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {isIos ? (
          <Button size="sm" onClick={() => setVisible(false)}>
            Got it
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => setVisible(false)}>
              Not now
            </Button>
            <Button size="sm" onClick={handleInstall}>
              Install MyCodePad
            </Button>
          </>
        )}
      </div>
    </aside>
  )
}
