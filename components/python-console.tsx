"use client"

import { cn } from "@/lib/utils"
import { Terminal } from "lucide-react"

export type ConsoleLine = { text: string; kind: "out" | "err" | "info" }

export function PythonConsole({ lines }: { lines: ConsoleLine[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[color-mix(in_oklch,var(--card),var(--foreground)_4%)]">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" />
        Output
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-sm leading-6">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">Run your code to see the output here.</p>
        ) : (
          lines.map((line, i) => (
            <pre
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words",
                line.kind === "err" && "text-destructive",
                line.kind === "info" && "text-muted-foreground",
                line.kind === "out" && "text-foreground",
              )}
            >
              {line.text}
            </pre>
          ))
        )}
      </div>
    </div>
  )
}
