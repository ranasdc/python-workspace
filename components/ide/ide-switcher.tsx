"use client"

import { useRef, type KeyboardEvent } from "react"
import { Code2, FileCode2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { LANGUAGE_ORDER, LANGUAGES, type LanguageId } from "@/lib/ide/languages"

const ICONS: Record<LanguageId, typeof Code2> = {
  python: Code2,
  html: FileCode2,
}

export type IdeSwitcherVariant = "bar" | "segmented"

/**
 * Switches which IDE the workspace is showing.
 *
 * Two variants, because the control means different things in each place it
 * appears. In the student workspace it is top-level navigation — switching IDE
 * swaps the file tree, the run behaviour, the output pane and the free-tier
 * allowance in one go — so "bar" renders it as a full tab strip whose active
 * tab is underlined in that language's accent colour. In the narrow teacher
 * columns it really is just a filter on the tree below it, so "segmented"
 * keeps the compact pill.
 *
 * Either way the active IDE is carried by colour, not only by a raised
 * background: a student glancing at the screen should know which IDE they are
 * in without reading anything.
 */
export function IdeSwitcher({
  value,
  onChange,
  disabled,
  variant = "segmented",
}: {
  value: LanguageId
  onChange: (next: LanguageId) => void
  disabled?: boolean
  variant?: IdeSwitcherVariant
}) {
  const tabs = useRef(new Map<LanguageId, HTMLButtonElement | null>())
  const isBar = variant === "bar"

  /** Arrow-key movement is what makes role="tablist" a promise we keep. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return

    const last = LANGUAGE_ORDER.length - 1
    const current = LANGUAGE_ORDER.indexOf(value)
    let next: LanguageId | undefined

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = LANGUAGE_ORDER[(current + 1) % LANGUAGE_ORDER.length]
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = LANGUAGE_ORDER[(current - 1 + LANGUAGE_ORDER.length) % LANGUAGE_ORDER.length]
    } else if (event.key === "Home") {
      next = LANGUAGE_ORDER[0]
    } else if (event.key === "End") {
      next = LANGUAGE_ORDER[last]
    }

    if (!next) return
    event.preventDefault()
    onChange(next)
    tabs.current.get(next)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Choose IDE"
      onKeyDown={handleKeyDown}
      className={cn(
        isBar
          ? "flex items-stretch gap-1"
          : "grid grid-cols-2 gap-1 rounded-lg bg-muted p-1",
      )}
    >
      {LANGUAGE_ORDER.map((id) => {
        const def = LANGUAGES[id]
        const Icon = ICONS[id]
        const selected = id === value

        return (
          <button
            key={id}
            ref={(node) => {
              tabs.current.set(id, node)
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            // Roving tabindex: the group is one tab stop, arrows move inside it.
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            title={`${def.label} — ${def.blurb} (${def.extensions.join(", ")})`}
            style={
              selected
                ? {
                    color: def.accent,
                    backgroundColor: `color-mix(in oklch, ${def.accent} 12%, transparent)`,
                  }
                : undefined
            }
            className={cn(
              "relative flex items-center gap-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              "disabled:cursor-not-allowed disabled:opacity-60",
              isBar
                ? "rounded-t-md px-3 py-2.5 sm:px-4"
                : "justify-center rounded-md px-2 py-1.5",
              selected ? "font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{def.label}</span>
            {/* Sits on the bar's own bottom border, tying the active tab to the
                workspace it controls. */}
            {selected && isBar && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                style={{ backgroundColor: def.accent }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
