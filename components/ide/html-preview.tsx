"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Monitor, Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PreviewBuild } from "@/lib/ide/html-document"

/**
 * Renders the assembled student page.
 *
 * The iframe is sandboxed WITHOUT `allow-same-origin`, which is the whole
 * security story here: student JavaScript runs in an opaque origin, so it
 * cannot reach the parent document, its cookies, or the session that owns the
 * workspace. `allow-scripts` alone is safe; adding `allow-same-origin`
 * alongside it would let a pupil script the real app, so it must stay off.
 */
export function HtmlPreview({
  build,
  /** Bumped by the workspace on each Run so the frame reloads from scratch. */
  runId,
}: {
  build: PreviewBuild | null
  runId: number
}) {
  const srcDoc = build?.document ?? null
  const [errors, setErrors] = useState<string[]>([])
  const [width, setWidth] = useState<"full" | "mobile">("full")
  const frameRef = useRef<HTMLIFrameElement>(null)

  // Errors belong to a single run; a fresh run starts with a clean slate.
  useEffect(() => {
    setErrors([])
  }, [runId])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // The frame is sandboxed to an opaque origin, so the only useful check
      // is that the message came from our own frame and carries our marker.
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.source !== "mycodepad-preview") return

      const message = String(event.data.message ?? "")
      setErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  if (!srcDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
        <Monitor className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm text-muted-foreground text-pretty">
          Create an <code className="font-mono text-xs">index.html</code> file to see your
          page here.
        </p>
      </div>
    )
  }

  // A link to a file that does not exist is the most common reason a page
  // "does nothing", and it produces no runtime error to catch, so it is
  // reported next to real script errors.
  const notices = [
    ...(build?.missing ?? []).map(
      (name) => `${name} is linked from your page but no such file exists.`,
    ),
    ...errors,
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
        <div className="flex items-center gap-0.5" role="group" aria-label="Preview width">
          <button
            type="button"
            onClick={() => setWidth("full")}
            aria-pressed={width === "full"}
            className={cn(
              "rounded p-1 transition-colors",
              width === "full"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="sr-only">Full width preview</span>
          </button>
          <button
            type="button"
            onClick={() => setWidth("mobile")}
            aria-pressed={width === "mobile"}
            className={cn(
              "rounded p-1 transition-colors",
              width === "mobile"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="sr-only">Mobile width preview</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-2">
        <iframe
          // Remounting on every run guarantees a clean document rather than a
          // frame still holding timers and listeners from the previous one.
          key={runId}
          ref={frameRef}
          title="Page preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          className={cn(
            "h-full rounded border border-border bg-white shadow-sm",
            width === "mobile" ? "w-[380px] max-w-full" : "w-full",
          )}
        />
      </div>

      {notices.length > 0 && (
        <div
          role="status"
          className="max-h-28 shrink-0 overflow-auto border-t border-destructive/30 bg-destructive/10 px-3 py-2"
        >
          {notices.map((message, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 font-mono text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="break-words">{message}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
