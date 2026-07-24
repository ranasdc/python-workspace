"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { CodeEditor } from "@/components/code-editor"
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
import { cn } from "@/lib/utils"
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
} from "lucide-react"

type LibFile = {
  id: number
  teacherId: string
  folderId: number | null
  name: string
  content: string
  createdAt: Date
  updatedAt: Date
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
  const { data } = useSWR<LibraryData>("teacher-library", getLibrary, {
    revalidateOnFocus: false,
  })
  const { mutate } = useSWRConfig()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allFiles = data ? [...data.rootFiles, ...data.folders.flatMap((f) => f.files)] : []
  const selected = allFiles.find((f) => f.id === selectedId) ?? null

  useEffect(() => {
    if (selected) {
      setDraft(selected.content)
      setSaveState("idle")
    }
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
    await mutate("teacher-library")
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr]">
      {/* Library tree */}
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Library className="h-3.5 w-3.5" />
            My library
          </span>
          <div className="flex items-center gap-1">
            <NewFolderButton onDone={refresh} />
            <NewFileButton folders={data?.folders ?? []} onDone={refresh} onCreated={setSelectedId} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {data === undefined ? (
            <p className="px-2 text-sm text-muted-foreground">Loading library...</p>
          ) : data.folders.length === 0 && data.rootFiles.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground text-pretty">
              Create a folder or file to build reusable tasks, then distribute them to a class or a
              single student.
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
              <DistributeDialog
                classes={classes}
                label={`Distribute ${selected.name}`}
                onConfirm={(classId, studentId) => distributeFile(selected.id, classId, studentId)}
              />
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor value={draft} onChange={handleChange} />
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
        <button
          onClick={remove}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label={`Delete folder ${folder.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
      <button
        onClick={remove}
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label={`Delete ${file.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function NewFolderButton({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createLibraryFolder(name)
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
      </DialogContent>
    </Dialog>
  )
}

function NewFileButton({
  folders,
  onDone,
  onCreated,
}: {
  folders: LibFolder[]
  onDone: () => Promise<void>
  onCreated: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [folderId, setFolderId] = useState<string>("root")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const created = await createLibraryFile(name, folderId === "root" ? null : Number(folderId))
      setName("")
      await onDone()
      onCreated(created.id)
      setOpen(false)
      toast.success(`Created ${created.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="New file" />}
      >
        <Plus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task file</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="libfilename">File name</Label>
            <Input
              id="libfilename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="exercise_1.py"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
              }}
              autoFocus
            />
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
      </DialogContent>
    </Dialog>
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
