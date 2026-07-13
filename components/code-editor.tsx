"use client"

import type React from "react"
import { useMemo, useRef } from "react"

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return
    // Tab inserts 4 spaces instead of moving focus
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = value.slice(0, start) + "    " + value.slice(end)
      onChange?.(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4
      })
    }
  }

  function syncScroll() {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-[color-mix(in_oklch,var(--card),var(--foreground)_3%)] font-mono text-sm">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden border-r border-border bg-muted/40 px-3 py-3 text-right text-muted-foreground"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-6 tabular-nums">
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        className="h-full w-full resize-none overflow-auto bg-transparent px-3 py-3 leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={readOnly ? "" : "# Start typing your Python code..."}
      />
    </div>
  )
}
