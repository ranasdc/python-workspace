"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * How far past the panel's right edge the pointer may stray before a hover-peek
 * drawer closes. Must clear the full width of the fold rail that sits against
 * that edge — reaching for the rail to close the drawer by hand has to not
 * close it first — plus enough room that a hand drifting a few pixels while
 * reading stays inside.
 */
const LEAVE_SLACK_PX = 36

/** How close to the left edge of the window counts as reaching for it. */
const EDGE_PX = 6

/**
 * How far clear of the edge the pointer must travel before the edge gesture
 * starts listening. See `useEdgeReveal` for why it waits.
 */
const EDGE_ARM_PX = 56

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
   * Fold or restore the panel outright, remembering the choice.
   *
   * `toggle` cannot serve a control that already knows which state it wants: a
   * cascade folding the rail and then the files has to be able to say "shut"
   * without first working out what "the opposite" currently means.
   */
  const set = useCallback(
    (next: boolean) => {
      setCollapsed(next)
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0")
      } catch {}
    },
    [storageKey],
  )

  /**
   * Open the panel without the risk of closing it.
   *
   * The edge gesture needs this rather than `toggle`: a pointer that brushes the
   * screen edge while the panel is already open must do nothing at all.
   *
   * Neither this nor `collapse` writes to storage. They serve the hover-peek
   * drawer, which opens and shuts many times a minute as the pointer comes and
   * goes; recording each of those would overwrite the choice the user actually
   * made with the chevron, and leave the panel shut when they left it open.
   * Only `toggle` — a deliberate click — is a preference worth remembering.
   */
  const expand = useCallback(() => {
    setCollapsed((previous) => (previous ? false : previous))
  }, [])

  /**
   * Fold the panel away without the risk of opening it.
   *
   * The mirror of `expand`, for the hover-peek drawer and for entering focus
   * mode — both of which must only ever close.
   */
  const collapse = useCallback(() => {
    setCollapsed((previous) => (previous ? previous : true))
  }, [])

  return { collapsed, toggle, set, expand, collapse }
}

/**
 * Pointer gestures only make sense for a mouse in the side-by-side layout. On
 * a touch screen there is no hover to read and an edge gesture would fight
 * with swiping back; on a narrow screen the panels fold upwards instead of
 * sideways, so the left edge of the window means nothing.
 */
function pointerGesturesApply() {
  return (
    window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(min-width: 1024px)").matches
  )
}

/**
 * Bring a folded panel back by running the pointer into the left edge of the
 * screen.
 *
 * Folded away, a chevron is a small target — findable, but a precise thing to
 * aim at every time you want your files. The screen edge is the one target a
 * mouse cannot overshoot, so throwing the pointer at it is both faster and
 * more reliable.
 *
 * Watching pointer position beats putting an invisible strip in the corner: no
 * element means nothing that can sit in front of the panel's own controls or
 * swallow a click meant for the editor.
 */
