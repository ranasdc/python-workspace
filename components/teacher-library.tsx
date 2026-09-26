"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { CodeEditor } from "@/components/code-editor"
import { usePyodide } from "@/hooks/use-pyodide"
import { HtmlPreview } from "@/components/ide/html-preview"
import { buildPreviewDocument, type PreviewBuild } from "@/lib/ide/html-document"
import { PythonConsole, type ConsoleLine } from "@/components/python-console"
import { IdeSwitcher } from "@/components/ide/ide-switcher"
import {
  DEFAULT_LANGUAGE,
  editorModeFor,
  getLanguage,
  type LanguageId,
} from "@/lib/ide/languages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getLibrary,
  createLibraryFolder,
  createLibraryFile,
  saveLibraryFile,
  deleteLibraryFile,
  deleteLibraryFolder,
  distributeFile,
  distributeFolder,
} from "@/app/actions/library"
import {
  getLibraryTask,
  saveLibraryTask,
  deleteLibraryTask,
  type LibraryTask,
} from "@/app/actions/tasks"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import {
  Plus,
  FileCode,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Loader2,
  Check,
  Send,
  Library,
  Sparkles,
  Play,
  Square,
  RotateCcw,
  ClipboardList,
  Wand2,
  X,
} from "lucide-react"
import Link from "next/link"

type LibFile = {
  id: number
  teacherId: string
  folderId: number | null
  name: string
  content: string
  createdAt: Date
  updatedAt: Date
  hasTask?: boolean
}
type LibFolder = {
  id: number
  teacherId: string
  name: string
  createdAt: Date
  files: LibFile[]
}
type LibraryData = { folders: LibFolder[]; rootFiles: LibFile[] }

type ClassOption = {
  id: number
  name: string
  students: { id: string; name: string; email: string }[]
}

