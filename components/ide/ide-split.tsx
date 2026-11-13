"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import {
  ChevronLeft,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelRightClose,
} from "lucide-react"

import {
  DEFAULT_SPLIT,
  clampOutputFraction,
  outputFractionAt,
  parseSplitSizes,
  serialiseSplitSizes,
  splitStorageKey,
  type SplitAxis,
  type SplitSizes,
} from "@/lib/ide/split-layout"
import { cn } from "@/lib/utils"

/**
 * `responsive` puts the panes side by side from `lg` up and stacks them below
 * it. `stacked` keeps the output under the editor at every width, for a
 * workspace that spends its horizontal room on something else.
 */
type Direction = "responsive" | "stacked"

type OutputControls = {
  label: string
  direction: Direction
  outputId: string
  collapse: () => void
  canMaximize: boolean
  maximized: boolean
  toggleMaximized: () => void
}

/**
 * How an output pane's own header reaches the layout around it.
 *
 * The collapse and full-screen buttons belong in the console's header, but the
 * state they change belongs to the split. Context joins the two without the
 * console needing props for a layout it may not even be inside: rendered on
 * its own, the controls simply do not appear.
 */
const OutputControlsContext = createContext<OutputControls | null>(null)

const WIDE_QUERY = "(min-width: 1024px)"

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Matches the `lg` breakpoint the layout classes below switch on. */
function useIsWide() {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
}

const CONTROL_BUTTON = cn(
  "flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium transition-colors",
  "text-muted-foreground hover:bg-muted hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
)

/**
 * The collapse and full-screen buttons for an output pane's header.
 *
 * Any output component can render this; it works for whichever IDE layout it
 * finds itself in, and renders nothing outside one.
 */
