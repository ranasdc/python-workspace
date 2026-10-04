"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { toast } from "sonner"
import {
  AlertTriangle,
  ClipboardList,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { AiUpgradePrompt, useAiUpgradePrompt } from "@/components/ai-upgrade-prompt"
import { SolutionMarkdown } from "@/components/tasks/solution-markdown"
import {
  getLibraryTask,
  saveLibraryTask,
  deleteLibraryTask,
  type LibraryTask,
  type SolutionSource,
} from "@/app/actions/tasks"
import { getLanguage, type LanguageId } from "@/lib/ide/languages"
import { isSolutionStale, taskFingerprint } from "@/lib/tasks/solution-freshness"
import { cn } from "@/lib/utils"

/** The three AI tools, matching the modes of /api/generate-task. */
type AiMode = "create" | "refine" | "solution"

const CLICK_EVENT: Record<AiMode, string> = {
  create: "ai_task_generation_clicked",
  refine: "ai_task_refinement_clicked",
  solution: "ai_solution_generation_clicked",
}

const FAILURE_MESSAGE: Record<AiMode, string> = {
  create: "Unable to generate the task right now. Your work has been preserved. Please try again.",
  refine: "Unable to refine the task right now. Your work has been preserved. Please try again.",
  solution: "Unable to generate a solution right now. Your task has been preserved.",
}

const PENDING_LABEL: Record<AiMode, string> = {
  create: "Generating task",
  refine: "Refining task",
  solution: "Writing solution",
}

const SOURCE_LABEL: Record<SolutionSource, string> = {
  ai: "AI generated",
  teacher: "Written by you",
  teacher_edited: "AI, edited by you",
}

type Draft = { title: string; instructions: string }
type Refinement = Draft & { summary: string }

export function TaskWorkspace({
  file,
  language,
  onChanged,
}: {
  file: { id: number; name: string; hasTask?: boolean }
  language: LanguageId
  onChanged: () => Promise<void>
}) {
  const languageDef = getLanguage(language)

  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<LibraryTask | null>(null)

  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState("")
  const [yearGroup, setYearGroup] = useState("")
  const [learningObjective, setLearningObjective] = useState("")
  const [requirements, setRequirements] = useState("")
  const [origin, setOrigin] = useState<"manual" | "ai">("manual")
  const [aiRefined, setAiRefined] = useState(false)

  const [solution, setSolution] = useState<string | null>(null)
  const [solutionSource, setSolutionSource] = useState<SolutionSource | null>(null)
  const [solutionFingerprint, setSolutionFingerprint] = useState<string | null>(null)
  const [solutionView, setSolutionView] = useState<"closed" | "view" | "edit">("closed")

  const [pending, setPending] = useState<AiMode | null>(null)
  const [aiError, setAiError] = useState<{ mode: AiMode; message: string; code?: string } | null>(
    null,
  )
  const [refinement, setRefinement] = useState<Refinement | null>(null)
  const [generatedNotice, setGeneratedNotice] = useState<{ previous: Draft | null } | null>(null)

  // The upgrade prompt is rendered inside this dialog, so it stacks above it as
  // a nested dialog and the task form underneath is never unmounted.
  const aiPrompt = useAiUpgradePrompt()
  const instructionsRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    track("create_task_opened", { language, hasTask: Boolean(file.hasTask) })
    getLibraryTask(file.id)
      .then((task) => {
        if (!active) return
        setExisting(task)
        setTitle(task?.title ?? "")
        setInstructions(task?.instructions ?? "")
        setTopic(task?.topic ?? "")
        setDifficulty(task?.difficulty ?? "")
        setYearGroup(task?.yearGroup ?? "")
        setLearningObjective(task?.learningObjective ?? "")
        setRequirements("")
        setOrigin(task?.origin === "ai" ? "ai" : "manual")
        setAiRefined(task?.aiRefined ?? false)
        setSolution(task?.solution ?? null)
        setSolutionSource((task?.solutionSource as SolutionSource | null) ?? null)
        setSolutionFingerprint(task?.solutionFingerprint ?? null)
        setSolutionView("closed")
        setRefinement(null)
        setGeneratedNotice(null)
        setAiError(null)
      })
      .catch(() => toast.error("Could not load the task"))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, file.id, file.hasTask, language])

  const hasSolution = Boolean(solution?.trim())
  const solutionStale = hasSolution && isSolutionStale(solutionFingerprint, title, instructions)

  async function runAi(mode: AiMode) {
    track(CLICK_EVENT[mode], { language })
    setPending(mode)
    setAiError(null)

    // A teacher who has only written a draft brief can still generate: their
    // own words become the seed rather than being thrown away.
    const seedFromDraft =
      mode === "create" &&
      !topic.trim() &&
      !learningObjective.trim() &&
      !requirements.trim() &&
      (title.trim() || instructions.trim())
        ? `Base the task on this idea from the teacher:\n${title}\n${instructions}`.trim()
        : requirements

    try {
      const res = await fetch("/api/generate-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          language,
          topic,
          difficulty,
          yearGroup,
          learningObjective,
          requirements: seedFromDraft,
          fileName: file.name,
          title,
          instructions,
        }),
      })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (aiPrompt.handleRefusal(payload)) {
          track("ai_task_generation_blocked", { feature: mode, language })
          track("upgrade_popup_from_ai_task", { feature: mode })
          return
        }
        setAiError({
          mode,
          message: res.status >= 500 ? FAILURE_MESSAGE[mode] : (payload.error ?? FAILURE_MESSAGE[mode]),
          code: payload.code,
        })
        return
      }

      if (mode === "create") {
        const previous =
          title.trim() || instructions.trim() ? { title, instructions } : null
        setTitle(payload.title ?? "")
        setInstructions(payload.instructions ?? "")
        setOrigin("ai")
        setAiRefined(false)
        setRefinement(null)
        if (payload.solution) {
          setSolution(payload.solution)
          setSolutionSource("ai")
          setSolutionFingerprint(taskFingerprint(payload.title ?? "", payload.instructions ?? ""))
        }
        setGeneratedNotice({ previous })
        track("ai_task_generated", { language, withSolution: Boolean(payload.solution) })
      } else if (mode === "refine") {
        setRefinement({
          title: payload.title ?? "",
          instructions: payload.instructions ?? "",
          summary: payload.summary ?? "",
        })
        track("ai_task_refined", { language })
      } else {
        setSolution(payload.solution ?? "")
        setSolutionSource("ai")
        setSolutionFingerprint(taskFingerprint(title, instructions))
        setSolutionView("view")
        track("ai_solution_generated", { language })
      }
    } catch {
      setAiError({ mode, message: FAILURE_MESSAGE[mode] })
    } finally {
      setPending(null)
    }
  }

  function acceptRefinement() {
    if (!refinement) return
    setTitle(refinement.title)
    setInstructions(refinement.instructions)
    setAiRefined(true)
    setRefinement(null)
    setGeneratedNotice(null)
  }

  function restorePrevious() {
    const previous = generatedNotice?.previous
    if (!previous) return
    setTitle(previous.title)
    setInstructions(previous.instructions)
    setOrigin(existing?.origin === "ai" ? "ai" : "manual")
    setGeneratedNotice(null)
  }

  function editManually() {
    setGeneratedNotice(null)
    instructionsRef.current?.focus()
  }

  function toggleSolution() {
    if (solutionView !== "closed") {
      setSolutionView("closed")
      return
    }
    setSolutionView("view")
    track("task_solution_viewed", { language, source: solutionSource ?? "none" })
  }

  function startManualSolution() {
    setSolution("")
    setSolutionSource("teacher")
    setSolutionFingerprint(taskFingerprint(title, instructions))
    setSolutionView("edit")
  }

  function editSolutionText(value: string) {
    setSolution(value)
    setSolutionSource((source) => (source === "ai" ? "teacher_edited" : (source ?? "teacher")))
    // Editing the answer is the teacher vouching for it against the task as it
    // reads now, so that becomes the version later edits are compared with.
    setSolutionFingerprint(taskFingerprint(title, instructions))
  }

  function removeSolution() {
    setSolution(null)
    setSolutionSource(null)
    setSolutionFingerprint(null)
    setSolutionView("closed")
  }

  async function save() {
    setSaving(true)
    try {
      const result = await saveLibraryTask(file.id, {
        title,
        instructions,
        topic,
        difficulty,
        yearGroup,
        learningObjective,
        origin,
        aiRefined,
        solution: hasSolution ? solution : null,
        solutionSource: hasSolution ? solutionSource : null,
        solutionFingerprint: hasSolution ? solutionFingerprint : null,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      await onChanged()
      setOpen(false)
      toast.success(existing ? "Task updated" : "Task attached")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task")
    } finally {
      setSaving(false)
    }
  }

  async function removeTask() {
    setSaving(true)
    try {
      await deleteLibraryTask(file.id)
      setExisting(null)
      await onChanged()
      setOpen(false)
      toast.success("Task removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove task")
    } finally {
      setSaving(false)
    }
  }

  const busy = pending !== null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 hover:text-chart-4"
            title={file.hasTask ? "Edit the task attached to this file" : "Create a task for this file"}
          >
            {file.hasTask ? (
              <>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit task
              </>
            ) : (
              <>
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Create task
              </>
            )}
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "flex flex-col overflow-hidden",
          fullscreen
            ? "h-screen max-h-screen w-screen max-w-none rounded-none sm:max-w-none"
            : "h-[92vh] max-h-[92vh] w-[96vw] max-w-[1400px] sm:max-w-[1400px]",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setFullscreen((f) => !f)}
          aria-label={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
          className="absolute top-2 right-11"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        <DialogHeader>
          <DialogTitle>{existing ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{file.name}</span>
            <Badge variant="outline">{languageDef.label}</Badge>
            {origin === "ai" && <Badge variant="secondary">AI generated</Badge>}
            {aiRefined && <Badge variant="secondary">AI refined</Badge>}
          </DialogDescription>
        </DialogHeader>

        <p className="sr-only" aria-live="polite">
          {pending ? `${PENDING_LABEL[pending]}…` : ""}
        </p>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading task...
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto lg:flex-row lg:overflow-hidden">
            {/* Task editor */}
            <section
              aria-label="Task"
              className="flex min-w-0 flex-1 flex-col gap-4 lg:overflow-y-auto lg:pr-1"
            >
              {generatedNotice && !refinement && (
                <div className="flex flex-col gap-2 rounded-lg border border-chart-4/30 bg-chart-4/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-foreground">
                    AI drafted this task. Review it before saving.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={editManually}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit manually
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => runAi("refine")} disabled={busy}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Refine
                    </Button>
                    {generatedNotice.previous && (
                      <Button size="sm" variant="ghost" onClick={restorePrevious}>
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Restore my draft
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {refinement ? (
                <RefinementReview
                  current={{ title, instructions }}
                  refined={refinement}
                  onKeep={() => setRefinement(null)}
                  onUse={acceptRefinement}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-title">Task title</Label>
                    <Input
                      id="task-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Short task name"
                      maxLength={200}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-instructions">Task instructions</Label>
                    <Textarea
                      id="task-instructions"
                      ref={instructionsRef}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="min-h-[220px] resize-y leading-relaxed"
                      placeholder="What should the student do? Write clear, step-by-step instructions."
                    />
                    <p className="text-xs text-muted-foreground">
                      Students see the title and instructions exactly as written.
                    </p>
                  </div>
                </>
              )}

              {solutionStale && !refinement && (
                <div
                  role="status"
                  className="flex flex-col gap-3 rounded-lg border border-chart-5/40 bg-chart-5/10 px-4 py-3 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-5" aria-hidden />
                    <div>
                      <p className="font-medium text-foreground">Task changed</p>
                      <p className="text-muted-foreground">
                        The existing solution may no longer match this task.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => runAi("solution")} disabled={busy}>
                      {pending === "solution" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Regenerate solution
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSolutionFingerprint(taskFingerprint(title, instructions))}
                    >
                      Keep existing solution
                    </Button>
                  </div>
                </div>
              )}

              <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Task details (optional)</legend>
                <p className="-mt-1 text-xs text-muted-foreground">
                  These guide the AI tools so tasks and solutions fit your class.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="task-topic" label="Topic" value={topic} onChange={setTopic} placeholder="e.g. for loops, lists" />
                  <Field id="task-difficulty" label="Difficulty" value={difficulty} onChange={setDifficulty} placeholder="e.g. beginner" />
                  <Field id="task-year" label="Year group" value={yearGroup} onChange={setYearGroup} placeholder="e.g. Year 9" />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-language" className="text-xs">
                      Programming language
                    </Label>
                    <Input id="task-language" value={languageDef.label} readOnly disabled />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      id="task-objective"
                      label="Learning objective"
                      value={learningObjective}
                      onChange={setLearningObjective}
                      placeholder="e.g. use a loop to sum numbers"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="task-requirements" className="text-xs">
                      Additional requirements
                    </Label>
                    <Textarea
                      id="task-requirements"
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      className="min-h-[72px] resize-y"
                      placeholder="e.g. must use input(), include an extension challenge"
                    />
                  </div>
                </div>
              </fieldset>
            </section>

            {/* AI tools and solution */}
            <aside
              aria-label="AI tools and solution"
              className="flex shrink-0 flex-col gap-4 lg:w-[420px] lg:overflow-y-auto xl:w-[460px]"
            >
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-chart-4" aria-hidden />
                  AI tools
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Nothing is saved or shown to students until you choose Save &amp; attach.
                </p>
                <div className="grid gap-2">
                  <ToolButton
                    icon={Wand2}
                    label={origin === "ai" ? "Regenerate task" : "Generate task with AI"}
                    busyLabel={PENDING_LABEL.create}
                    busy={pending === "create"}
                    disabled={busy}
                    onClick={() => runAi("create")}
                  />
                  <ToolButton
                    icon={Sparkles}
                    label="Refine task with AI"
                    busyLabel={PENDING_LABEL.refine}
                    busy={pending === "refine"}
                    disabled={busy || Boolean(refinement)}
                    onClick={() => runAi("refine")}
                  />
                  <ToolButton
                    icon={Lightbulb}
                    label={hasSolution ? "Regenerate solution" : "Generate solution"}
                    busyLabel={PENDING_LABEL.solution}
                    busy={pending === "solution"}
                    disabled={busy}
                    onClick={() => runAi("solution")}
                  />
                  <ToolButton
                    icon={solutionView === "closed" ? Eye : EyeOff}
                    label={solutionView === "closed" ? "View solution" : "Hide solution"}
                    disabled={!hasSolution && solutionView === "closed"}
                    onClick={toggleSolution}
                  />
                </div>
                {!hasSolution && solutionView === "closed" && (
                  <button
                    type="button"
                    onClick={startManualSolution}
                    className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Or write a solution yourself
                  </button>
                )}

                {aiError && (
                  <div
                    role="alert"
                    className="mt-3 flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    <p>
                      {aiError.message}
                      {aiError.code === "ai_limit" && (
                        <>
                          {" "}
                          <Link href="/pricing" className="font-medium underline">
                            See plans
                          </Link>
                        </>
                      )}
                    </p>
                    {aiError.code !== "ai_limit" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={() => runAi(aiError.mode)}
                        disabled={busy}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {solutionView !== "closed" && (
                <section
                  aria-label="Solution"
                  className="flex min-h-[280px] flex-1 flex-col rounded-lg border border-border bg-card"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">Solution</h3>
                      {solutionSource && (
                        <Badge variant="secondary">{SOURCE_LABEL[solutionSource]}</Badge>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" aria-hidden /> Teacher only
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSolutionView(solutionView === "edit" ? "view" : "edit")}
                      >
                        {solutionView === "edit" ? "Done" : (
                          <>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit solution
                          </>
                        )}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setSolutionView("closed")}
                        aria-label="Close solution"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {solutionView === "edit" ? (
                      <Textarea
                        aria-label="Solution"
                        value={solution ?? ""}
                        onChange={(e) => editSolutionText(e.target.value)}
                        className="min-h-[300px] resize-y font-mono text-xs leading-relaxed"
                        placeholder={"Write the model answer. Wrap code in ``` fences."}
                      />
                    ) : hasSolution ? (
                      <SolutionMarkdown text={solution ?? ""} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No solution yet.</p>
                    )}
                  </div>
                  {hasSolution && (
                    <footer className="flex items-center justify-between border-t border-border px-4 py-2">
                      <p className="text-xs text-muted-foreground">Never shown to students.</p>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={removeSolution}>
                        Remove solution
                      </Button>
                    </footer>
                  )}
                </section>
              )}
            </aside>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {existing ? (
            <ConfirmDialog
              title="Remove task?"
              description={`The task on "${file.name}" will be deleted. Students who already have this file will no longer see a task. This can't be undone.`}
              confirmLabel="Remove task"
              onConfirm={removeTask}
              trigger={
                <Button variant="ghost" className="text-destructive" disabled={saving}>
                  <X className="mr-1.5 h-4 w-4" /> Remove task
                </Button>
              }
            />
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || loading || Boolean(refinement)}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                "Save & attach task"
              )}
            </Button>
          </div>
        </DialogFooter>

        <AiUpgradePrompt open={aiPrompt.open} onOpenChange={aiPrompt.setOpen} />
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  busyLabel,
  busy = false,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start bg-background"
      onClick={onClick}
      disabled={disabled}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icon className="mr-2 h-4 w-4 text-chart-4" />
      )}
      {busy ? `${busyLabel}…` : label}
    </Button>
  )
}

function RefinementReview({
  current,
  refined,
  onKeep,
  onUse,
}: {
  current: Draft
  refined: Refinement
  onKeep: () => void
  onUse: () => void
}) {
  return (
    <section aria-label="Compare refinement" className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">Review the refined task</h3>
        {refined.summary && <p className="text-sm text-muted-foreground">{refined.summary}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <DraftCard heading="Current task" draft={current} />
        <DraftCard heading="AI refined version" draft={refined} highlighted />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onKeep}>
          Keep original
        </Button>
        <Button onClick={onUse}>Use refined version</Button>
      </div>
    </section>
  )
}

function DraftCard({
  heading,
  draft,
  highlighted = false,
}: {
  heading: string
  draft: Draft
  highlighted?: boolean
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4",
        highlighted ? "border-chart-4/40 bg-chart-4/5" : "border-border bg-muted/30",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
      <p className="font-medium">{draft.title || "Untitled"}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {draft.instructions}
      </p>
    </article>
  )
}
