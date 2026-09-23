"use client"

import { Code2, FileCode2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { LANGUAGE_ORDER, LANGUAGES, type LanguageId } from "@/lib/ide/languages"

const ICONS: Record<LanguageId, typeof Code2> = {
  python: Code2,
  html: FileCode2,
}

/**
 * Switches which IDE the workspace is showing.
 *
 * Rendered directly above the file tree because that is exactly what it
 * scopes: each IDE has its own files, its own folders and its own free-tier
 * allowance, and the control needs to read as a filter on the tree rather than
 * as global navigation.
 */
export function IdeSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: LanguageId
  onChange: (next: LanguageId) => void
  disabled?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label="Choose IDE"
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {LANGUAGE_ORDER.map((id) => {
        const def = LANGUAGES[id]
        const Icon = ICONS[id]
        const selected = id === value

        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            title={def.blurb}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{def.label}</span>
          </button>
        )
      })}
    </div>
  )
}
