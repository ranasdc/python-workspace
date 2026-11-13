"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { CodeEditor } from "@/components/code-editor"
import { usePyodide } from "@/hooks/use-pyodide"
import { HtmlPreview } from "@/components/ide/html-preview"
import { buildPreviewDocument, type PreviewBuild } from "@/lib/ide/html-document"
import { PythonConsole, type ConsoleLine } from "@/components/python-console"
import { RunStopButton } from "@/components/run-stop-button"
import { IdeSwitcher } from "@/components/ide/ide-switcher"
import { ShareMenu } from "@/components/ide/share-menu"
import { CollapsiblePanel, useCollapsiblePanel } from "@/components/ide/collapsible-panel"
import { useLeftSideCascade } from "@/components/teacher-class-nav"
import { TEACHER_PRO_STUDENT_SEATS } from "@/lib/plans"
import {
  DEFAULT_LANGUAGE,
  editorModeFor,
  getLanguage,
  type LanguageId,
  runModelFor,
} from "@/lib/ide/languages"
import {
  canHoldSubfolder,
  countFilesDeep,
  filesInTree,
  folderPaths,
} from "@/lib/ide/folder-tree"
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
} from "@/app/actions/library"
import {
  deleteLibraryFile,
  deleteLibraryFolder,
  getLibraryItemReach,
  renameLibraryFile,
  renameLibraryFolder,
} from "@/app/actions/file-management"
import { distributeFile, distributeFolder } from "@/app/actions/distribution"
import { cn } from "@/lib/utils"
import {
  DeleteResourceDialog,
  ItemActionsMenu,
  RenameDialog,
} from "@/components/ide/file-actions"
import { DistributeDialog, type DistributeClassOption } from "@/components/distribute-dialog"
import { IdeSplit } from "@/components/ide/ide-split"
import { TaskWorkspace } from "@/components/tasks/task-workspace"
import { toast } from "sonner"
import {
  Plus,
  FileCode,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Loader2,
  Check,
  Send,
  Library,
  Sparkles,
  RotateCcw,
  ClipboardList,
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
  parentId: number | null
  name: string
  createdAt: Date
  /** 1 for a top-level folder. */
  depth: number
  folders: LibFolder[]
  files: LibFile[]
}
type LibraryData = { folders: LibFolder[]; rootFiles: LibFile[] }

type ClassOption = DistributeClassOption

