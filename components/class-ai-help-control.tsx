"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Sparkles, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getClassAiHelp, updateClassAiHelp } from "@/app/actions/ai-help"

const PRESETS = [5, 10] as const

export function ClassAiHelpControl({ classId }: { classId: number }) {
  const { data, mutate } = useSWR(["class-ai-help", classId], () => getClassAiHelp(classId))
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [delay, setDelay] = useState("10")
  const [saving, setSaving] = useState(false)

  function openDialog() {
    if (data) {
      setEnabled(data.enabled)
      setDelay(String(data.delayMinutes))
    }
    setOpen(true)
  }

  const isCustom = !PRESETS.includes(Number(delay) as (typeof PRESETS)[number])

  async function save() {
    setSaving(true)
    try {
      const next = await updateClassAiHelp(classId, { enabled, delayMinutes: Number(delay) })
      await mutate(next, { revalidate: false })
      toast.success(next.enabled ? `AI Help on, unlocks after ${next.delayMinutes} min` : "AI Help turned off")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save AI Help settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        disabled={!data}
        className="gap-2 bg-transparent"
        aria-label="AI Help settings"
      >
        <Sparkles className={cn("h-4 w-4", data?.enabled ? "text-primary" : "text-muted-foreground")} />
        <span>AI Help</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            data?.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {!data ? "…" : data.enabled ? `On · ${data.delayMinutes} min` : "Off"}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI Help for this class</DialogTitle>
            <DialogDescription>
              Controls the AI error hints students see in this class. Applies instantly to every
              student.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Allow AI Help</p>
                <p className="text-xs text-muted-foreground">
                  Turn off during tests or when students should work independently.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Allow AI Help"
                onClick={() => setEnabled((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  enabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
                    enabled ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            <fieldset disabled={!enabled} className="flex flex-col gap-2 disabled:opacity-50">
              <Label>Unlock AI Help after</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={Number(delay) === m ? "default" : "outline"}
                    onClick={() => setDelay(String(m))}
                  >
                    {m} minutes
                  </Button>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={delay}
                    onChange={(e) => setDelay(e.target.value)}
                    className={cn("h-8 w-20", isCustom && "border-primary")}
                    aria-label="Custom unlock time in minutes"
                  />
                  <span className="text-sm text-muted-foreground">custom min</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The timer starts when a student asks for help on an error, and is tracked on the
                server.
              </p>
            </fieldset>
          </div>

          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
