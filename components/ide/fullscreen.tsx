"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

type FullscreenValue = {
  /** True while the workspace is showing only the editor and its output. */
  fullscreen: boolean
  toggle: () => void
  exit: () => void
}

/**
 * Focus mode for the workspace: the editor and its output, and nothing else.
 *
 * The toggle sits in the app header while the panes it governs live several
 * levels below, in a different subtree. Context is what lets one control drive
 * them without every layer in between having to forward a prop it has no other
 * use for.
 *
 * The default is a no-op rather than a thrown error, so the header can render
 * on pages that have no editor to expand — the toggle simply doesn't appear.
 */
const FullscreenContext = createContext<FullscreenValue>({
  fullscreen: false,
  toggle: () => {},
  exit: () => {},
})

export function useFullscreen() {
  return useContext(FullscreenContext)
}

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false)

  const toggle = useCallback(() => setFullscreen((previous) => !previous), [])
  const exit = useCallback(() => setFullscreen(false), [])

  /**
   * Escape leaves focus mode.
   *
   * Hiding the surrounding chrome also hides the toggle's own label, so a user
   * who doesn't recognise the collapsed control needs a way out that doesn't
   * depend on finding it. Escape is where everyone already reaches.
   *
   * Dialogs stop the event before it reaches the window, so pressing Escape
   * with the task open closes the task and leaves focus mode intact — which is
   * the order a user expects when two things are stacked.
   */
  useEffect(() => {
    if (!fullscreen) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [fullscreen])

  const value = useMemo(() => ({ fullscreen, toggle, exit }), [fullscreen, toggle, exit])

  return <FullscreenContext.Provider value={value}>{children}</FullscreenContext.Provider>
}

/**
 * The control that enters and leaves focus mode.
 *
 * A switch rather than a button: focus mode is a state you are in or out of,
 * and a switch shows which without having to be read. The knob slides across a
 * track that takes on the brand gradient when lit, so the "on" state reads from
 * across a classroom.
 *
 * The caption sits under the switch rather than beside it. Centred in the
 * header, a side label would push the control off the midpoint, and this is the
 * one place in the app where a control has the room below it to be named.
 */
export function FullscreenToggle({ className }: { className?: string }) {
  const { fullscreen, toggle } = useFullscreen()

  return (
    <div className={cn("flex items-center gap-2", fullscreen ? "flex-row" : "flex-col gap-1", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={fullscreen}
        onClick={toggle}
        title={fullscreen ? "Leave full screen (Esc)" : "Expand the editor to full screen"}
        aria-label="Full screen editor"
        className={cn(
          "group relative inline-flex h-6 w-12 shrink-0 items-center rounded-full p-0.5",
          "transition-colors duration-200 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          // Lit, the track carries the same gradient as the wordmark; dark, it
          // is a plain inset well so the switch reads as "off" at a glance.
          fullscreen
            ? "bg-gradient-to-r from-primary to-chart-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]"
            : "bg-muted shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)] hover:bg-muted/80",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none h-5 w-5 rounded-full bg-card",
            "shadow-[0_1px_3px_rgba(0,0,0,0.28)] ring-1 ring-black/5",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            fullscreen ? "translate-x-6" : "translate-x-0",
          )}
        />
      </button>
      <span
        className={cn(
          "select-none text-[11px] font-medium leading-none tracking-wide transition-colors",
          fullscreen ? "text-primary" : "text-muted-foreground",
        )}
      >
        Full screen
      </span>
    </div>
  )
}
