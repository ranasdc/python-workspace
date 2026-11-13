"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
} from "lucide-react"

import { IdeOutputControls } from "@/components/ide/ide-split"
import { ScreenshotButton } from "@/components/ide/screenshot-button"
import { cn } from "@/lib/utils"
import type { PreviewBuild } from "@/lib/ide/html-document"
import {
  pageImage,
  parsePageSnapshot,
  screenshotFileName,
  type PageSnapshot,
} from "@/lib/ide/screenshot"

type Device = "desktop" | "mobile"

type PendingCapture = {
  id: string
  resolve: (snapshot: PageSnapshot) => void
  reject: (error: Error) => void
}

/** Longer than the frame's own allowance for inlining pictures. */
const CAPTURE_TIMEOUT_MS = 8000

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
  fileName,
}: {
  build: PreviewBuild | null
  runId: number
  /** The open file, which a screenshot of the page is named after. */
  fileName?: string
}) {
  const srcDoc = build?.document ?? null
  const [errors, setErrors] = useState<string[]>([])
  const [device, setDevice] = useState<Device>("desktop")
  const [expanded, setExpanded] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pendingCapture = useRef<PendingCapture | null>(null)

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

      if (event.data.type === "capture") {
        const pending = pendingCapture.current
        // Only the answer to the request in flight is acted on: the page's own
        // scripts share this channel and could post a reply nobody asked for.
        if (!pending || pending.id !== event.data.id) return
        pendingCapture.current = null

        const snapshot = event.data.error ? null : parsePageSnapshot(event.data)
        if (snapshot) pending.resolve(snapshot)
        else pending.reject(new Error("The page could not be captured."))
        return
      }

      const message = String(event.data.message ?? "")
      setErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // The frame is sandboxed to its own origin, so the page cannot be read from
  // here. It is asked to describe itself, and the reply is drawn as an image.
  async function capturePage() {
    const frame = frameRef.current?.contentWindow
    if (!frame) throw new Error("There is no page to capture yet.")

    const snapshot = await new Promise<PageSnapshot>((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const timer = window.setTimeout(() => {
        if (pendingCapture.current?.id === id) pendingCapture.current = null
        reject(new Error("The page did not respond. Run it again and retry."))
      }, CAPTURE_TIMEOUT_MS)

      pendingCapture.current = {
        id,
        resolve: (value) => {
          window.clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          window.clearTimeout(timer)
          reject(error)
        },
      }
      // The frame's origin is opaque, so there is no origin to address it by.
      frame.postMessage({ source: "mycodepad-host", type: "capture", id }, "*")
    })

    return pageImage(snapshot)
  }

  // Losing the page while expanded would leave a full-screen panel with nothing
  // in it, so drop back to the split view instead.
  useEffect(() => {
    if (!srcDoc) setExpanded(false)
  }, [srcDoc])

  useEffect(() => {
    if (!expanded) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false)
    }

    // The panel covers the page, so the document behind it must not scroll
    // underneath on trackpads and phones.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [expanded])

  // Keyboard users land on the control that got them here, and are put back
  // where they were when they leave.
  useEffect(() => {
    if (expanded) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      expandRef.current?.focus()
    } else {
      returnFocusRef.current?.focus?.()
      returnFocusRef.current = null
    }
  }, [expanded])

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
    <div
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? "Page preview, full screen" : undefined}
      className={cn(
        "flex min-h-0 flex-col bg-muted/30",
        expanded ? "fixed inset-0 z-50 bg-background" : "h-full",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </span>
          <ScreenshotButton
            size="sm"
            label="Download a screenshot of the whole page"
            fileName={screenshotFileName(fileName, "preview")}
            capture={capturePage}
            disabled={!srcDoc}
          />
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5" role="group" aria-label="Preview width">
            <DeviceButton
              icon={Monitor}
              label="Desktop width preview"
              active={device === "desktop"}
              disabled={!srcDoc}
              onClick={() => setDevice("desktop")}
            />
            <DeviceButton
              icon={Smartphone}
              label="Mobile width preview"
              active={device === "mobile"}
              disabled={!srcDoc}
              onClick={() => setDevice("mobile")}
            />
          </div>

          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

          {expanded && (
            <kbd className="mr-1 hidden rounded border border-border px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          )}
          <button
            ref={expandRef}
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={!srcDoc}
            aria-pressed={expanded}
            className={cn(
              "flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{expanded ? "Exit" : "Full screen"}</span>
            <span className="sr-only sm:hidden">
              {expanded ? "Exit full screen preview" : "Open preview full screen"}
            </span>
          </button>
          {/* Collapsing belongs to the split view, so the control stands down
              while the preview is covering it. */}
          {!expanded && <IdeOutputControls />}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 justify-center overflow-auto",
          expanded ? "p-4 sm:p-6" : "p-2",
          // Full screen gives the phone frame far more height than a phone has,
          // so centre it and cap it rather than stretching it into a ribbon.
          device === "mobile" && expanded && "items-center",
        )}
      >
        {srcDoc ? (
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
              device === "mobile"
                ? "w-[390px] max-w-full"
                : "w-full",
              device === "mobile" && expanded && "max-h-[844px]",
            )}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Monitor className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground text-pretty">
              Create an <code className="font-mono text-xs">index.html</code> file to see
              your page here.
            </p>
          </div>
        )}
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

function DeviceButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Monitor
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded p-1 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