export function useEdgeReveal({
  enabled,
  onReveal,
}: {
  enabled: boolean
  onReveal: () => void
}) {
  // Read through a ref so a caller passing an inline arrow doesn't tear the
  // listener down and rebuild it — taking the armed flag below with it — on
  // every render.
  const latest = useRef(onReveal)
  useEffect(() => {
    latest.current = onReveal
  })

  useEffect(() => {
    if (!enabled || !pointerGesturesApply()) return

    // The gesture starts disarmed, because folding a panel usually *ends* with
    // the pointer at the edge: the control just clicked sits there. Until the
    // pointer has moved clear once, the edge stays inert — otherwise the panel
    // would spring open again the instant it was folded away.
    let armed = false

    function handleMove(event: MouseEvent) {
      if (!armed) {
        if (event.clientX > EDGE_ARM_PX) armed = true
        return
      }
      if (event.clientX <= EDGE_PX) latest.current()
    }

    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [enabled])
}

/**
 * Fold a panel away again once the pointer leaves it.
 *
 * Paired with `useEdgeReveal`, this makes a panel behave like a drawer you
 * pull open by reaching for it and that shuts itself when you go back to the
 * work — no second trip to a chevron.
 *
 * Pointer position is read from the window rather than the panel's own
 * mouseleave, because a menu or dialog opened from inside the panel takes the
 * pointer outside the element while the user is very much still using it. A
 * width-based test treats that as "still inside".
 */
export function useLeaveToClose({
  enabled,
  panelRef,
  onClose,
}: {
  enabled: boolean
  panelRef: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const latest = useRef(onClose)
  useEffect(() => {
    latest.current = onClose
  })

  useEffect(() => {
    if (!enabled || !pointerGesturesApply()) return

    // Measured from the live element so the threshold tracks whatever width the
    // caller asked for, and includes the divider a chevron may sit on: sliding
    // out over that chevron must not count as leaving.
    function handleMove(event: MouseEvent) {
      const width = panelRef.current?.getBoundingClientRect().width ?? 0
      if (width === 0) return
      if (event.clientX > width + LEAVE_SLACK_PX) latest.current()
    }

    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [enabled, panelRef])
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
  onCollapse,
  actionLabel,
  ariaExpanded,
  alsoControls,
  label,
  widthClassName = "lg:w-72",
  className,
  overlay = false,
  children,
}: {
  collapsed: boolean
  onToggle: () => void
  /** Names what the next click does, for a button that folds more than this
   *  panel. Without it the button describes this panel alone. */
  actionLabel?: string
  /** Overrides the disclosure state for the same reason as `actionLabel`. */
  ariaExpanded?: boolean
  /** Id of another region this button folds, announced alongside this one. */
  alsoControls?: string
  /** Opens the panel. Supplying it enables the screen-edge gesture below. */
  onExpand?: () => void
  /** Folds the panel away again once the pointer leaves it. Supplying this
   *  alongside `onExpand` turns the panel into a hover-peek drawer. */
  onCollapse?: () => void
  /** Floats the open panel above the editor instead of displacing it. Used in
   *  focus mode, where reflowing the editor on hover would move the user's
   *  cursor and text out from under them. */
  overlay?: boolean
  /** Names the region for screen readers, e.g. "Class and files". */
  label: string
  /** Width of the panel when open. Also pinned on the inner wrapper so the
   *  content slides out of view instead of reflowing as the panel narrows. */
  widthClassName?: string
  className?: string
  children: ReactNode
}) {
  const panelId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const action = actionLabel ?? (collapsed ? "Show library panel" : "Hide library panel")
  // The edge gesture is invisible by nature, so the chevron advertises it.
  const hint = collapsed && onExpand ? `${action} (or move the pointer to the left edge)` : action

  // Supplying `onExpand` opts the panel into the screen-edge gesture, and
  // adding `onCollapse` on top of it turns the panel into a hover-peek drawer.
  useEdgeReveal({
    enabled: collapsed && !!onExpand,
    onReveal: () => onExpand?.(),
  })
  useLeaveToClose({
    enabled: !collapsed && !!onCollapse,
    panelRef,
    onClose: () => onCollapse?.(),
  })

  return (
    <>
      <aside
        ref={panelRef}
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
          // Floating keeps the editor still while the drawer slides over it.
          // Shadow and border give it an edge to read against the code beneath.
          overlay && "lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:border-r lg:border-border lg:bg-sidebar lg:shadow-xl",
          className,
        )}
      >
        <div className={cn("flex min-h-0 w-full flex-1 flex-col", widthClassName)}>{children}</div>
      </aside>

      {/* The whole gutter is the control, not a tab floating on one. Folding a
          panel is among the most-used actions in the workspace, and a
          full-length column is a target that cannot really be missed — the same
          reason throwing the pointer at the screen edge works. The shade is
          what announces it: distinct from both the panel it folds and the
          editor it borders, so the column reads as something to press rather
          than a line drawn between two surfaces. */}
      <button
        type="button"
        onClick={onToggle}
        title={hint}
        aria-label={action}
        aria-expanded={ariaExpanded ?? !collapsed}
        aria-controls={alsoControls ? `${panelId} ${alsoControls}` : panelId}
        className={cn(
          "group/rail relative z-10 flex shrink-0 items-center justify-center",
          "border-b border-border bg-panel-rail text-panel-rail-grip lg:border-b-0 lg:border-r",
          "transition-colors duration-150 ease-out motion-reduce:transition-none",
          "hover:bg-panel-rail-hover hover:text-foreground active:bg-panel-rail-hover",
          // Inset: a ring drawn outside a 24px column would land on the panel
          // and the editor either side rather than on the control itself.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          // Spans whichever axis the layout stacks on — a bar above the editor
          // on a phone, the full-height gutter beside it from lg up. `h-auto`
          // hands the height back to the row's own stretch at that point.
          "h-7 w-full lg:h-auto lg:w-6 lg:self-stretch",
        )}
      >
        {/* Marks the midpoint of a column that is otherwise a long, quiet
            stripe, so the eye has somewhere to land. Only on hover: at rest the
            shade is doing the work, and a permanent chip would re-create the
            floating tab this replaced. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex items-center justify-center rounded-full",
            "h-5 w-12 lg:h-14 lg:w-5",
            "bg-transparent transition-colors duration-150 ease-out motion-reduce:transition-none",
            "group-hover/rail:bg-background/80 group-focus-visible/rail:bg-background/80",
          )}
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-4 w-4 lg:hidden" />
              <ChevronRight className="hidden h-4 w-4 lg:block" />
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4 lg:hidden" />
              <ChevronLeft className="hidden h-4 w-4 lg:block" />
            </>
          )}
        </span>
      </button>
    </>
  )
}
