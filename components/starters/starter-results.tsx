"use client"

import useSWR from "swr"
import { Check, Loader2, Minus, X, Lock } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { QUESTION_TYPES } from "@/lib/daily-starter"
import { getStarterResults } from "@/app/actions/starters"

export function StarterResults({ starterId, onClose }: { starterId: number | null; onClose: () => void }) {
  const { data } = useSWR(starterId ? ["starter-results", starterId] : null, () => getStarterResults(starterId!), {
    refreshInterval: 10000,
  })

  const submitted = data?.students.filter((s) => s.status === "submitted") ?? []

  return (
    <Dialog open={starterId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>{data?.starter.title ?? "Results"}</DialogTitle>
          <DialogDescription>
            {data ? `${submitted.length} of ${data.enrolled} students submitted` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <section aria-labelledby="class-overview">
              <h3 id="class-overview" className="text-sm font-semibold">Class overview</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {data.starter.questions.map((q, i) => {
                  const a = data.aggregate[i]
                  const pct = a.answered ? Math.round((a.correct / a.answered) * 100) : 0
                  return (
                    <div key={q.id} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">
                        Q{i + 1} · {QUESTION_TYPES[q.type]}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium">{q.prompt}</p>
                      <p className={cn("mt-3 text-2xl font-semibold tabular-nums", pct < 50 && a.answered ? "text-destructive" : "text-foreground")}>
                        {a.answered ? `${pct}%` : "–"}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-chart-3" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {a.correct} correct · {a.incorrect} incorrect
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>

            <section aria-labelledby="individual" className="mt-8">
              <div className="flex items-center gap-2">
                <h3 id="individual" className="text-sm font-semibold">Individual results</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Only visible to you
                </span>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Student</th>
                      {data.starter.questions.map((q, i) => (
                        <th key={q.id} className="px-2 py-2 text-center font-medium">Q{i + 1}</th>
                      ))}
                      <th className="px-4 py-2 text-right font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                          No students in this class yet.
                        </td>
                      </tr>
                    )}
                    {data.students.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{s.name}</td>
                        {s.perQuestion.map((c, i) => (
                          <td key={i} className="px-2 py-2 text-center">
                            {c === null ? (
                              <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="No answer" />
                            ) : c ? (
                              <Check className="mx-auto h-4 w-4 text-chart-3" aria-label="Correct" />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-destructive" aria-label="Incorrect" />
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right tabular-nums">
                          {s.status === "submitted" ? (
                            `${s.score}/${s.total}`
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {s.status === "in_progress" ? "In progress" : "Not started"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
