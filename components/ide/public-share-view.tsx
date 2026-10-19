"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Code2, Download, Eye } from "lucide-react"
import { toast } from "sonner"

import { CodeEditor } from "@/components/code-editor"
import { HtmlPreview } from "@/components/ide/html-preview"
import { PythonConsole, type ConsoleLine } from "@/components/python-console"
import { RunStopButton } from "@/components/run-stop-button"
import { Button } from "@/components/ui/button"
import { usePyodide } from "@/hooks/use-pyodide"
import { downloadBundle } from "@/lib/ide/download"
import { buildPreviewDocument, type PreviewFile } from "@/lib/ide/html-document"
import { editorModeFor, runModelFor, type LanguageId } from "@/lib/ide/languages"
import { cn } from "@/lib/utils"

type ShareProps = {
  /** The shared file. Always the first entry in `bundle`. */
  fileName: string
  /** Which IDE the file came from, which decides how a viewer runs it. */
  language: LanguageId
  /** The shared file, then only the siblings it actually references. */
  bundle: PreviewFile[]
}

/**
 * The body of a public share page.
 *
 * A share link has to show the work *working*, not just its source — so what
 * sits beside the code is whatever this IDE's run model calls for: a rendered
 * page for `document`, a Run button and an output console for `console`. The
 * viewer needs no account, no install and no local Python.
 *
 * The code itself is always read-only, shown in the same editor the IDE uses so
 * it keeps its highlighting and line numbers rather than becoming a plain block.
 */
export function PublicShareView({ fileName, language, bundle }: ShareProps) {
  const runModel = runModelFor(language)

  // Split per model because each owns different hooks — only a console share
  // should mount (and therefore download) the Python runtime.
  switch (runModel) {
    case "document":
      return <DocumentShare fileName={fileName} bundle={bundle} />
    case "console":
      return <ConsoleShare fileName={fileName} bundle={bundle} />
    default: {
      // Makes a new run model a compile error here rather than a share page
      // that quietly shows source and no way to run it.
      const unhandled: never = runModel
      throw new Error(`No share view for run model ${String(unhandled)}`)
    }
  }
}

type PaneProps = { fileName: string; bundle: PreviewFile[] }

/**
 * A share whose files compose into a page. The preview renders immediately:
 * someone opening the link came to see the page, not to press a button first.
 */
function DocumentShare({ fileName, bundle }: PaneProps) {
  const build = useMemo(() => buildPreviewDocument(bundle, fileName), [bundle, fileName])
  // A stylesheet shared on its own belongs to this model but has no page to
  // render, so it falls back to showing only itself.
  const renderable = build !== null

  const [mode, setMode] = useState<"preview" | "code">(renderable ? "preview" : "code")
  const [openName, setOpenName] = useState(fileName)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renderable ? (
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="What to show"
          >
            <ModeButton
              icon={Eye}
              label="Preview"
              active={mode === "preview"}
              onClick={() => setMode("preview")}
            />
            <ModeButton
              icon={Code2}
              label="Code"
              active={mode === "code"}
              onClick={() => setMode("code")}
            />
          </div>
        ) : (
          <span />
        )}

        <DownloadButton fileName={fileName} bundle={bundle} />
      </div>

      {mode === "preview" && renderable ? (
        <div className="h-[70vh] min-h-[22rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* runId is fixed: nothing on this page can trigger a re-run. */}
          <HtmlPreview build={build} runId={0} />
        </div>
      ) : (
        <Pane className="h-[70vh] min-h-[22rem]">
          <FileTabs bundle={bundle} openName={openName} onOpen={setOpenName} />
          <EditorPane bundle={bundle} openName={openName} />
        </Pane>
      )}
    </div>
  )
}

/**
 * A share whose file is executed. The runtime is fetched on mount so Run is
 * ready when the viewer is, and the console both prints output and takes the
 * lines an `input()` call asks for — the shared program runs end to end in the
 * viewer's own browser, with nothing to install.
 */
function ConsoleShare({ fileName, bundle }: PaneProps) {
  const [openName, setOpenName] = useState(fileName)
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const { status, loadError, awaitingInput, interactive, run, submitInput, stop } = usePyodide()

  const open = bundle.find((f) => f.name === openName) ?? bundle[0]

  async function handleRun() {
    setLines([])
    await run(open.content, (text, kind) => setLines((prev) => [...prev, { text, kind }]))
  }

  function handleSubmitInput(text: string) {
    // Echo the typed line so the transcript reads the way the program ran.
    setLines((prev) => [...prev, { text: text + "\n", kind: "in" }])
    submitInput(text)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <RunStopButton
            isWeb={false}
            status={status}
            onRun={handleRun}
            onStop={stop}
            runLabel="Run"
            webLabel="Preview"
          />
          <p className="text-sm text-muted-foreground">Runs in your browser — nothing to install.</p>
        </div>

        <DownloadButton fileName={fileName} bundle={bundle} />
      </div>

      <div className="grid min-h-0 gap-4 lg:h-[70vh] lg:grid-cols-2">
        <Pane className="h-[50vh] lg:h-auto">
          <FileTabs
            bundle={bundle}
            openName={openName}
            onOpen={(name) => {
              setOpenName(name)
              // Output belongs to the file that produced it.
              setLines([])
            }}
          />
          <EditorPane bundle={bundle} openName={openName} />
        </Pane>

        <Pane className="h-[32vh] lg:h-auto">
          <PythonConsole
            lines={
              loadError
                ? [{ text: `Failed to load Python runtime: ${loadError}`, kind: "err" }]
                : lines
            }
            running={status === "running"}
            awaitingInput={awaitingInput}
            interactive={interactive}
            onSubmitInput={handleSubmitInput}
          />
        </Pane>
      </div>
    </div>
  )
}

function Pane({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

function EditorPane({ bundle, openName }: { bundle: PreviewFile[]; openName: string }) {
  const open = bundle.find((f) => f.name === openName) ?? bundle[0]

  return (
    <div className="min-h-0 flex-1">
      <CodeEditor
        // Remounted per file so the editor starts at the top of each one rather
        // than keeping the previous file's scroll position.
        key={open.name}
        value={open.content}
        mode={editorModeFor(open.name)}
        readOnly
      />
    </div>
  )
}

function FileTabs({
  bundle,
  openName,
  onOpen,
}: {
  bundle: PreviewFile[]
  openName: string
  onOpen: (name: string) => void
}) {
  if (bundle.length < 2) return null

  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5"
      role="group"
      aria-label="Files in this share"
    >
      {bundle.map((file) => (
        <button
          key={file.name}
          type="button"
          onClick={() => onOpen(file.name)}
          aria-pressed={file.name === openName}
          className={cn(
            "shrink-0 rounded px-2.5 py-1 font-mono text-xs transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            file.name === openName
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {file.name}
        </button>
      ))}
    </div>
  )
}

function DownloadButton({ fileName, bundle }: PaneProps) {
  function download() {
    const result = downloadBundle(bundle, fileName)
    if (!result.saved) {
      toast.error("There is nothing to download")
      return
    }
    toast.success(
      result.zipped ? `Downloaded ${result.names.length} files` : `Downloaded ${result.names[0]}`,
      { description: result.zipped ? result.names.join(", ") : undefined },
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="mr-1.5 h-4 w-4" />
      {bundle.length > 1 ? `Download ${bundle.length} files (.zip)` : "Download file"}
    </Button>
  )
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Eye
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}
