"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { BarChart3, CalendarDays, Copy, Pencil, Plus, Presentation, Send, Timer, Trash2, Undo2, Zap } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { todayInSchoolTime } from "@/lib/daily-starter"
import { deleteStarter, listClassStarters, setStarterAssigned } from "@/app/actions/starters"
import { StarterComposer, type ComposerInitial } from "@/components/starters/starter-composer"
import { StarterResults } from "@/components/starters/starter-results"

type ClassOption = { id: number; name: string }

export function TeacherStarters({ classes }: { classes: ClassOption[] }) {
  const [classId, setClassId] = useState<number | null>(classes[0]?.id ?? null)
  const { data, mutate } = useSWR(classId ? ["class-starters", classId] : null, () => listClassStarters(classId!))
  const [composer, setComposer] = useState<{ key: number; initial: ComposerInitial | null } | null>(null)
  const [resultsId, setResultsId] = useState<number | null>(null)

  if (classes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <Zap className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Create a class first</h2>
          <p className="mt-1 text-sm text-muted-foreground">Daily Starters are assigned to a class.</p>
        </div>
      </div>
    )
  }

  async function toggleAssign(id: number, assign: boolean) {
    const r = await setStarterAssigned(id, assign)
    if (!r.ok) toast.error(r.errors[0])
    else toast.success(assign ? "Assigned to the class" : "Moved back to drafts")
    mutate()
  }

  async function remove(id: number) {
    if (!confirm("Delete this starter and all student responses?")) return
    await deleteStarter(id)
    toast.success("Starter deleted")
    mutate()
  }

  const today = todayInSchoolTime()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-balance">Daily Starters</h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Five quick questions to open every lesson. Present live, or let students take them on
              their own.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="starter-class" className="sr-only">Class</label>
            <select
              id="starter-class"
              value={classId ?? ""}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={() => setComposer({ key: Date.now(), initial: null })}>
              <Plus className="mr-1.5 h-4 w-4" /> New starter
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {data?.starters.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Zap className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-3 font-medium">No starters for this class yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate one with AI in seconds, or write your own.
              </p>
            </div>
          )}

          {data?.starters.map((s) => {
            const assigned = s.status === "assigned"
            return (
              <article key={s.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold">{s.title}</h2>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        s.warmupActive
                          ? "bg-chart-4/20 text-foreground"
                          : assigned
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.warmupActive ? "Live warm-up" : assigned ? "Assigned" : "Draft"}
                    </span>
                    {s.starterDate === today && <span className="text-xs font-medium text-primary">Today</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{s.starterDate}</span>
                    <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{Math.round(s.timeLimitSeconds / 60)} min</span>
                    {s.topic && <span>{s.topic}</span>}
                    {assigned && (
                      <span>
                        {s.submitted}/{data.enrolled} submitted
                        {s.averagePercent !== null && ` · class average ${s.averagePercent}%`}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/teacher/warmup/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ size: "sm" })}
                  >
                    <Presentation className="mr-1.5 h-4 w-4" /> Present
                  </a>
                  {assigned && (
                    <Button size="sm" variant="outline" className="bg-transparent" onClick={() => setResultsId(s.id)}>
                      <BarChart3 className="mr-1.5 h-4 w-4" /> Results
                    </Button>
                  )}
                  {assigned ? (
                    <Button size="icon-sm" variant="ghost" onClick={() => toggleAssign(s.id, false)} aria-label="Unassign">
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="bg-transparent" onClick={() => toggleAssign(s.id, true)}>
                      <Send className="mr-1.5 h-4 w-4" /> Assign
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setComposer({ key: Date.now(), initial: s })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Duplicate"
                    onClick={() =>
                      setComposer({
                        key: Date.now(),
                        initial: { ...s, id: undefined, status: undefined, title: `${s.title} (copy)`, starterDate: today },
                      })
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {composer && classId && (
        <StarterComposer
          key={composer.key}
          classId={classId}
          initial={composer.initial}
          open
          onOpenChange={(o) => !o && setComposer(null)}
          onSaved={() => mutate()}
        />
      )}
      <StarterResults starterId={resultsId} onClose={() => setResultsId(null)} />
    </div>
  )
}
