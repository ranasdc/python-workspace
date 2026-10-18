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

import { useCollapsiblePanel } from "@/components/ide/collapsible-panel"

/** Ties the workspace arrow's `aria-controls` to the rail it also folds. */
export const CLASS_NAV_ID = "teacher-class-nav"

type ClassNavValue = {
  collapsed: boolean
  /** Folds or restores the rail, remembering the choice. */
  setCollapsed: (collapsed: boolean) => void
  /**
   * Whether folding the rail does anything at all. False in focus mode, which
   * takes it off screen outright, and in the stacked layout, where it sits
   * above the workspace at full width with no width to hand back.
   */
  foldable: boolean
}

const ClassNavContext = createContext<ClassNavValue | null>(null)

/**
 * Shares the classes/library rail's folded state with the workspace beside it.
 *
 * The rail is rendered by the dashboard but folded by an arrow that belongs to
 * the workspace, so the state has to sit above both. A context rather than
 * props because the two views holding that arrow — a class and the library —
 * hang off different branches of the tree.
 */
export function ClassNavProvider({
  userId,
  hidden,
  children,
}: {
  /** Scopes the remembered state, so a shared staff machine keeps teachers apart. */
  userId: string
  /** Focus mode, which takes the rail off screen entirely. */
  hidden: boolean
  children: ReactNode
}) {
  const { collapsed, set } = useCollapsiblePanel({ userId, scope: "teacher-class-nav" })
  const [sideBySide, setSideBySide] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const sync = () => setSideBySide(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  const value = useMemo(
    () => ({ collapsed, setCollapsed: set, foldable: sideBySide && !hidden }),
    [collapsed, set, sideBySide, hidden],
  )

  return <ClassNavContext.Provider value={value}>{children}</ClassNavContext.Provider>
}

export function useClassNav() {
  const value = useContext(ClassNavContext)
  if (!value) throw new Error("useClassNav must be used inside a ClassNavProvider")
  return value
}

/**
 * Folds the whole left side shut with one arrow, a panel at a time.
 *
 * The rail and the files beside it are one attached unit, so they answer to one
 * control rather than each carrying their own. Clicking it walks a three-stage
 * cycle: the rail goes first, because navigation between classes is what a
 * teacher stops needing once the lesson is under way; the files follow; and a
 * third click puts both back.
 *
 * Restoring in one step rather than unwinding stage by stage is deliberate.
 * Unwinding would need the arrow to remember which way it was last heading, so
 * two identical clicks could do opposite things with nothing on screen to say
 * which you were about to get.
 */
export function useLeftSideCascade({
  panelCollapsed,
  togglePanel,
  panelNoun,
}: {
  panelCollapsed: boolean
  /** The panel's own toggle, which also records the preference. */
  togglePanel: () => void
  /** Names the panel in the arrow's label, e.g. "student files". */
  panelNoun: string
}) {
  const { collapsed: railCollapsed, setCollapsed: setRail, foldable } = useClassNav()

  // Every stage asks only "is anything still open, outermost first?", so the
  // arrow stays correct however the two panels reached their current state —
  // including the mixed states that focus mode and stored preferences leave.
  const railOpen = foldable && !railCollapsed

  const onToggle = useCallback(() => {
    if (railOpen) {
      setRail(true)
      return
    }
    if (!panelCollapsed) {
      togglePanel()
      return
    }
    if (foldable) setRail(false)
    togglePanel()
  }, [railOpen, panelCollapsed, foldable, setRail, togglePanel])

  const actionLabel = railOpen
    ? "Hide classes and library"
    : !panelCollapsed
      ? `Hide ${panelNoun}`
      : foldable
        ? "Show all panels"
        : `Show ${panelNoun}`

  return {
    onToggle,
    actionLabel,
    // Approximate by necessity: one button, two regions. True means the next
    // click folds something away, and the label then says exactly what.
    ariaExpanded: railOpen || !panelCollapsed,
    alsoControls: foldable ? CLASS_NAV_ID : undefined,
  }
}
