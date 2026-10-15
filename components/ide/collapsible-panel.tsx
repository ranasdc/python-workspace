"use client"

import { useCallback, useEffect, useId, useState, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Remembers whether a workspace's library panel is collapsed.
 *
 * The key carries the user id as well as the panel name, so two people sharing
 * one browser — a pupil and a sibling on the family laptop, a teacher signing in
 * on a classroom machine after a lesson — never inherit each other's layout.
 *
 * The stored value is read after mount rather than during render: the server
 * cannot know it, so consulting it while rendering would make the first client
 * paint disagree with the server's HTML. Expanded is therefore always the
 * starting state, which is also the right fallback when storage is unavailable.
 */
export function useCollapsiblePanel({ userId, scope }: { userId: string; scope: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const storageKey = `mcp:panel-collapsed:${userId}:${scope}`

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(storageKey) === "1")
    } catch {
      // Private mode or a locked-down school device: the toggle still works for
      // this visit, the choice just will not outlive it.
    }
  }, [storageKey])

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0")
      } catch {}
      return next
    })
  }, [storageKey])

  /**
   * Open the panel without the risk of closing it.
   *
   * The edge gesture needs this rather than `toggle`: a pointer that brushes the
   * screen edge while the panel is already open must do nothing at all.
   */
  const expand = useCallback(() => {
    setCollapsed((previous) => {
      if (!previous) return previous
      try {
        window.localStorage.setItem(storageKey, "0")
      } catch {}
      return false
    })
  }, [storageKey])

  return { collapsed, toggle, expand }
}

/**
 * A workspace side panel that can be folded away, plus the divider that folds
 * it. Both halves live here because the chevron has to sit *on* the divider,
 * and the divider owns the border between panel and editor — splitting them
 * would leave each caller re-deciding which side draws the line.
 *
 * Children stay mounted while collapsed. That is deliberate: the file trees
 * inside hold expanded folders, scroll position and selection, and unmounting
 * would silently throw all of it away every time the panel was folded.
 */
export function CollapsiblePanel({
  collapsed,
  onToggle,
  onExpand,
  label,
  widthClassName = "lg:w-72",
  className,
  children,
}: {
  collapsed: boolean
  onToggle: () => void
  /** Opens the panel. Supplying it enables the screen-edge gesture below. */
  onExpand?: () => void
  /** Names the region for screen readers, e.g. "Class and files". */
  label: string
  /** Width of the panel when open. Also pinned on the inner wrapper so the
   *  content slides out of view instead of reflowing as the panel narrows. */
  widthClassName?: string
  className?: string
  children: ReactNode
}) {
  const panelId = useId()
  const action = collapsed ? "Show library panel" : "Hide library panel"
  // The edge gesture is invisible by nature, so the chevron advertises it.
  const hint = collapsed && onExpand ? `${action} (or move the pointer to the left edge)` : action

  /**
   * Bring the panel back by running the pointer into the left edge of the
   * screen.
   *
   * Folded away, the chevron is a 20px-wide target — findable, but a precise
   * thing to aim at every time you want your files. The screen edge is the one
   * target a mouse cannot overshoot, so throwing the pointer at it is both
   * faster and more reliable than hitting the chevron.
   *
   * Watching pointer position beats putting an invisible strip in the corner:
   * no element means nothing that can sit in front of the panel's own controls
   * or swallow a click meant for the editor.
   */
  useEffect(() => {
    if (!collapsed || !onExpand) return

    // Mice only, and only in the side-by-side layout. On a touch screen there
    // is no hover to read and the gesture would fight with swiping back; on a
    // narrow screen the panel folds upwards, so the left edge means nothing.
    const canHover = window.matchMedia("(pointer: fine)")
    const sideBySide = window.matchMedia("(min-width: 1024px)")
    if (!canHover.matches || !sideBySide.matches) return

    // The gesture starts disarmed, because collapsing usually *ends* with the
    // pointer at the edge: the chevron it was just clicked on sits there. Until
    // the pointer has moved clear once, the edge stays inert — otherwise the
    // panel would spring open again the instant it was folded away.
    let armed = false
    const EDGE_PX = 6
    const CLEAR_PX = 56

    function handleMove(event: MouseEvent) {
      if (!armed) {
        if (event.clientX > CLEAR_PX) armed = true
        return
      }
      if (event.clientX <= EDGE_PX) onExpand!()
    }

    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [collapsed, onExpand])

  return (
    <>
      <aside
        id={panelId}
        aria-label={label}
        // `inert` takes the collapsed tree out of the focus order and the
        // accessibility tree together. aria-hidden alone would leave its
        // buttons tabbable while invisible.
        inert={collapsed || undefined}
        className={cn(
          "flex shrink-0 flex-col overflow-hidden",
          "transition-[width,max-height] duration-200 ease-out motion-reduce:transition-none",
          collapsed
            ? "max-h-0 w-full lg:max-h-none lg:w-0"
            : cn("max-h-[60vh] w-full lg:max-h-none", widthClassName),
          className,
        )}
      >
        <div className={cn("flex min-h-0 w-full flex-1 flex-col", widthClassName)}>{children}</div>
      </aside>

      <div
        className={cn(
          "relative z-10 flex shrink-0 items-center justify-center",
          "border-b border-border bg-sidebar lg:w-5 lg:border-b-0 lg:border-r lg:bg-transparent",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          title={hint}
          aria-label={action}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          className={cn(
            "flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "h-7 w-16 lg:h-20 lg:w-5",
          )}
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-4 w-4 lg:hidden" aria-hidden="true" />
              <ChevronRight className="hidden h-4 w-4 lg:block" aria-hidden="true" />
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4 lg:hidden" aria-hidden="true" />
              <ChevronLeft className="hidden h-4 w-4 lg:block" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </>
  )
}
