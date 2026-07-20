"use client"

import { cn } from "@/lib/utils"
import { Terminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export type ConsoleLine = { text: string; kind: "out" | "err" | "info" | "in" }

export function PythonConsole({
  lines,
  running = false,
  awaitingInput = false,
  interactive = false,
  onSubmitInput,
}: {
  lines: ConsoleLine[]
  running?: boolean
  awaitingInput?: boolean
  interactive?: boolean
  onSubmitInput?: (text: string) => void
}) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Focus the console input as soon as the program asks for it.
  useEffect(() => {
    if (awaitingInput) inputRef.current?.focus()
  }, [awaitingInput])

  // Keep the newest output/input in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines, awaitingInput])

  function submit() {
    onSubmitInput?.(value)
    setValue("")
  }

  const showPrompt = interactive && awaitingInput
  const isEmpty = lines.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color-mix(in_oklch,var(--card),var(--foreground)_4%)]">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" />
        Output
        {showPrompt && (
          <span className="ml-auto flex items-center gap-1.5 text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Waiting for input
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 cursor-text overflow-auto p-3 font-mono text-sm leading-6"
        onClick={() => showPrompt && inputRef.current?.focus()}
      >
        {isEmpty && !showPrompt ? (
          <p className="text-muted-foreground">
            {running ? "Running..." : "Run your code to see the output here."}
          </p>
        ) : (
          <pre className="whitespace-pre-wrap break-words">
            {lines.map((line, i) => (
              <span
                key={i}
                className={cn(
                  line.kind === "err" && "text-destructive",
                  line.kind === "info" && "text-muted-foreground",
                  line.kind === "in" && "font-semibold text-primary",
                  line.kind === "out" && "text-foreground",
                )}
              >
                {line.text}
              </span>
            ))}
            {showPrompt && (
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    (e as unknown as { keyCode: number }).keyCode !== 229
                  ) {
                    e.preventDefault()
                    submit()
                  }
                }}
                size={Math.max(value.length + 1, 2)}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                aria-label="Program input"
                className="border-none bg-transparent p-0 font-mono text-sm text-primary caret-primary outline-none"
              />
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
