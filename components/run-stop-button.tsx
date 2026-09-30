"use client"

import { Button } from "@/components/ui/button"
import type { RunStatus } from "@/hooks/use-pyodide"
import { cn } from "@/lib/utils"
import { Loader2, Play, Square } from "lucide-react"

// One control for every IDE surface: Run turns into Stop while the program is
// running (including while it waits for input()), then back to Run.
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

  if (running) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={onStop}
        title="Stop the running program"
        className={cn("min-w-24", className)}
      >
        <Square className="mr-1.5 h-3.5 w-3.5 fill-current" /> Stop
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onRun}
      disabled={disabled || loading}
      title={isWeb ? "Render your page" : "Run your code"}
      className={cn("min-w-24", className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading Python
        </>
      ) : (
        <>
          <Play className="mr-1.5 h-4 w-4" /> {isWeb ? webLabel : runLabel}
        </>
      )}
    </Button>
  )
}
