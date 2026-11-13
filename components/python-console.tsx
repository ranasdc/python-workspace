"use client"

import { IdeOutputControls } from "@/components/ide/ide-split"
import { ScreenshotButton } from "@/components/ide/screenshot-button"
import { Button } from "@/components/ui/button"
import type { RunStatus } from "@/hooks/use-pyodide"
import { consoleImage, screenshotFileName } from "@/lib/ide/screenshot"
import { cn } from "@/lib/utils"
import { AlertTriangle, Loader2, RefreshCw, Terminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export type ConsoleLine = { text: string; kind: "out" | "err" | "info" | "in" }

export function PythonConsole({
  lines,
  running = false,
  awaitingInput = false,
  interactive = false,
  onSubmitInput,
  runtimeStatus,
  runtimeError = null,
  runtimeErrorDetail = null,
  onRetryRuntime,
  fileName,
}: {
  /** The file that was run, which a screenshot of its output is named after. */
  fileName?: string
  lines: ConsoleLine[]
  running?: boolean
  awaitingInput?: boolean
  interactive?: boolean
  onSubmitInput?: (text: string) => void
  /** Drives the header indicator, so Python's state is always visible. */
  runtimeStatus?: RunStatus
  /** Student-facing reason the runtime could not start. */
  runtimeError?: string | null
  /** Underlying exception, shown only if the student opens the details. */
  runtimeErrorDetail?: string | null
  onRetryRuntime?: () => void
}) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLPreElement>(null)

  async function captureOutput() {
    const transcript = transcriptRef.current
    const surface = surfaceRef.current
    if (!transcript || !surface) throw new Error("There is no output to capture yet.")
    return consoleImage(transcript, surface)
  }

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
    <div
      ref={surfaceRef}
      className="flex h-full min-h-0 flex-col bg-[color-mix(in_oklch,var(--card),var(--foreground)_4%)]"
    >
      <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-xs font-medium text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" />
        Output
        <ScreenshotButton
          size="sm"
          label="Download a screenshot of the output"
          fileName={screenshotFileName(fileName, "output")}
          capture={captureOutput}
          disabled={isEmpty || Boolean(runtimeError)}
        />
        <div className="ml-auto flex items-center gap-2">
          {showPrompt ? (
            <span className="flex items-center gap-1.5 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Waiting for input
            </span>
          ) : (
            <RuntimeIndicator status={runtimeStatus} />
          )}
          {/* Supplied by the IDE layout this console sits in. Rendered on its
              own, the console has nothing to collapse into and shows none. */}
          <IdeOutputControls />
        </div>
      </div>
      {runtimeError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">Python runtime unavailable</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{runtimeError}</p>
            {onRetryRuntime && (
              <Button size="sm" variant="secondary" onClick={onRetryRuntime} className="mt-1">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Retry Python Runtime
              </Button>
            )}
            {runtimeErrorDetail && (
              <details className="w-full text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Technical details
                </summary>
                <p className="mt-1.5 break-words rounded-md bg-muted p-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  {runtimeErrorDetail}
                </p>
              </details>
            )}
          </div>
        </div>
      ) : (
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
          <pre ref={transcriptRef} className="whitespace-pre-wrap break-words">
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
      )}
    </div>
  )
}

/**
 * Standing answer to "is Python ready yet?", so a student never has to guess
 * whether the IDE is still downloading the runtime or waiting on them.
 */
function RuntimeIndicator({ status }: { status?: RunStatus }) {
  if (!status || status === "error") return null

  if (status === "loading") {
    return (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading Python
      </span>
    )
  }

  if (status === "running") {
    return (
      <span className="flex items-center gap-1.5 text-primary">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        Running
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-chart-3" aria-hidden="true" />
      Python ready
    </span>
  )
}
