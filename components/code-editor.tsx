"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import Prism from "prismjs"
import "prismjs/components/prism-python"
// markup, css and javascript ship in Prism's core bundle, so HTML, CSS and JS
// need no extra grammar imports.

import type { EditorMode } from "@/lib/ide/languages"

/** Characters that auto-close, and the indent trigger, per mode. */
const AUTO_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
}

function highlight(code: string, mode: EditorMode) {
  // Prism collapses a trailing newline; append one so the final line aligns
  // with the textarea's rendered empty line.
  const src = code.endsWith("\n") ? code + " " : code
  const grammar = Prism.languages[mode] ?? Prism.languages.python
  return Prism.highlight(src, grammar, mode)
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  /**
   * Highlighting follows the individual file rather than the IDE, so a .css
   * file inside the HTML IDE is highlighted as CSS.
   */
  mode = "python",
}: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  mode?: EditorMode
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value])
  const html = useMemo(() => highlight(value, mode), [value, mode])

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

    if (e.key === "Enter") {
      e.preventDefault()
      const lineStart = value.lastIndexOf("\n", start - 1) + 1
      const currentLine = value.slice(lineStart, start)
      const indentMatch = currentLine.match(/^[ \t]*/)
      let indent = indentMatch ? indentMatch[0] : ""

      // Python indents after a colon; the web languages indent inside an open
      // block or an element that has just been opened.
      if (mode === "python") {
        if (/:\s*$/.test(currentLine)) indent += "    "
      } else if (/[{[(]\s*$/.test(currentLine) || /<[^/>][^>]*>\s*$/.test(currentLine)) {
        indent += "  "
      }

      const insert = "\n" + indent
      const next = value.slice(0, start) + insert + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length
      })
      return
    }

    // Auto-close brackets and quotes. Beginners lose a lot of time to an
    // unclosed brace in CSS or JS, and this is cheap to provide.
    if (mode !== "python" && start === end) {
      const close = AUTO_PAIRS[e.key]
      if (close) {
        e.preventDefault()
        const next = value.slice(0, start) + e.key + close + value.slice(end)
        onChange(next)
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 1
        })
      }
    }
  }

  const placeholder = readOnly
    ? ""
    : mode === "python"
      ? "# Start typing your Python code..."
      : mode === "css"
        ? "/* Start typing your CSS... */"
        : mode === "javascript"
          ? "// Start typing your JavaScript..."
          : "<!-- Start typing your HTML... -->"

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
            className={`code-highlight language-${mode}`}
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
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
