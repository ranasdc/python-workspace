"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import Prism from "prismjs"
import "prismjs/components/prism-python"

function highlight(code: string) {
  // Prism collapses a trailing newline; append one so the final line aligns
  // with the textarea's rendered empty line.
  const src = code.endsWith("\n") ? code + " " : code
  return Prism.highlight(src, Prism.languages.python, "python")
}

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
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value])
  const html = useMemo(() => highlight(value), [value])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop
      preRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop
    }
  }, [])

  // Keep layers aligned when the value changes programmatically (e.g. file switch)
  useLayoutEffect(() => {
    syncScroll()
  }, [value, syncScroll])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly || !onChange) return
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd

    // Tab inserts / outdents 4 spaces
    if (e.key === "Tab") {
      e.preventDefault()
      const next = value.slice(0, start) + "    " + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4
      })
      return
    }

    // Auto-indent: preserve leading whitespace, add a level after a colon
    if (e.key === "Enter") {
      e.preventDefault()
      const lineStart = value.lastIndexOf("\n", start - 1) + 1
      const currentLine = value.slice(lineStart, start)
      const indentMatch = currentLine.match(/^[ \t]*/)
      let indent = indentMatch ? indentMatch[0] : ""
      if (/:\s*$/.test(currentLine)) indent += "    "
      const insert = "\n" + indent
      const next = value.slice(0, start) + insert + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length
      })
    }
  }

  return (
    <div className="pycharm-editor relative flex h-full min-h-0 overflow-hidden text-sm">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="pycharm-gutter select-none overflow-hidden py-3 pl-3 pr-2 text-right tabular-nums"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-6">
            {i + 1}
          </div>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pycharm-code pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-3 py-3 leading-6"
        >
          <code
            className="code-highlight language-python"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className="pycharm-code absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 leading-6 outline-none"
          placeholder={readOnly ? "" : "# Start typing your Python code..."}
        />
      </div>
    </div>
  )
}
