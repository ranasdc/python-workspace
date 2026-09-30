"use client"

import { Button } from "@/components/ui/button"
import type { RunStatus } from "@/hooks/use-pyodide"
import { cn } from "@/lib/utils"
import { Loader2, Play, Square } from "lucide-react"

// One Run control for every IDE surface. Python files always show Run and Stop
// side by side so Stop is discoverable even for programs that finish instantly;
// Stop only becomes active while code is running.
export function RunStopButton({
  isWeb,
  status,
  onRun,
  onStop,
  runLabel,
  webLabel,
  variant = "default",
  disabled = false,
  className,
}: {
  isWeb: boolean
  status: RunStatus
  onRun: () => void
  onStop: () => void
  runLabel: string
  webLabel: string
  variant?: "default" | "secondary"
  disabled?: boolean
  className?: string
}) {
  const running = !isWeb && status === "running"
  const loading = !isWeb && status === "loading"

  const runButton = (
    <Button
      size="sm"
      variant={variant}
      onClick={onRun}
      disabled={disabled || loading || running}
      title={isWeb ? "Render your page" : "Run your code"}
      className={cn("min-w-24", isWeb && className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading Python
        </>
      ) : running ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Running
        </>
      ) : (
        <>
          <Play className="mr-1.5 h-4 w-4" /> {isWeb ? webLabel : runLabel}
        </>
      )}
    </Button>
  )

  if (isWeb) return runButton

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {runButton}
      <Button
        size="sm"
        variant={running ? "destructive" : "outline"}
        onClick={onStop}
        disabled={!running}
        title={running ? "Stop the running program" : "Nothing is running"}
        aria-label="Stop the running program"
      >
        <Square className="mr-1.5 h-3.5 w-3.5 fill-current" /> Stop
      </Button>
    </div>
  )
}