export function TeacherLibrary({
  userId,
  classes,
}: {
  /** Scopes the panel preference, so a shared staff machine keeps teachers separate. */
  userId: string
  classes: ClassOption[]
}) {
  // Library content is per IDE, matching how it is stored and distributed.
  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE)
  const libraryKey = ["teacher-library", language]
  const { collapsed, toggle } = useCollapsiblePanel({ userId, scope: "teacher-library" })
  // Same arrow, same order as the class view: the rail folds first, then this.
  const cascade = useLeftSideCascade({
    panelCollapsed: collapsed,
    togglePanel: toggle,
    panelNoun: "library files",
  })

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
  const isWeb = runModelFor(language) === "document"
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [previewDoc, setPreviewDoc] = useState<PreviewBuild | null>(null)
  const [runId, setRunId] = useState(0)
  const {
    status,
    loadError,
    loadErrorDetail,
    awaitingInput,
    interactive,
    run,
    submitInput,
    stop,
    retry,
  } = usePyodide({ enabled: runModelFor(language) === "console" })

  const allFiles = data ? [...data.rootFiles, ...filesInTree(data.folders)] : []
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
    // A rename or delete here also changes what students hold, so any class
    // view already loaded is re-read rather than left showing the old names.
    void mutate((key) => Array.isArray(key) && key[0] === "class-tree")
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Library tree */}
      <CollapsiblePanel
        collapsed={collapsed}
        {...cascade}
        label="My library"
        widthClassName="lg:w-80"
      >
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
                  language={language}
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
                  language={language}
                  classes={classes}
                  selected={selectedId === file.id}
                  onSelect={() => setSelectedId(file.id)}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </div>
      </CollapsiblePanel>

      {/* Editor */}
      <div className="flex min-h-[300px] min-w-0 flex-1 flex-col lg:min-h-0">
        {/* Folding the library away would take the IDE switcher with it, so it
            moves here instead. Rendered outside the selected/empty branches
            below because a teacher must be able to change IDE even with no file
            open — that is exactly when they are looking for the other IDE's work. */}
        {collapsed && (
          <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
            <IdeSwitcher value={language} onChange={setLanguage} />
          </div>
        )}
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
                <ShareMenu
                  fileName={selected.name}
                  files={previewFiles}
                  share={{ kind: "library", fileId: selected.id }}
                />
                <RunStopButton
                  isWeb={isWeb}
                  status={status}
                  onRun={handleRun}
                  onStop={stop}
                  runLabel="Run code"
                  webLabel="Run / Preview"
                />
                <TaskWorkspace
                  key={selected.id}
                  file={selected}
                  language={languageOfFile(selected.name)}
                  onChanged={refresh}
                />
                <DistributeDialog
                  classes={classes}
                  itemName={selected.name}
                  itemKind="file"
                  onConfirm={(classId, recipients) =>
                    distributeFile(selected.id, classId, recipients)
                  }
                />
              </div>
            </div>
            <IdeSplit
              className="flex-1"
              userId={userId}
              scope="teacher-library"
              outputLabel={isWeb ? "Preview" : "Output"}
              allowMaximize={!isWeb}
              revealOn={isWeb ? runId : status === "running"}
              editor={
                <CodeEditor
                  value={draft}
                  onChange={handleChange}
                  mode={editorModeFor(selected.name)}
                />
              }
              output={
                isWeb ? (
                  <HtmlPreview build={previewDoc} runId={runId} />
                ) : (
                  <div className="min-h-0 flex-1">
                    <PythonConsole
                      lines={consoleLines}
                      running={status === "running"}
                      awaitingInput={awaitingInput}
                      interactive={interactive}
                      onSubmitInput={handleSubmitInput}
                      runtimeStatus={status}
                      runtimeError={loadError}
                      runtimeErrorDetail={loadErrorDetail}
                      onRetryRuntime={retry}
                    />
                  </div>
                )
              }
            />
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
  language,
  classes,
  selectedId,
  onSelect,
  onChanged,
}: {
  folder: LibFolder
  language: LanguageId
  classes: ClassOption[]
  selectedId: number | null
  onSelect: (id: number) => void
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isEmpty = folder.files.length === 0 && folder.folders.length === 0

  async function rename(name: string) {
    const result = await renameLibraryFolder(folder.id, name)
    if (result.ok) await onChanged()
    return result
  }

  async function remove() {
    const result = await deleteLibraryFolder(folder.id)
    if (!result.ok) return result.message
    await onChanged()
    toast.success(withdrawnMessage("Folder deleted", result.studentsAffected))
    return null
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
            {countFilesDeep(folder)}
          </Badge>
        </button>
        {canHoldSubfolder(folder.depth) && (
          <NewFolderButton
            language={language}
            parent={folder}
            onDone={onChanged}
            trigger={
              <button
                className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                title="New folder inside this one"
                aria-label={`New folder inside ${folder.name}`}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            }
          />
        )}
        <DistributeDialog
          classes={classes}
          itemName={folder.name}
          itemKind="folder"
          note={
            folder.folders.length > 0
              ? "The folders inside it are sent too, with their files, in the same structure."
              : undefined
          }
          trigger={
            <button
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
              aria-label={`Distribute folder ${folder.name}`}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          }
          onConfirm={(classId, recipients) => distributeFolder(folder.id, classId, recipients)}
        />
        <ItemActionsMenu
          itemName={`folder ${folder.name}`}
          onRename={() => setRenaming(true)}
          onDelete={() => setDeleting(true)}
        />
        <RenameDialog
          open={renaming}
          onOpenChange={setRenaming}
          kind="folder"
          currentName={folder.name}
          note="Students who received this folder will see the new name."
          onRename={rename}
        />
        <DeleteResourceDialog
          open={deleting}
          onOpenChange={setDeleting}
          kind="folder"
          name={folder.name}
          reachKey={`folder-${folder.id}`}
          loadReach={() => getLibraryItemReach("folder", folder.id)}
          onDelete={remove}
        />
      </div>
      {open && (
        <ul className="ml-4 border-l border-border pl-2">
          {isEmpty ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">Empty folder</li>
          ) : (
            <>
              {folder.folders.map((child) => (
                <FolderNode
                  key={child.id}
                  folder={child}
                  language={language}
                  classes={classes}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onChanged={onChanged}
                />
              ))}
              {folder.files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  language={language}
                  classes={classes}
                  selected={selectedId === file.id}
                  onSelect={() => onSelect(file.id)}
                  onChanged={onChanged}
                />
              ))}
            </>
          )}
        </ul>
      )}
    </li>
  )
}

