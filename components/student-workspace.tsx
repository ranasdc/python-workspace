"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import { usePyodide } from "@/hooks/use-pyodide"
import { CodeEditor } from "@/components/code-editor"
import { HtmlPreview } from "@/components/ide/html-preview"
import { buildPreviewDocument, type PreviewBuild } from "@/lib/ide/html-document"
import {
  DEFAULT_LANGUAGE,
  editorModeFor,
  getLanguage,
  type LanguageId,
} from "@/lib/ide/languages"
import { PythonConsole, type ConsoleLine } from "@/components/python-console"
import { ErrorHelper } from "@/components/error-helper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getStudentFiles,
  createFile,
  saveFile,
  deleteFile,
  createStudentFolder,
  deleteStudentFolder,
} from "@/app/actions/files"
import { joinClass } from "@/app/actions/classes"
import { subscriptionInfoKey } from "@/lib/swr-keys"
import { FileComments } from "@/components/file-comments"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { getFolderColors } from "@/lib/folder-colors"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Play,
  Plus,
  FileCode,
  Trash2,
  Loader2,
  Check,
  Users,
  FolderPlus,
  CheckCircle2,
  Send,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react"

type ClassItem = {
  id: number
  name: string
  description: string | null
  joinCode: string
  teacherId: string
}

type FileItem = {
  id: number
  classId: number
  studentId: string
  folderId: number | null
  name: string
  language: string
  content: string
  status: string
  markedAt: Date | null
  assignedByTeacher: boolean
  hasTask?: boolean
  taskTitle?: string | null
  taskInstructions?: string | null
  createdAt: Date
  updatedAt: Date
}

type FolderItem = {
  id: number
  classId: number
  studentId: string
  name: string
  language: string
  assignedByTeacher: boolean
  createdAt: Date
  files: FileItem[]
}

type FileTree = {
  folders: FolderItem[]
  rootFiles: FileItem[]
}

// Task "seen" tracking lives client-side so we don't touch the task/DB schema.
// A task counts as new/updated when its current title+instructions differ from
// what this browser last saw for that file. Viewing the task records the
// current signature, which clears the indicator until the teacher edits again.
function taskSignature(f: { taskTitle?: string | null; taskInstructions?: string | null }) {
  return `${f.taskTitle ?? ""}\u0000${f.taskInstructions ?? ""}`
}
function readTaskSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("mcp:task-seen") || "{}") as Record<string, string>
  } catch {
    return {}
  }
}
function markTaskSeen(fileId: number, signature: string) {
  try {
    const seen = readTaskSeen()
    seen[String(fileId)] = signature
    localStorage.setItem("mcp:task-seen", JSON.stringify(seen))
  } catch {
    // Private-mode / storage-disabled: the indicator simply won't persist.
  }
}