export function TeacherLibrary({ classes }: { classes: ClassOption[] }) {
  // Library content is per IDE, matching how it is stored and distributed.
  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE)
  const libraryKey = ["teacher-library", language]

  const { data } = useSWR<LibraryData>(libraryKey, () => getLibrary(language), {
    revalidateOnFocus: false,
    keepPreviousData: false,
  })
  const { mutate } = useSWRConfig()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Teachers run the exact same execution path students get: Pyodide for
  // Python, the sandboxed iframe preview for HTML. No separate IDE.
  const isWeb = language === "html"
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [previewDoc, setPreviewDoc] = useState<PreviewBuild | null>(null)
  const [runId, setRunId] = useState(0)
  const { status, loadError, awaitingInput, interactive, run, submitInput, stop } =
    usePyodide({ enabled: !isWeb })

  const allFiles = data ? [...data.rootFiles, ...data.folders.flatMap((f) => f.files)] : []
  const selected = allFiles.find((f) => f.id === selectedId) ?? null

  useEffect(() => {
    if (selected) {
      setDraft(selected.content)
      setSaveState("idle")
    }
    // Output belongs to the file that produced it; switching files clears it.
    setConsoleLines([])
    setPreviewDoc(null)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(
    async (fileId: number, content: string) => {
      setSaveState("saving")
      await saveLibraryFile(fileId, content)
      setSaveState("saved")
    },
    [],
  )

  function handleChange(v: string) {
    setDraft(v)
    if (!selectedId) return
    setSaveState("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(selectedId, v), 800)
  }

  async function refresh() {
    await mutate(libraryKey)
  }

  // A file from the other IDE must not stay open when the filter changes.
  useEffect(() => {
    setSelectedId(null)
    setDraft("")
    setConsoleLines([])
    setPreviewDoc(null)
  }, [language])

  /**
   * The library as the preview should see it: saved content for every file,
   * but the live draft for the one being edited, so Run reflects what is on
   * screen and cross-file links (e.g. style.css from index.html) resolve.
   */
  const previewFiles = useMemo(
    () =>
      allFiles.map((f) => ({
        name: f.name,
        content: f.id === selectedId ? draft : f.content,
      })),
    [data, selectedId, draft], // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function handleRun() {
    if (!selected) return
    if (isWeb) {
      setPreviewDoc(buildPreviewDocument(previewFiles, selected.name))
      setRunId((n) => n + 1)
      if (selectedId) persist(selectedId, draft)
      return
    }
    setConsoleLines([])
    await run(draft, (text, kind) =>
      setConsoleLines((prev) => [...prev, { text, kind }]),
    )
    // Keep the tested code saved right after running, matching the student IDE.
    if (selectedId) persist(selectedId, draft)
  }

  function handleSubmitInput(text: string) {
    setConsoleLines((prev) => [...prev, { text: text + "\n", kind: "in" }])
    submitInput(text)
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr]">
      {/* Library tree */}
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="border-b border-border px-3 pb-3 pt-3">
          <IdeSwitcher value={language} onChange={setLanguage} />
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Library className="h-3.5 w-3.5" />
            My library
          </span>
          <div className="flex items-center gap-1">
            <NewFolderButton language={language} onDone={refresh} />
            <NewFileButton
              language={language}
              folders={data?.folders ?? []}
              onDone={refresh}
              onCreated={setSelectedId}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {data === undefined ? (
            <p className="px-2 text-sm text-muted-foreground">Loading library...</p>
          ) : data.folders.length === 0 && data.rootFiles.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground text-pretty">
              No {getLanguage(language).label} tasks yet. Create a folder or file to build
              reusable tasks, then distribute them to a class or a single student.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {data.folders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  classes={classes}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChanged={refresh}
                />
              ))}
              {data.rootFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  classes={classes}
                  selected={selectedId === file.id}
                  onSelect={() => setSelectedId(file.id)}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-h-[300px] flex-col lg:min-h-0">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="font-medium">{selected.name}</span>
                {saveState === "saving" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving
                  </span>
                )}
                {saveState === "saved" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary" /> Saved
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isWeb && status === "running" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stop}
                    title="Stop the running program"
                  >
                    <Square className="mr-1.5 h-4 w-4" /> Stop
                  </Button>
                )}
                {!isWeb && status !== "running" && consoleLines.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConsoleLines([])}
                    title="Clear the console output"
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleRun}
                  disabled={!isWeb && (status === "loading" || status === "running")}
                  title={isWeb ? "Render your page" : "Run your code"}
                >
                  {!isWeb && status === "loading" ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading Python
                    </>
                  ) : !isWeb && status === "running" ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Running
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" /> {isWeb ? "Run / Preview" : "Run code"}
                    </>
                  )}
                </Button>
                <TaskComposer
                  key={selected.id}
                  file={selected}
                  onChanged={refresh}
                />
                <DistributeDialog
                  classes={classes}
                  label={`Distribute ${selected.name}`}
                  onConfirm={(classId, studentId) => distributeFile(selected.id, classId, studentId)}
                />
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
              <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
                <CodeEditor
                  value={draft}
                  onChange={handleChange}
                  mode={editorModeFor(selected.name)}
                />
              </div>
              <div className="flex min-h-0 flex-col">
                {isWeb ? (
                  <HtmlPreview build={previewDoc} runId={runId} />
                ) : (
                  <div className="min-h-0 flex-1">
                    <PythonConsole
                      lines={
                        loadError
                          ? [
                              {
                                text: `Failed to load Python runtime: ${loadError}`,
                                kind: "err",
                              },
                            ]
                          : consoleLines
                      }
                      running={status === "running"}
                      awaitingInput={awaitingInput}
                      interactive={interactive}
                      onSubmitInput={handleSubmitInput}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Library className="h-8 w-8 text-muted-foreground/60" />
              Select or create a file to edit your task, then distribute it.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FolderNode({
  folder,
  classes,
  selectedId,
  onSelect,
  onChanged,
}: {
  folder: LibFolder
  classes: ClassOption[]
  selectedId: number | null
  onSelect: (id: number) => void
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(true)

  async function remove() {
    try {
      await deleteLibraryFolder(folder.id)
      await onChanged()
      toast.success("Folder deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete folder")
    }
  }

  return (
    <li>
      <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Folder className="h-4 w-4 shrink-0 text-chart-4" />
          <span className="truncate font-medium">{folder.name}</span>
          <Badge variant="secondary" className="ml-1 shrink-0 text-xs">
            {folder.files.length}
          </Badge>
        </button>
        <DistributeDialog
          classes={classes}
          label={`Distribute folder "${folder.name}"`}
          trigger={
            <button
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
              aria-label={`Distribute folder ${folder.name}`}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          }
          onConfirm={(classId, studentId) => distributeFolder(folder.id, classId, studentId)}
        />
        <ConfirmDialog
          title="Delete folder?"
          description={`"${folder.name}" and every file inside it will be permanently deleted. This can't be undone.`}
          onConfirm={remove}
          trigger={
            <button
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete folder ${folder.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>
      {open && (
        <ul className="ml-4 border-l border-border pl-2">
          {folder.files.length === 0 ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">Empty folder</li>
          ) : (
            folder.files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                classes={classes}
                selected={selectedId === file.id}
                onSelect={() => onSelect(file.id)}
                onChanged={onChanged}
              />
            ))
          )}
        </ul>
      )}
    </li>
  )
}

function FileRow({
  file,
  classes,
  selected,
  onSelect,
  onChanged,
}: {
  file: LibFile
  classes: ClassOption[]
  selected: boolean
  onSelect: () => void
  onChanged: () => Promise<void>
}) {
  async function remove() {
    try {
      await deleteLibraryFile(file.id)
      await onChanged()
      toast.success("File deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete file")
    }
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        selected ? "bg-muted font-medium" : "hover:bg-muted/60",
      )}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{file.name}</span>
        {file.hasTask && (
          <ClipboardList
            className="h-3.5 w-3.5 shrink-0 text-chart-4"
            aria-label="Has a task"
          />
        )}
      </button>
      <DistributeDialog
        classes={classes}
        label={`Distribute ${file.name}`}
        trigger={
          <button
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            aria-label={`Distribute ${file.name}`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        }
        onConfirm={(classId, studentId) => distributeFile(file.id, classId, studentId)}
      />
      <ConfirmDialog
        title="Delete file?"
        description={`"${file.name}" will be permanently deleted. This can't be undone.`}
        onConfirm={remove}
        trigger={
          <button
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label={`Delete ${file.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        }
      />
    </li>
  )
}

function TaskComposer({
  file,
  onChanged,
}: {
  file: LibFile
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [existing, setExisting] = useState<LibraryTask | null>(null)

  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState("")
  const [yearGroup, setYearGroup] = useState("")
  const [learningObjective, setLearningObjective] = useState("")
  const [origin, setOrigin] = useState<"manual" | "ai">("manual")

  // AI generation UI state. `aiError` distinguishes an upgrade wall (feature
  // off) or a monthly cap from an ordinary transient failure.
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState<{ message: string; code?: string } | null>(null)

  // Load the current task each time the dialog opens, so it always reflects the
  // saved state even after edits elsewhere.
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
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
        setOrigin(task?.origin === "ai" ? "ai" : "manual")
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, file.id])

  async function generate() {
    setGenerating(true)
    setAiError(null)
    try {
      const res = await fetch("/api/generate-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: languageOfFile(file.name),
          topic,
          difficulty,
          yearGroup,
          learningObjective,
          fileName: file.name,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiError({ message: payload.error ?? "Could not generate a task.", code: payload.code })
        return
      }
      setTitle(payload.title ?? "")
      setInstructions(payload.instructions ?? "")
      setOrigin("ai")
      toast.success("Draft task generated — review and save it")
    } catch {
      setAiError({ message: "Could not reach the task generator. Please try again." })
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setBusy(true)
    try {
      const result = await saveLibraryTask(file.id, {
        title,
        instructions,
        topic,
        difficulty,
        yearGroup,
        learningObjective,
        origin,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      await onChanged()
      setOpen(false)
      toast.success("Task saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task")
    } finally {
      setBusy(false)
    }
  }

  async function removeTask() {
    setBusy(true)
    try {
      await deleteLibraryTask(file.id)
      setExisting(null)
      setTitle("")
      setInstructions("")
      await onChanged()
      setOpen(false)
      toast.success("Task removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove task")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={file.hasTask ? "secondary" : "outline"}>
            <ClipboardList className="mr-1.5 h-4 w-4" />
            {file.hasTask ? "Edit task" : "Add task"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Task for {file.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading task...
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* AI generator */}
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-chart-4" />
                Generate with AI
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-topic" className="text-xs">
                    Topic
                  </Label>
                  <Input
                    id="task-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. for loops, lists"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-difficulty" className="text-xs">
                    Difficulty
                  </Label>
                  <Input
                    id="task-difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    placeholder="e.g. beginner"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-year" className="text-xs">
                    Year group / age
                  </Label>
                  <Input
                    id="task-year"
                    value={yearGroup}
                    onChange={(e) => setYearGroup(e.target.value)}
                    placeholder="e.g. Year 9"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-objective" className="text-xs">
                    Learning objective
                  </Label>
                  <Input
                    id="task-objective"
                    value={learningObjective}
                    onChange={(e) => setLearningObjective(e.target.value)}
                    placeholder="e.g. use a loop to sum numbers"
                  />
                </div>
              </div>
              {aiError && (
                <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {aiError.message}
                  {(aiError.code === "ai_not_available" || aiError.code === "ai_limit") && (
                    <>
                      {" "}
                      <Link href="/pricing" className="font-medium underline">
                        See plans
                      </Link>
                    </>
                  )}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={generate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1.5 h-4 w-4" /> Generate draft
                  </>
                )}
              </Button>
            </div>

            {/* Editable task */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setOrigin("manual")
                }}
                placeholder="Short task name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="task-instructions">Instructions</Label>
              <Textarea
                id="task-instructions"
                value={instructions}
                onChange={(e) => {
                  setInstructions(e.target.value)
                  setOrigin("manual")
                }}
                rows={9}
                placeholder="What should the student do? Write clear, step-by-step instructions."
              />
              <p className="text-xs text-muted-foreground">
                Students see this exactly as written. You can edit anything the AI drafts.
              </p>
            </div>
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
                <Button variant="ghost" className="text-destructive" disabled={busy}>
                  <X className="mr-1.5 h-4 w-4" /> Remove task
                </Button>
              }
            />
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={busy || loading}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving
              </>
            ) : (
              "Save task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The library file's language is implied by its extension, matching how the
// rest of the IDE resolves it.
function languageOfFile(name: string): LanguageId {
  return name.toLowerCase().endsWith(".html") ? "html" : "python"
}

function NewFolderButton({
  language,
  onDone,
}: {
  language: LanguageId
  onDone: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  // Set when the server rejects the create for the free library folder cap, so
  // the dialog swaps the form for an upgrade prompt instead of a raw error.
  const [limitReached, setLimitReached] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const result = await createLibraryFolder(name, language)
      if (!result.ok) {
        if (result.code === "library_folder_limit") {
          setLimitReached(true)
        } else {
          toast.error(result.message)
        }
        return
      }
      setName("")
      await onDone()
      setOpen(false)
      toast.success("Folder created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create folder")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setLimitReached(false)
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New folder" />}
      >
        <FolderPlus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        {limitReached ? (
          <LibraryLimitUpgrade
            title="You've reached your free folders"
            description="The free teacher plan includes a single library folder so you can try things out. Upgrade to Teacher Pro to organize your tasks into as many folders as you like."
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="foldername">Folder name</Label>
              <Input
                id="foldername"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Week 1 — Variables"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create folder
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NewFileButton({
  language,
  folders,
  onDone,
  onCreated,
}: {
  language: LanguageId
  folders: LibFolder[]
  onDone: () => Promise<void>
  onCreated: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [folderId, setFolderId] = useState<string>("root")
  const [busy, setBusy] = useState(false)
  // Set when the server rejects the create for the free library file cap, so
  // the dialog swaps the form for an upgrade prompt instead of a raw error.
  const [limitReached, setLimitReached] = useState(false)
  const def = getLanguage(language)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const result = await createLibraryFile(
        name,
        folderId === "root" ? null : Number(folderId),
        language,
      )
      if (!result.ok) {
        if (result.code === "library_file_limit") {
          setLimitReached(true)
        } else {
          toast.error(result.message)
        }
        return
      }
      setName("")
      await onDone()
      onCreated(result.file.id)
      setOpen(false)
      toast.success(`Created ${result.file.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setLimitReached(false)
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New file" />}
      >
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        {limitReached ? (
          <LibraryLimitUpgrade
            title="You've reached your free library files"
            description="The free teacher plan includes a handful of library files to get you started. Upgrade to Teacher Pro for an unlimited library of reusable tasks."
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New {def.label} task file</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="libfilename">File name</Label>
                <Input
                  id="libfilename"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === "html" ? "index.html" : "exercise_1.py"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
                  }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {def.extensions.length > 1
                    ? `Use ${def.extensions.join(", ")}. ${def.extensions[0]} is added if you omit one.`
                    : `${def.extensions[0]} is added automatically if omitted.`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="libfolder">Folder</Label>
                <select
                  id="libfolder"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="root">Library root (no folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create file
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Shown in place of a create form when a free teacher hits a library cap.
 * Mirrors the class-limit upgrade prompt so the free tier always turns a dead
 * end into an upgrade path rather than a raw error toast.
 */
function LibraryLimitUpgrade({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const perks = [
    "An unlimited resource library",
    "Unlimited folders to organize tasks",
    "Unlimited classes and students",
  ]
  return (
    <>
      <DialogHeader>
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      <ul className="mt-1 flex flex-col gap-2.5">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-3 w-3" />
            </span>
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <DialogFooter className="mt-2">
        <Button render={<Link href="/pricing" />} nativeButton={false}>
          <Sparkles className="mr-2 h-4 w-4" />
          Upgrade to Teacher Pro
        </Button>
      </DialogFooter>
    </>
  )
}

function DistributeDialog({
  classes,
  label,
  trigger,
  onConfirm,
}: {
  classes: ClassOption[]
  label: string
  trigger?: React.ReactNode
  onConfirm: (classId: number, studentId: string | null) => Promise<{ delivered: number; recipients: number }>
}) {
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState<string>(classes[0] ? String(classes[0].id) : "")
  const [recipient, setRecipient] = useState<string>("all")
  const [busy, setBusy] = useState(false)

  const activeClass = classes.find((c) => String(c.id) === classId) ?? null

  async function submit() {
    if (!classId) {
      toast.error("Create a class first")
      return
    }
    setBusy(true)
    try {
      const res = await onConfirm(Number(classId), recipient === "all" ? null : recipient)
      if (res.delivered === 0) {
        toast.info("Nothing new delivered — recipients already have these files")
      } else {
        toast.success(`Delivered ${res.delivered} file${res.delivered === 1 ? "" : "s"} to ${res.recipients} student${res.recipients === 1 ? "" : "s"}`)
      }
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not distribute")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement) ?? (
            <Button size="sm" variant="outline">
              <Send className="mr-1.5 h-4 w-4" /> Distribute
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You need at least one class before you can distribute files.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dist-class">Class</Label>
              <select
                id="dist-class"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value)
                  setRecipient("all")
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dist-recipient">Send to</Label>
              <select
                id="dist-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">
                  All students{activeClass ? ` (${activeClass.students.length})` : ""}
                </option>
                {activeClass?.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {activeClass && activeClass.students.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No students have joined this class yet.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={busy || classes.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-1.5 h-4 w-4" /> Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
