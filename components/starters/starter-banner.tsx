"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, X, Zap } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePendingStarters } from "@/hooks/use-pending-starters"

export function StarterBanner() {
  const pending = usePendingStarters()
  const [dismissed, setDismissed] = useState<number[]>([])
  const starter = pending.find((s) => !dismissed.includes(s.id))
  if (!starter) return null

  const minutes = Math.max(1, Math.round(starter.timeLimitSeconds / 60))

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2"
    >
      <div className="flex min-w-0 items-center gap-2.5 text-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 truncate">
          <span className="font-medium">Daily Starter ready:</span>{" "}
          <span className="text-muted-foreground">
            {starter.title} · {starter.questionCount} questions · {minutes} min
            {starter.className ? ` · ${starter.className}` : ""}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDismissed((d) => [...d, starter.id])}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
          aria-label="Hide for now"
          title="Hide for now"
        >
          <X className="h-4 w-4" />
        </button>
        <Link href={`/student/starters?open=${starter.id}`} className={cn(buttonVariants({ size: "sm" }), "h-8")}>
          Start <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