/** Says how many students lost the resource, when any did. */
function withdrawnMessage(done: string, studentsAffected: number) {
  if (studentsAffected === 0) return done
  return `${done} and withdrawn from ${studentsAffected} ${studentsAffected === 1 ? "student" : "students"}`
}

function FileRow({
  file,
  language,
  classes,
  selected,
  onSelect,
  onChanged,
}: {
  file: LibFile
  language: LanguageId
  classes: ClassOption[]
  selected: boolean
  onSelect: () => void
  onChanged: () => Promise<void>
}) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function rename(name: string) {
    const result = await renameLibraryFile(file.id, name)
    if (result.ok) await onChanged()
    return result
  }

  async function remove() {
    const result = await deleteLibraryFile(file.id)
    if (!result.ok) return result.message
    await onChanged()
    toast.success(withdrawnMessage("File deleted", result.studentsAffected))
    return null
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
        itemName={file.name}
        itemKind="file"
        trigger={
          <button
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            aria-label={`Distribute ${file.name}`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        }
        onConfirm={(classId, recipients) => distributeFile(file.id, classId, recipients)}
      />
      <ItemActionsMenu
        itemName={file.name}
        onRename={() => setRenaming(true)}
        onDelete={() => setDeleting(true)}
      />
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        kind="file"
        currentName={file.name}
        language={language}
        note="Students who received this file will see the new name."
        onRename={rename}
      />
      <DeleteResourceDialog
        open={deleting}
        onOpenChange={setDeleting}
        kind="file"
        name={file.name}
        reachKey={`file-${file.id}`}
        loadReach={() => getLibraryItemReach("file", file.id)}
        onDelete={remove}
      />
    </li>
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
  parent,
  trigger,
}: {
  language: LanguageId
  onDone: () => Promise<void>
  /** Set when the new folder goes inside another one. */
  parent?: { id: number; name: string }
  trigger?: React.ReactNode
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
      const result = await createLibraryFolder(name, language, parent?.id ?? null)
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
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New folder" />}
        >
          <FolderPlus className="h-4 w-4" />
        </DialogTrigger>
      )}
      <DialogContent>
        {limitReached ? (
          <LibraryLimitUpgrade
            title="You've reached your free folders"
            description="The free teacher plan includes a single library folder so you can try things out. Upgrade to Teacher Pro to organize your tasks into as many folders as you like."
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{parent ? `New folder in ${parent.name}` : "New folder"}</DialogTitle>
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
              {parent && (
                <p className="text-xs text-muted-foreground">
                  {`This folder will sit inside "${parent.name}" and is sent with it when you distribute.`}
                </p>
              )}
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
                  {folderPaths(folders).map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.path}
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
    `Unlimited classes, up to ${TEACHER_PRO_STUDENT_SEATS} students`,
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
