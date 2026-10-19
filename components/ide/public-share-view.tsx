"use client"

import { useMemo, useState } from "react"
import { Code2, Download, Eye } from "lucide-react"
import { toast } from "sonner"

import { CodeEditor } from "@/components/code-editor"
import { HtmlPreview } from "@/components/ide/html-preview"
import { Button } from "@/components/ui/button"
import { downloadBundle } from "@/lib/ide/download"
import { buildPreviewDocument, type PreviewFile } from "@/lib/ide/html-document"
import { editorModeFor } from "@/lib/ide/languages"
import { cn } from "@/lib/utils"

type Mode = "preview" | "code"

/**
 * The body of a public share page: the shared file's code, the sibling files it
 * links to, and — for a page that can be rendered — a live preview of it.
 *
 * Everything here is read-only. The editor is the same component the IDE uses,
 * with `readOnly` set, so shared code is syntax-highlighted and line-numbered
 * exactly as its author saw it rather than dumped into a plain block.
 */
export function PublicShareView({
  fileName,
  bundle,
}: {
  /** The shared file. Always the first entry in `bundle`. */
  fileName: string
  /** The shared file, then only the siblings it actually references. */
  bundle: PreviewFile[]
}) {
  const build = useMemo(() => buildPreviewDocument(bundle, fileName), [bundle, fileName])
  // Only an HTML page has something to render; a stylesheet or a Python file
  // has nothing to show but itself.
  const renderable = build !== null

  const [mode, setMode] = useState<Mode>(renderable ? "preview" : "code")
  const [openName, setOpenName] = useState(fileName)

  const open = bundle.find((f) => f.name === openName) ?? bundle[0]

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

        <Button variant="outline" size="sm" onClick={download}>
          <Download className="mr-1.5 h-4 w-4" />
          {bundle.length > 1 ? `Download ${bundle.length} files (.zip)` : "Download file"}
        </Button>
      </div>

      {mode === "preview" && renderable ? (
        <div className="h-[70vh] min-h-[22rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* runId is fixed: nothing on this page can trigger a re-run. */}
          <HtmlPreview build={build} runId={0} />
        </div>
      ) : (
        <div className="flex h-[70vh] min-h-[22rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {bundle.length > 1 && (
            <div
              className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5"
              role="group"
              aria-label="Files in this share"
            >
              {bundle.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setOpenName(file.name)}
                  aria-pressed={file.name === open.name}
                  className={cn(
                    "shrink-0 rounded px-2.5 py-1 font-mono text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    file.name === open.name
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <CodeEditor
              // Remounted per file so the editor starts at the top of each one
              // rather than keeping the previous file's scroll position.
              key={open.name}
              value={open.content}
              mode={editorModeFor(open.name)}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
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
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}
