"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Sparkles, Wand2, AlertCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  DIFFICULTIES,
  QUESTION_COUNT,
  QUESTION_TYPES,
  emptyQuestion,
  isChoiceType,
  todayInSchoolTime,
  validateQuestions,
  type QuestionType,
  type StarterQuestion,
} from "@/lib/daily-starter"
import { saveStarter, setStarterAssigned, type StarterInput } from "@/app/actions/starters"

export type ComposerInitial = Partial<StarterInput> & { id?: number; status?: string }

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function blankQuestions() {
  const types: QuestionType[] = ["mcq", "predict_output", "true_false", "fill_blank", "spot_bug"]
  return types.map((t) => emptyQuestion(t))
}

export function StarterComposer({
  classId,
  initial,
  open,
  onOpenChange,
  onSaved,
}: {
  classId: number
  initial: ComposerInitial | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [topic, setTopic] = useState(initial?.topic ?? "")
  const [language, setLanguage] = useState(initial?.language ?? "python")
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "mixed")
  const [yearGroup, setYearGroup] = useState(initial?.yearGroup ?? "")
  const [objective, setObjective] = useState(initial?.objective ?? "")
  const [date, setDate] = useState(initial?.starterDate ?? todayInSchoolTime())
  const [minutes, setMinutes] = useState(String(Math.round((initial?.timeLimitSeconds ?? 300) / 60)))
  const [allowRetake, setAllowRetake] = useState(initial?.allowRetake ?? false)
  const [questions, setQuestions] = useState<StarterQuestion[]>(initial?.questions ?? blankQuestions())
  const [aiGenerated, setAiGenerated] = useState(initial?.aiGenerated ?? false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState<null | "draft" | "assign">(null)
  const [errors, setErrors] = useState<string[]>([])

  async function generate() {
    if (!topic.trim() && !objective.trim()) {
      toast.error("Add a topic or learning objective first.")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, topic, language, difficulty, yearGroup, objective }),
      })
      const data = (await res.json().catch(() => ({}))) as { questions?: StarterQuestion[]; error?: string }
      if (!res.ok || !data.questions) throw new Error(data.error || "Generation failed")
      setQuestions(data.questions)
      setAiGenerated(true)
      setErrors([])
      if (!title.trim()) setTitle(`${topic || "Lesson"} starter`)
      toast.success("Draft ready. Review each question before assigning.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  function update(i: number, patch: Partial<StarterQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  function changeType(i: number, type: QuestionType) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q
        const fresh = emptyQuestion(type)
        return { ...fresh, id: q.id, prompt: q.prompt, code: q.code, explanation: q.explanation }
      }),
    )
  }

  async function save(assign: boolean) {
    const local = validateQuestions(questions).errors
    if (!title.trim()) local.unshift("Give the starter a title.")
    if (local.length) {
      setErrors(local)
      return
    }
    setSaving(assign ? "assign" : "draft")
    try {
      const result = await saveStarter({
        id: initial?.id,
        classId,
        title,
        topic,
        language,
        difficulty,
        yearGroup,
        objective,
        starterDate: date,
        timeLimitSeconds: Number(minutes) * 60,
        allowRetake,
        questions,
        aiGenerated,
      })
      if (!result.ok) {
        setErrors(result.errors)
        return
      }
      if (assign) {
        const a = await setStarterAssigned(result.id, true)
        if (!a.ok) {
          setErrors(a.errors)
          return
        }
      }
      toast.success(assign ? "Starter assigned to the class" : "Draft saved")
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>{initial?.id ? "Edit Daily Starter" : "New Daily Starter"}</DialogTitle>
          <DialogDescription>
            {QUESTION_COUNT} quick questions to open the lesson. Students see results instantly; you
            see the class picture.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-b border-border bg-muted/30 p-5 md:w-80 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Generate with AI</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-topic">Topic</Label>
              <Input id="st-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. for loops" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="st-lang">Language</Label>
                <select id="st-lang" className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="st-diff">Difficulty</Label>
                <select id="st-diff" className={cn(selectClass, "capitalize")} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-year">Year group / age</Label>
              <Input id="st-year" value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} placeholder="e.g. Year 9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-obj">Learning objective</Label>
              <Textarea id="st-obj" rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. use range() to repeat code" />
            </div>
            <Button onClick={generate} disabled={generating} variant="secondary">
              {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : aiGenerated ? <RefreshCw className="mr-1.5 h-4 w-4" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
              {generating ? "Generating..." : aiGenerated ? "Regenerate" : "Generate 5 questions"}
            </Button>
            <p className="text-xs text-muted-foreground text-pretty">
              Every AI question is checked for a valid answer and explanation. Always review before
              assigning. Uses your Teacher Pro AI allowance.
            </p>

            <div className="mt-2 flex flex-col gap-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="st-date">Date</Label>
                  <Input id="st-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="st-min">Time (min)</Label>
                  <Input id="st-min" type="number" min={1} max={30} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowRetake} onChange={(e) => setAllowRetake(e.target.checked)} className="h-4 w-4 accent-primary" />
                Allow students to retake
              </label>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-6 py-4">
              <Label htmlFor="st-title" className="sr-only">Title</Label>
              <Input
                id="st-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Starter title, e.g. Loops recap"
                className="h-11 text-base font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {errors.length > 0 && (
                <div role="alert" className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" /> Fix these before saving
                  </p>
                  <ul className="mt-2 list-disc pl-6 text-sm text-destructive">
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ol className="flex flex-col gap-5">
                {questions.map((q, i) => (
                  <QuestionEditor
                    key={q.id}
                    index={i}
                    question={q}
                    onChange={(patch) => update(i, patch)}
                    onType={(t) => changeType(i, t)}
                  />
                ))}
              </ol>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
              <Button variant="outline" className="bg-transparent" onClick={() => save(false)} disabled={saving !== null}>
                {saving === "draft" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save draft
              </Button>
              <Button onClick={() => save(true)} disabled={saving !== null}>
                {saving === "assign" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {initial?.status === "assigned" ? "Save changes" : "Save & assign"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function QuestionEditor({
  index,
  question: q,
  onChange,
  onType,
}: {
  index: number
  question: StarterQuestion
  onChange: (patch: Partial<StarterQuestion>) => void
  onType: (type: QuestionType) => void
}) {
  const id = `q-${q.id}`
  const choice = isChoiceType(q.type)

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold">Question {index + 1}</span>
        <select
          aria-label={`Type for question ${index + 1}`}
          className={cn(selectClass, "w-auto")}
          value={q.type}
          onChange={(e) => onType(e.target.value as QuestionType)}
        >
          {Object.entries(QUESTION_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-prompt`}>Question</Label>
            <Textarea id={`${id}-prompt`} rows={2} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>
              Code snippet {q.type === "predict_output" || q.type === "spot_bug" ? "" : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <Textarea
              id={`${id}-code`}
              rows={4}
              value={q.code ?? ""}
              onChange={(e) => onChange({ code: e.target.value })}
              className="font-mono text-sm"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {choice ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">Options (select the correct one)</legend>
              {(q.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-correct`}
                    aria-label={`Mark option ${oi + 1} correct`}
                    checked={q.answer !== "" && q.answer === opt}
                    onChange={() => onChange({ answer: opt })}
                    className="h-4 w-4 accent-primary"
                  />
                  <Input
                    value={opt}
                    readOnly={q.type === "true_false"}
                    aria-label={`Option ${oi + 1}`}
                    onChange={(e) => {
                      const options = [...(q.options ?? [])]
                      const wasAnswer = q.answer === options[oi]
                      options[oi] = e.target.value
                      onChange({ options, answer: wasAnswer ? e.target.value : q.answer })
                    }}
                    className="font-mono"
                  />
                </div>
              ))}
            </fieldset>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-answer`}>Correct answer</Label>
                <Textarea
                  id={`${id}-answer`}
                  rows={2}
                  value={q.answer}
                  onChange={(e) => onChange({ answer: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-alt`}>
                  Also accept <span className="text-muted-foreground">(one per line)</span>
                </Label>
                <Textarea
                  id={`${id}-alt`}
                  rows={2}
                  value={(q.acceptedAnswers ?? []).join("\n")}
                  onChange={(e) => onChange({ acceptedAnswers: e.target.value.split("\n") })}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-exp`}>Explanation</Label>
            <Textarea id={`${id}-exp`} rows={2} value={q.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
          </div>
        </div>
      </div>
    </li>
  )
}