export function StudentWorkspace({ 
  initialClasses,
  onLimitReached,
  isFreeUser,
  canCreateFile,
  canCreateFolder,
  language = DEFAULT_LANGUAGE,
}: { 
  initialClasses: ClassItem[]
  onLimitReached?: (type: "file" | "folder") => void
  isFreeUser?: boolean
  canCreateFile?: boolean
  canCreateFolder?: boolean
  language?: LanguageId
}) {
  const languageDef = getLanguage(language)
  const isWeb = language === "html"
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses)
  const [activeClassId, setActiveClassId] = useState<number | null>(
    initialClasses[0]?.id ?? null,
  )
  const [activeFileId, setActiveFileId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [taskOpen, setTaskOpen] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  // Snapshot of the page as it was when Run was last pressed, plus a counter
  // that forces the iframe to remount so each run starts from a clean document.
  const [previewDoc, setPreviewDoc] = useState<PreviewBuild | null>(null)
  const [runId, setRunId] = useState(0)
  // Task viewer presentation state (does not affect the editor / code).
  const [taskFullscreen, setTaskFullscreen] = useState(false)
  const [taskPinned, setTaskPinned] = useState(false)
  const [taskPanelWidth, setTaskPanelWidth] = useState(360)
  const [seenTick, setSeenTick] = useState(0)
  const resizeState = useRef<{ startX: number; startW: number } | null>(null)

  const { status, loadError, awaitingInput, interactive, run, submitInput } = usePyodide({
    // Python is a multi-megabyte download; don't pay for it in the HTML IDE.
    enabled: !isWeb,
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The language is part of the cache key, so switching IDE fetches its own
  // tree instead of briefly rendering the other IDE's files.
  const filesKey = activeClassId ? ["files", activeClassId, language] : null
  const { data: tree } = useSWR<FileTree>(
    filesKey,
    () => getStudentFiles(activeClassId!, language),
    {
      revalidateOnFocus: true,
      // Poll so teacher-distributed files and marking updates show up live.
      refreshInterval: 6000,
    },
  )

  // Flatten every file (root + inside folders) for selection lookups.
  const allFiles: FileItem[] = tree
    ? [...tree.rootFiles, ...tree.folders.flatMap((f) => f.files)]
    : []
  const hasAnyFiles = allFiles.length > 0

  const activeFile = allFiles.find((f) => f.id === activeFileId) ?? null

  // Select the first available file when data loads / class changes
  useEffect(() => {
    if (!tree) return
    if (hasAnyFiles && !allFiles.some((f) => f.id === activeFileId)) {
      setActiveFileId(allFiles[0].id)
    }
    if (!hasAnyFiles) {
      setActiveFileId(null)
      setDraft("")
    }
  }, [tree, activeFileId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the active file's content into the editor draft
  useEffect(() => {
    if (activeFile) {
      setDraft(activeFile.content)
      setSaveState("idle")
    }
  }, [activeFileId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Output belongs to the IDE that produced it. Leaving a Python traceback on
  // screen after switching to HTML would be actively confusing.
  useEffect(() => {
    setConsoleLines([])
    setPreviewDoc(null)
  }, [language])

  const persist = useCallback(
    async (fileId: number, content: string) => {
      setSaveState("saving")
      await saveFile(fileId, content)
      await mutate(filesKey)
      setSaveState("saved")
    },
    [filesKey],
  )

  // Restore the student's preferred task-panel width and per-session pin state.
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem("mcp:task-panel-width"))
      if (Number.isFinite(w) && w >= 240 && w <= 720) setTaskPanelWidth(w)
      if (sessionStorage.getItem("mcp:task-pinned") === "1") setTaskPinned(true)
    } catch {
      // Storage unavailable — fall back to defaults.
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem("mcp:task-pinned", taskPinned ? "1" : "0")
    } catch {}
  }, [taskPinned])

  useEffect(() => {
    try {
      localStorage.setItem("mcp:task-panel-width", String(taskPanelWidth))
    } catch {}
  }, [taskPanelWidth])

  // Once the task is on screen (modal or pinned panel), record that this
  // browser has seen the current version so the "updated" indicator clears.
  useEffect(() => {
    if (!activeFile?.hasTask) return
    if (taskOpen || taskPinned) {
      markTaskSeen(activeFile.id, taskSignature(activeFile))
      setSeenTick((t) => t + 1)
    }
  }, [
    taskOpen,
    taskPinned,
    activeFile?.id,
    activeFile?.taskTitle,
    activeFile?.taskInstructions,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  const taskUpdated = useMemo(() => {
    if (!activeFile?.hasTask) return false
    return readTaskSeen()[String(activeFile.id)] !== taskSignature(activeFile)
  }, [
    activeFile?.id,
    activeFile?.taskTitle,
    activeFile?.taskInstructions,
    seenTick,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  function openTask() {
    if (!activeFile?.hasTask) return
    setTaskOpen(true)
  }

  function handleResizeStart(e: React.PointerEvent) {
    resizeState.current = { startX: e.clientX, startW: taskPanelWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handleResizeMove(e: React.PointerEvent) {
    if (!resizeState.current) return
    const delta = e.clientX - resizeState.current.startX
    setTaskPanelWidth(Math.min(720, Math.max(240, resizeState.current.startW + delta)))
  }
  function handleResizeEnd(e: React.PointerEvent) {
    resizeState.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  function handleEditorChange(v: string) {
    setDraft(v)
    if (!activeFileId) return
    setSaveState("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persist(activeFileId, v)
    }, 800)
  }

  /**
   * The current project as the preview should see it: saved content for every
   * file, but the live draft for the one being edited, so pressing Run always
   * reflects what is on screen rather than the last autosave.
   */
  const previewFiles = useMemo(
    () =>
      allFiles.map((f) => ({
        name: f.name,
        content: f.id === activeFileId ? draft : f.content,
      })),
    // allFiles is rebuilt each render; tree/draft are what actually change it.
    [tree, activeFileId, draft], // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function handleRun() {
    if (!activeFile) return

    if (isWeb) {
      setPreviewDoc(buildPreviewDocument(previewFiles, activeFile.name))
      setRunId((n) => n + 1)
      if (activeFileId) persist(activeFileId, draft)
      return
    }

    setConsoleLines([])
    await run(draft, (text, kind) => {
      setConsoleLines((prev) => [...prev, { text, kind }])
    })
    // Ensure latest code is saved right after running
    if (activeFileId) persist(activeFileId, draft)
  }

  function handleSubmitInput(text: string) {
    // Echo the typed line into the console, then hand it to the runtime.
    setConsoleLines((prev) => [...prev, { text: text + "\n", kind: "in" }])
    submitInput(text)
  }

  async function handleCreateFile(name: string, folderId: number | null = null) {
    if (!activeClassId) return
    
    // Check free tier limit
    if (isFreeUser && !canCreateFile) {
      onLimitReached?.("file")
      return
    }
    
    try {
      const created = await createFile(activeClassId, name, folderId, language)
      await Promise.all([mutate(filesKey), mutate(subscriptionInfoKey(language))])
      setActiveFileId(created.id)
      toast.success(`Created ${created.name}`)
    } catch (e) {
      await mutate(subscriptionInfoKey(language))
      // A rejected name is a mistake to correct, not a reason to sell an
      // upgrade, so only a genuine quota refusal opens the modal.
      const message = e instanceof Error ? e.message : ""
      if (/free plan/i.test(message)) {
        onLimitReached?.("file")
      } else {
        throw e instanceof Error ? e : new Error("Could not create file")
      }
    }
  }

  async function handleCreateFolder(name: string) {
    if (!activeClassId) return
    
    // Check free tier limit
    if (isFreeUser && !canCreateFolder) {
      onLimitReached?.("folder")
      return
    }
    
    try {
      const created = await createStudentFolder(activeClassId, name, language)
      await Promise.all([mutate(filesKey), mutate(subscriptionInfoKey(language))])
      toast.success(`Created folder ${created.name}`)
    } catch (e) {
      await mutate(subscriptionInfoKey(language))
      const message = e instanceof Error ? e.message : ""
      if (/free plan/i.test(message)) {
        onLimitReached?.("folder")
      } else {
        throw e instanceof Error ? e : new Error("Could not create folder")
      }
    }
  }

  async function handleDeleteFile(fileId: number) {
    await deleteFile(fileId)
    await Promise.all([mutate(filesKey), mutate(subscriptionInfoKey(language))])
    toast.success("File deleted")
  }

  async function handleDeleteFolder(folderId: number) {
    await deleteStudentFolder(folderId)
    await Promise.all([mutate(filesKey), mutate(subscriptionInfoKey(language))])
    toast.success("Folder deleted")
  }

  const activeClass = classes.find((c) => c.id === activeClassId) ?? null

  // Collect any stderr output from the last run so we can offer error help.
  const errorText = consoleLines
    .filter((l) => l.kind === "err")
    .map((l) => l.text)
    .join("")
    .trim()
  // Python-only: the helper explains tracebacks, which the HTML IDE never has.
  const showErrorHelper =
    !isWeb && Boolean(errorText) && status !== "running" && !!activeFileId

  if (classes.length === 0 && !isFreeUser) {
    return <EmptyState onJoined={(c) => {
      setClasses([c])
      setActiveClassId(c.id)
    }} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Sidebar: classes + files */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-sidebar lg:w-72 lg:border-b-0 lg:border-r">
        <div className="border-b border-border p-3">
          <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
            Class
          </Label>
          <div className="flex flex-col gap-1">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  c.id === activeClassId
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted",
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
          <JoinClassDialog
            trigger={
              <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground">
                <Plus className="mr-1.5 h-4 w-4" /> Join another class
              </Button>
            }
            onJoined={(c) => {
              setClasses((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]))
              setActiveClassId(c.id)
            }}
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Files</Label>
          <div className="flex items-center gap-0.5">
            <NewFolderDialog onCreate={handleCreateFolder} />
            <NewFileDialog
              language={language}
              onCreate={(name) => handleCreateFile(name, null)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {tree === undefined ? (
            <p className="px-2 text-sm text-muted-foreground">Loading...</p>
          ) : !hasAnyFiles && tree.folders.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              No {languageDef.label} files yet. Create a file or folder to start.
            </p>
          ) : (
            <>
              {tree.folders.map((folder, index) => (
                <StudentFolderRow
                  key={folder.id}
                  folder={folder}
                  folderIndex={index}
                  language={language}
                  activeFileId={activeFileId}
                  onSelectFile={setActiveFileId}
                  onDeleteFile={handleDeleteFile}
                  onDeleteFolder={handleDeleteFolder}
                  onCreateFile={(name) => handleCreateFile(name, folder.id)}
                />
              ))}
              {tree.rootFiles.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  active={f.id === activeFileId}
                  onSelect={() => setActiveFileId(f.id)}
                  onDelete={() => handleDeleteFile(f.id)}
                />
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Pinned task panel — a resizable companion to the IDE (large screens).
          It never remounts the editor, so code and cursor position are safe. */}
      {taskPinned && activeFile?.hasTask && (
        <div
          className="relative hidden shrink-0 flex-col border-b border-border bg-card lg:flex lg:border-b-0 lg:border-r"
          style={{ width: taskPanelWidth }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">
                {activeFile.taskTitle || "Task"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setTaskPinned(false)
                  setTaskOpen(true)
                }}
                title="Unpin — return to the large task view"
                aria-label="Unpin task"
              >
                <PinOff className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTaskPinned(false)}
                title="Close task"
                aria-label="Close task"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-foreground">
            {activeFile.taskInstructions || "No instructions provided."}
          </div>
          <div
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            className="absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task panel"
          />
        </div>
      )}

      {/* Editor + console */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {activeFile ? (
              <>
                <FileCode className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">{activeFile.name}</span>
                {activeFile.status === "done" && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-chart-3/15 px-2 py-0.5 text-xs font-semibold text-chart-3">
                    <CheckCircle2 className="h-3 w-3" /> Marked done
                  </span>
                )}
                <SaveIndicator state={saveState} />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {activeClass ? "Select or create a file" : "Select a class"}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeFile?.hasTask && (
              <Button
                size="sm"
                variant="outline"
                onClick={openTask}
                title="View the task attached to this file"
                className="relative border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 hover:text-chart-4"
              >
                <ClipboardList className="mr-1.5 h-4 w-4" /> View task
                {taskUpdated && (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-chart-4 ring-2 ring-card"
                    aria-hidden="true"
                  />
                )}
              </Button>
            )}
          <Button
            size="sm"
            onClick={handleRun}
            disabled={
              !activeFile || (!isWeb && (status === "loading" || status === "running"))
            }
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
                <Play className="mr-1.5 h-4 w-4" /> {isWeb ? "Preview" : "Run"}
              </>
            )}
          </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
          <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
            {activeFile ? (
              <CodeEditor
                value={draft}
                onChange={handleEditorChange}
                // Follows the file, not the IDE, so .css highlights as CSS.
                mode={editorModeFor(activeFile.name)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
                  Create a file to begin coding.
                </div>
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-col">
            {isWeb ? (
              <HtmlPreview build={previewDoc} runId={runId} />
            ) : (
              <>
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
                {showErrorHelper && (
                  <ErrorHelper
                    key={`${activeFileId}:${errorText}`}
                    error={errorText}
                    code={draft}
                    fileId={activeFileId!}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Teacher feedback on the open file, updated in real time */}
        {activeFile && (
          <div className="h-56 shrink-0 border-t border-border bg-card">
            <FileComments fileId={activeFile.id} canComment={false} />
          </div>
        )}
      </div>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent
          className={cn(
            "flex flex-col overflow-hidden",
            taskFullscreen
              ? "h-screen max-h-screen w-screen max-w-none sm:max-w-none rounded-none"
              : "h-[92vh] max-h-[92vh] w-[96vw] max-w-[1400px] sm:max-w-[1400px]",
          )}
        >
          <div className="absolute top-2 right-11 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setTaskPinned(true)
                setTaskOpen(false)
              }}
              title="Pin task beside the editor"
              aria-label="Pin task beside the editor"
              className="hidden lg:inline-flex"
            >
              <Pin className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setTaskFullscreen((f) => !f)}
              title={taskFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
              aria-label={taskFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {taskFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-24">
              <ClipboardList className="h-5 w-5 text-primary" />
              {activeFile?.taskTitle || "Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {activeFile?.taskInstructions || "No instructions provided."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FileRow({
  file,
  active,
  onSelect,
  onDelete,
  nested,
}: {
  file: FileItem
  active: boolean
  onSelect: () => void
  onDelete: () => void
  nested?: boolean
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        nested && "ml-4",
        active ? "bg-muted font-medium" : "hover:bg-muted/60",
      )}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <FileCode className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{file.name}</span>
        {file.assignedByTeacher && (
          <Send className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Assigned by teacher" />
        )}
        {file.status === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-chart-3" aria-label="Marked done" />
        )}
      </button>
      {!file.assignedByTeacher && (
        <ConfirmDialog
          title="Delete file?"
          description={`"${file.name}" will be permanently deleted. This can't be undone.`}
          onConfirm={onDelete}
          trigger={
            <button
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Delete ${file.name}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          }
        />
      )}
    </div>
  )
}

function StudentFolderRow({
  folder,
  folderIndex,
  language,
  activeFileId,
  onSelectFile,
  onDeleteFile,
  onDeleteFolder,
  onCreateFile,
}: {
  folder: FolderItem
  folderIndex: number
  language: LanguageId
  activeFileId: number | null
  onSelectFile: (id: number) => void
  onDeleteFile: (id: number) => void
  onDeleteFolder: (id: number) => void
  onCreateFile: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(true)
  const { icon: folderIconColor } = getFolderColors(folderIndex)

  return (
    <div className="mb-0.5">
      <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpen className={cn("h-4 w-4 shrink-0", folderIconColor)} />
          ) : (
            <Folder className={cn("h-4 w-4 shrink-0", folderIconColor)} />
          )}
          <span className="truncate font-medium">{folder.name}</span>
          {folder.assignedByTeacher && (
            <Send className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Shared by teacher" />
          )}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <NewFileDialog
            language={language}
            onCreate={onCreateFile}
            trigger={
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="New file in folder">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
          />
          {!folder.assignedByTeacher && (
            <ConfirmDialog
              title="Delete folder?"
              description={`"${folder.name}" and every file inside it will be permanently deleted. This can't be undone.`}
              onConfirm={() => onDeleteFolder(folder.id)}
              trigger={
                <button aria-label={`Delete folder ${folder.name}`}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              }
            />
          )}
        </div>
      </div>
      {open &&
        (folder.files.length === 0 ? (
          <p className="ml-8 px-2 py-1 text-xs text-muted-foreground">Empty folder</p>
        ) : (
          folder.files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              active={f.id === activeFileId}
              onSelect={() => onSelectFile(f.id)}
              onDelete={() => onDeleteFile(f.id)}
              nested
            />
          ))
        ))}
    </div>
  )
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving
      </span>
    )
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-primary" /> Saved
      </span>
    )
  return null
}

function NewFileDialog({
  language,
  onCreate,
  trigger,
}: {
  language: LanguageId
  onCreate: (name: string) => Promise<void>
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const def = getLanguage(language)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onCreate(name)
      setName("")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New file" />}
        >
          <Plus className="h-4 w-4" />
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {def.label} file</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filename">File name</Label>
          <Input
            id="filename"
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
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewFolderDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onCreate(name)
      setName("")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create folder")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New folder" />}
      >
        <FolderPlus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="foldername">Folder name</Label>
          <Input
            id="foldername"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Week 1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
            }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Organize your own work into folders.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function JoinClassDialog({
  trigger,
  onJoined,
}: {
  trigger: React.ReactNode
  onJoined: (c: ClassItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set("joinCode", code)
      const cls = await joinClass(fd)
      onJoined(cls as ClassItem)
      toast.success(`Joined ${cls.name}`)
      setCode("")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join class")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a class</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="joincode">Class join code</Label>
          <Input
            id="joincode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="font-mono tracking-widest"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmptyState({ onJoined }: { onJoined: (c: ClassItem) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Join your first class</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Ask your teacher for the class join code, then enter it below to start writing and
          running Python.
        </p>
        <JoinClassDialog
          trigger={
            <Button className="mt-5">
              <Plus className="mr-1.5 h-4 w-4" /> Enter join code
            </Button>
          }
          onJoined={onJoined}
        />
      </div>
    </div>
  )
}
