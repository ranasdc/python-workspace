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

  return { collapsed, toggle }
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
  label,
  widthClassName = "lg:w-72",
  className,
  children,
}: {
  collapsed: boolean
  onToggle: () => void
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
          title={action}
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
