"use client"

import { useEffect, useState } from "react"
import useSWR, { mutate } from "swr"
import { usePyodide } from "@/hooks/use-pyodide"
import { CodeEditor } from "@/components/code-editor"
import { PythonConsole, type ConsoleLine } from "@/components/python-console"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClass, getTeacherClasses } from "@/app/actions/classes"
import { getClassTree, setFileStatus } from "@/app/actions/files"
import { FileComments } from "@/components/file-comments"
import { TeacherLibrary } from "@/components/teacher-library"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Users,
  FileCode,
  ChevronRight,
  ChevronDown,
  Copy,
  Loader2,
  FolderTree,
  BookOpen,
  Check,
  Play,
  Library,
  CheckCircle2,
  Circle,
} from "lucide-react"

type ClassWithStudents = {
  id: number
  name: string
  description: string | null
  joinCode: string
  teacherId: string
  students: { id: string; name: string; email: string }[]
}

type TreeFile = {
  id: number
  name: string
  content: string
  status: string
  markedAt: Date | null
  assignedByTeacher: boolean
  updatedAt: Date
}

type TreeStudent = {
  id: string
  name: string
  email: string
  files: TreeFile[]
}

export function TeacherDashboard({
  initialClasses,
}: {
  initialClasses: ClassWithStudents[]
}) {
  const { data: classes } = useSWR<ClassWithStudents[]>("teacher-classes", getTeacherClasses, {
    fallbackData: initialClasses,
    revalidateOnFocus: false,
  })
  const [activeClassId, setActiveClassId] = useState<number | null>(
    initialClasses[0]?.id ?? null,
  )
  const [view, setView] = useState<"classes" | "library">("classes")

  // Load the Python runtime once for the whole dashboard so switching between
  // student files doesn't re-download Pyodide each time.
  const pyodide = usePyodide()

  const list = classes ?? []
  const activeClass = list.find((c) => c.id === activeClassId) ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Classes list */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-sidebar lg:w-64 lg:border-b-0 lg:border-r">
        {/* Classes / Library switcher */}
        <div className="flex gap-1 border-b border-border p-2">
          <button
            onClick={() => setView("classes")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              view === "classes" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <BookOpen className="h-4 w-4" /> Classes
          </button>
          <button
            onClick={() => setView("library")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              view === "library" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Library className="h-4 w-4" /> Library
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Your classes
          </Label>
          <CreateClassDialog
            onCreated={async (id) => {
              await mutate("teacher-classes")
              setActiveClassId(id)
              setView("classes")
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {list.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No classes yet.</p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveClassId(c.id)
                  setView("classes")
                }}
                className={cn(
                  "mb-1 flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  c.id === activeClassId && view === "classes" ? "bg-primary/10" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium",
                    c.id === activeClassId && "text-primary",
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                  {c.students.length} student{c.students.length === 1 ? "" : "s"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main area: class detail or the teacher's library */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === "library" ? (
          <TeacherLibrary classes={list} />
        ) : activeClass ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <ClassDetail key={activeClass.id} cls={activeClass} pyodide={pyodide} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <EmptyTeacherState onCreated={async (id) => {
              await mutate("teacher-classes")
              setActiveClassId(id)
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

function ClassDetail({
  cls,
  pyodide,
}: {
  cls: ClassWithStudents
  pyodide: ReturnType<typeof usePyodide>
}) {
  const { data } = useSWR(["class-tree", cls.id], () => getClassTree(cls.id), {
    revalidateOnFocus: true,
    // Poll so students' newly saved work appears without a manual refresh.
    refreshInterval: 6000,
  })
  const [selected, setSelected] = useState<{ student: TreeStudent; file: TreeFile } | null>(null)
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [marking, setMarking] = useState(false)

  const { status, loadError, awaitingInput, interactive, run, submitInput } = pyodide

  // Always read the freshest copy of the selected file from the polled tree so
  // status changes and edits stay in sync.
  const currentFile =
    selected && data
      ? data.students
          .find((s) => s.id === selected.student.id)
          ?.files.find((f) => f.id === selected.file.id) ?? selected.file
      : selected?.file ?? null

  // Clear the previous output whenever the teacher opens a different file.
  useEffect(() => {
    setConsoleLines([])
  }, [selected?.file.id])

  async function handleRun() {
    if (!currentFile) return
    setConsoleLines([])
    await run(currentFile.content, (text, kind) => {
      setConsoleLines((prev) => [...prev, { text, kind }])
    })
  }

  async function toggleMark() {
    if (!currentFile) return
    const next = currentFile.status === "done" ? "unmarked" : "done"
    setMarking(true)
    try {
      await setFileStatus(currentFile.id, next)
      await mutate(["class-tree", cls.id])
      toast.success(next === "done" ? "Marked as done" : "Marked as unmarked")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status")
    } finally {
      setMarking(false)
    }
  }

  function handleSubmitInput(text: string) {
    setConsoleLines((prev) => [...prev, { text: text + "\n", kind: "in" }])
    submitInput(text)
  }

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{cls.name}</h1>
            {cls.description && (
              <p className="text-sm text-muted-foreground">{cls.description}</p>
            )}
          </div>
          <JoinCodeBadge code={cls.joinCode} />
        </div>
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(260px,340px)_1fr]">
        {/* Tree */}
        <div className="border-b border-border p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FolderTree className="h-3.5 w-3.5" />
            {cls.name}
          </div>
          {data === undefined ? (
            <p className="px-2 text-sm text-muted-foreground">Loading tree...</p>
          ) : data.students.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              No students have joined yet. Share the join code.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {data.students.map((s) => (
                <StudentNode
                  key={s.id}
                  student={s}
                  selectedFileId={selected?.file.id ?? null}
                  onSelectFile={(file) => setSelected({ student: s, file })}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Viewer */}
        <div className="flex min-h-[300px] flex-col lg:min-h-0">
          {selected && currentFile ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <FileCode className="h-4 w-4 text-primary" />
                  <span className="font-medium">{currentFile.name}</span>
                  <span className="text-muted-foreground">— {selected.student.name}</span>
                  {currentFile.status === "done" ? (
                    <Badge className="gap-1 bg-chart-3/15 text-chart-3 hover:bg-chart-3/15">
                      <CheckCircle2 className="h-3 w-3" /> Done
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Circle className="h-3 w-3" /> Unmarked
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={currentFile.status === "done" ? "outline" : "default"}
                    onClick={toggleMark}
                    disabled={marking}
                  >
                    {marking ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : currentFile.status === "done" ? (
                      <Circle className="mr-1.5 h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    )}
                    {currentFile.status === "done" ? "Mark unmarked" : "Mark as done"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRun}
                    disabled={status === "loading" || status === "running"}
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading Python
                      </>
                    ) : status === "running" ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Running
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-4 w-4" /> Run
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_minmax(260px,320px)]">
                <div className="grid min-h-0 grid-rows-2 border-b border-border lg:border-b-0 lg:border-r">
                  <div className="min-h-0 border-b border-border">
                    <CodeEditor value={currentFile.content} readOnly />
                  </div>
                  <div className="min-h-0">
                    <PythonConsole
                      lines={
                        loadError
                          ? [{ text: `Failed to load Python runtime: ${loadError}`, kind: "err" }]
                          : consoleLines
                      }
                      running={status === "running"}
                      awaitingInput={awaitingInput}
                      interactive={interactive}
                      onSubmitInput={handleSubmitInput}
                    />
                  </div>
                </div>
                {/* Feedback thread for this student's file */}
                <div className="min-h-[240px] lg:min-h-0">
                  <FileComments fileId={currentFile.id} canComment />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileCode className="h-8 w-8 text-muted-foreground/60" />
                Select a student file from the tree to view their code.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentNode({
  student,
  selectedFileId,
  onSelectFile,
}: {
  student: TreeStudent
  selectedFileId: number | null
  onSelectFile: (f: TreeFile) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{student.name}</span>
        <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
          {student.files.length}
        </Badge>
      </button>
      {open && (
        <ul className="ml-4 border-l border-border pl-2">
          {student.files.length === 0 ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">No files yet</li>
          ) : (
            student.files.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => onSelectFile(f)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    selectedFileId === f.id ? "bg-muted font-medium" : "hover:bg-muted/60",
                  )}
                >
                  <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{f.name}</span>
                  {f.status === "done" && (
                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-chart-3" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  )
}

function JoinCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success("Join code copied")
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">Join code</span>
      <code className="font-mono text-sm font-semibold tracking-widest">{code}</code>
      <button onClick={copy} aria-label="Copy join code" className="text-muted-foreground hover:text-foreground">
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

function CreateClassDialog({ onCreated }: { onCreated: (id: number) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function action(formData: FormData) {
    setBusy(true)
    try {
      const created = await createClass(formData)
      await onCreated(created.id)
      toast.success(`Class "${created.name}" created`)
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create class")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Create class" />}
      >
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a class</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Class name</Label>
            <Input id="name" name="name" placeholder="Intro to Python — Period 3" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" placeholder="What is this class about?" rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EmptyTeacherState({ onCreated }: { onCreated: (id: number) => Promise<void> }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderTree className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Create your first class</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Set up a class and share the join code with your students. Their Python files will
          appear here, organized by student.
        </p>
        <div className="mt-5">
          <CreateClassDialog onCreated={onCreated} />
        </div>
      </div>
    </div>
  )
}