export function IdeOutputControls({ className }: { className?: string }) {
  const controls = useContext(OutputControlsContext)
  if (!controls) return null

  const { label, direction, outputId, collapse, canMaximize, maximized, toggleMaximized } = controls
  const name = label.toLowerCase()

  return (
    <span className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {canMaximize && maximized && (
        <kbd className="mr-1 hidden rounded border border-border px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-block">
          Esc
        </kbd>
      )}
      {canMaximize && (
        <button
          type="button"
          onClick={toggleMaximized}
          aria-pressed={maximized}
          title={maximized ? "Exit full screen (Esc)" : `Show ${name} full screen`}
          className={CONTROL_BUTTON}
        >
          {maximized ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {maximized ? (
            <span>Exit full screen</span>
          ) : (
            <span className="sr-only">{`Show ${name} full screen`}</span>
          )}
        </button>
      )}
      {!maximized && (
        <button
          type="button"
          onClick={collapse}
          aria-expanded={true}
          aria-controls={outputId}
          title={`Hide ${name}`}
          className={CONTROL_BUTTON}
        >
          {direction === "stacked" ? (
            <PanelBottomClose className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <>
              <PanelBottomClose className="h-3.5 w-3.5 lg:hidden" aria-hidden="true" />
              <PanelRightClose className="hidden h-3.5 w-3.5 lg:block" aria-hidden="true" />
            </>
          )}
          <span className="sr-only">{`Hide ${name}`}</span>
        </button>
      )}
    </span>
  )
}

const KEY_STEP = 0.02
const KEY_STEP_LARGE = 0.1

/**
 * The editor and its output, with a divider to drag between them.
 *
 * Every IDE renders its two panes through this one component, so resizing,
 * collapsing and full-screen output behave identically in all of them and a
 * new IDE inherits the lot by passing its editor and its output.
 *
 * Both panes stay mounted whatever the layout is doing. Collapsing hides the
 * output and full screen repositions it; neither unmounts it, so console
 * lines, a program waiting on `input()` and a running preview all survive.
 */
export function IdeSplit({
  userId,
  scope,
  editor,
  output,
  outputLabel = "Output",
  direction = "responsive",
  allowMaximize = false,
  revealOn,
  variant = "flush",
  className,
  editorClassName,
  outputClassName,
}: {
  /** Scopes the remembered proportions, so a shared device keeps people apart. */
  userId: string
  /** Names this workspace, so each one remembers its own layout. */
  scope: string
  editor: ReactNode
  output: ReactNode
  /** What the output pane is called in its controls: "Output", "Preview". */
  outputLabel?: string
  direction?: Direction
  /** Offers a full-screen control in the output header. */
  allowMaximize?: boolean
  /**
   * Reopens a collapsed output whenever this changes to a truthy value. Pass
   * something that changes on Run, so pressing it never leaves a program
   * printing — or waiting for input — into a pane nobody can see.
   */
  revealOn?: string | number | boolean
  /** `cards` separates two free-standing panels with a gutter instead of a rule. */
  variant?: "flush" | "cards"
  className?: string
  editorClassName?: string
  outputClassName?: string
}) {
  const editorId = useId()
  const outputId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const separatorRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLButtonElement>(null)

  const [sizes, setSizes] = useState<SplitSizes>(DEFAULT_SPLIT)
  const [collapsed, setCollapsed] = useState(false)
  const [maximizedState, setMaximized] = useState(false)
  const [dragging, setDragging] = useState(false)

  const stacked = direction === "stacked"
  const wide = useIsWide()
  const axis: SplitAxis = !stacked && wide ? "horizontal" : "vertical"
  const maximized = maximizedState && allowMaximize
  const storageKey = splitStorageKey(userId, scope)

  // Read after mount: the server cannot know the stored layout, so consulting
  // it during render would make the first client paint disagree with its HTML.
  useEffect(() => {
    try {
      setSizes(parseSplitSizes(window.localStorage.getItem(storageKey)))
    } catch {
      // Private mode or a locked-down school device: resizing still works for
      // this visit, the proportions just will not outlive it.
    }
  }, [storageKey])

  const remember = useCallback(
    (next: SplitSizes) => {
      try {
        window.localStorage.setItem(storageKey, serialiseSplitSizes(next))
      } catch {}
    },
    [storageKey],
  )

  const sizesRef = useRef(sizes)
  useEffect(() => {
    sizesRef.current = sizes
  }, [sizes])

  const measure = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return axis === "horizontal"
      ? { start: rect.left, size: rect.width }
      : { start: rect.top, size: rect.height }
  }, [axis])

  const applyFraction = useCallback(
    (fraction: number, persist: boolean) => {
      const box = measure()
      const next = {
        ...sizesRef.current,
        [axis]: clampOutputFraction(fraction, box?.size ?? 0, axis),
      }
      sizesRef.current = next
      setSizes(next)
      if (persist) remember(next)
    },
    [axis, measure, remember],
  )

  const frame = useRef<number | null>(null)
  const pendingPointer = useRef<number | null>(null)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    // Stops the browser starting a text selection or a native drag from here.
    event.preventDefault()
    // Cancelling the press also cancels the focus it would have given, so it
    // is handed back by hand: grabbing the divider should leave the arrow keys
    // ready to fine-tune it.
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    pendingPointer.current = axis === "horizontal" ? event.clientX : event.clientY
    if (frame.current !== null) return
    // One layout per frame, however many pointer events arrive in between.
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const box = measure()
      if (!box || pendingPointer.current === null) return
      applyFraction(outputFractionAt(pendingPointer.current, box.start, box.size), false)
    })
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    setDragging(false)
    remember(sizesRef.current)
  }

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  // While the divider is held the pointer routinely strays over the code, so
  // selection is switched off for the whole page and the resize cursor kept
  // wherever the pointer goes.
  useEffect(() => {
    if (!dragging) return
    const { userSelect, cursor } = document.body.style
    document.body.style.userSelect = "none"
    document.body.style.cursor = axis === "horizontal" ? "col-resize" : "row-resize"
    return () => {
      document.body.style.userSelect = userSelect
      document.body.style.cursor = cursor
    }
  }, [dragging, axis])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
    const current = sizesRef.current[axis]
    // Arrows move the divider the way they point; the output grows as the
    // divider travels towards the editor.
    const grow = axis === "horizontal" ? "ArrowLeft" : "ArrowUp"
    const shrink = axis === "horizontal" ? "ArrowRight" : "ArrowDown"

    if (event.key === grow) applyFraction(current + step, true)
    else if (event.key === shrink) applyFraction(current - step, true)
    else if (event.key === "Home") applyFraction(1, true)
    else if (event.key === "End") applyFraction(0, true)
    else if (event.key === "Enter") applyFraction(DEFAULT_SPLIT[axis], true)
    else return
    event.preventDefault()
  }

  // Focus follows the control that replaces the one just used, so collapsing
  // or reopening from the keyboard never drops focus back to the page.
  const refocus = useRef<"rail" | "separator" | null>(null)
  useEffect(() => {
    if (refocus.current === "rail") railRef.current?.focus()
    else if (refocus.current === "separator") separatorRef.current?.focus()
    refocus.current = null
  }, [collapsed])

  const collapse = useCallback(() => {
    if (outputRef.current?.contains(document.activeElement)) refocus.current = "rail"
    setCollapsed(true)
  }, [])

  const expand = useCallback(() => {
    if (document.activeElement === railRef.current) refocus.current = "separator"
    setCollapsed(false)
  }, [])

  const toggleMaximized = useCallback(() => setMaximized((previous) => !previous), [])

  const previousReveal = useRef(revealOn)
  useEffect(() => {
    if (previousReveal.current === revealOn) return
    previousReveal.current = revealOn
    if (revealOn) setCollapsed(false)
  }, [revealOn])

  // An IDE without the control must not stay full screen with no way out, nor
  // spring back to it when the control returns.
  useEffect(() => {
    if (!allowMaximize) setMaximized(false)
  }, [allowMaximize])

  useEffect(() => {
    if (!maximized) return

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) setMaximized(false)
    }

    // The pane covers the page, so the document behind it must not scroll
    // underneath on trackpads and phones.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [maximized])

  const controls = useMemo<OutputControls>(
    () => ({
      label: outputLabel,
      direction,
      outputId,
      collapse,
      canMaximize: allowMaximize,
      maximized,
      toggleMaximized,
    }),
    [outputLabel, direction, outputId, collapse, allowMaximize, maximized, toggleMaximized],
  )

  // Whole numbers rather than fractions: flex only hands out all of the free
  // space when the grow factors add up to at least one.
  const style = {
    "--ide-editor-h": Math.round((1 - sizes.horizontal) * 1000),
    "--ide-output-h": Math.round(sizes.horizontal * 1000),
    "--ide-editor-v": Math.round((1 - sizes.vertical) * 1000),
    "--ide-output-v": Math.round(sizes.vertical * 1000),
  } as CSSProperties

  const outputInFlow = !collapsed && !maximized
  const name = outputLabel.toLowerCase()

  return (
    <OutputControlsContext.Provider value={controls}>
      <div
        ref={containerRef}
        style={style}
        className={cn("flex min-h-0 min-w-0", stacked ? "flex-col" : "flex-col lg:flex-row", className)}
      >
        <div
          id={editorId}
          className={cn(
            "relative min-w-0 shrink basis-0 overflow-hidden",
            stacked ? "min-h-24" : "min-h-24 lg:min-h-0 lg:min-w-48",
            outputInFlow
              ? stacked
                ? "[flex-grow:var(--ide-editor-v)]"
                : "[flex-grow:var(--ide-editor-v)] lg:[flex-grow:var(--ide-editor-h)]"
              : "grow",
            // An iframe or a textarea under the pointer would otherwise take
            // the events mid-drag and leave the divider stranded.
            dragging && "pointer-events-none",
            editorClassName,
          )}
        >
          {/* Absolutely filled so descendants always have a definite size to
              take a percentage of, whatever kind of box the caller sits in. */}
          <div className="absolute inset-0 flex flex-col">{editor}</div>
        </div>

        {outputInFlow && (
          <div
            ref={separatorRef}
            role="separator"
            tabIndex={0}
            aria-orientation={axis === "horizontal" ? "vertical" : "horizontal"}
            aria-controls={editorId}
            aria-valuemin={10}
            aria-valuemax={90}
            aria-valuenow={Math.round((1 - sizes[axis]) * 100)}
            aria-label={`Resize the editor and ${name}`}
            title="Drag to resize. Double-click to reset."
            data-dragging={dragging || undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => applyFraction(DEFAULT_SPLIT[axis], true)}
            onKeyDown={handleKeyDown}
            className={cn(
              "group/split relative z-10 shrink-0 touch-none select-none outline-none",
              "transition-colors duration-150 ease-out motion-reduce:transition-none",
              stacked ? "cursor-row-resize" : "cursor-row-resize lg:cursor-col-resize",
              variant === "cards"
                ? stacked
                  ? "h-4 w-full"
                  : "h-4 w-full lg:h-auto lg:w-4"
                : cn(
                    "bg-border hover:bg-primary/60 focus-visible:bg-primary data-[dragging]:bg-primary",
                    stacked ? "h-px w-full" : "h-px w-full lg:h-auto lg:w-px",
                    // A one-pixel rule is honest about where the panes meet
                    // but far too thin to grab, so the target extends past it.
                    "before:absolute before:content-['']",
                    stacked
                      ? "before:inset-x-0 before:-inset-y-1.5"
                      : "before:inset-x-0 before:-inset-y-1.5 lg:before:inset-y-0 lg:before:-inset-x-1.5",
                  ),
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                "bg-panel-rail-grip/50 transition-colors duration-150 ease-out motion-reduce:transition-none",
                "group-hover/split:bg-primary group-focus-visible/split:bg-primary group-data-[dragging]/split:bg-primary",
                stacked ? "h-1 w-8" : "h-1 w-8 lg:h-8 lg:w-1",
              )}
            />
          </div>
        )}

        {collapsed && !maximized && (
          <button
            ref={railRef}
            type="button"
            onClick={expand}
            aria-expanded={false}
            aria-controls={outputId}
            title={`Show ${name}`}
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 text-xs font-medium",
              "border-border bg-panel-rail text-panel-rail-grip",
              "transition-colors duration-150 ease-out motion-reduce:transition-none",
              "hover:bg-panel-rail-hover hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              stacked
                ? "h-8 w-full border-t"
                : "h-8 w-full border-t lg:h-auto lg:w-8 lg:flex-col lg:border-l lg:border-t-0",
              variant === "cards" &&
                (stacked ? "mt-4 rounded-xl border" : "mt-4 rounded-xl border lg:ml-4 lg:mt-0"),
            )}
          >
            {stacked ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <>
                <ChevronUp className="h-4 w-4 shrink-0 lg:hidden" aria-hidden="true" />
                <ChevronLeft className="hidden h-4 w-4 shrink-0 lg:block" aria-hidden="true" />
              </>
            )}
            <span className={cn(!stacked && "lg:[writing-mode:vertical-rl]")}>{`Show ${name}`}</span>
          </button>
        )}

        <div
          ref={outputRef}
          id={outputId}
          role={maximized ? "dialog" : undefined}
          aria-modal={maximized || undefined}
          aria-label={maximized ? `${outputLabel}, full screen` : undefined}
          className={cn(
            maximized
              ? "fixed inset-0 z-50 bg-background"
              : cn(
                  "relative min-w-0 shrink basis-0 overflow-hidden",
                  stacked ? "min-h-24" : "min-h-24 lg:min-h-0 lg:min-w-48",
                  stacked
                    ? "[flex-grow:var(--ide-output-v)]"
                    : "[flex-grow:var(--ide-output-v)] lg:[flex-grow:var(--ide-output-h)]",
                  // Hidden rather than unmounted: the console's lines, a
                  // pending input() and a live preview all have to still be
                  // there when the pane comes back.
                  collapsed && "hidden",
                  dragging && "pointer-events-none",
                  outputClassName,
                ),
          )}
        >
          <div className="absolute inset-0 flex flex-col">{output}</div>
        </div>
      </div>
    </OutputControlsContext.Provider>
  )
}
