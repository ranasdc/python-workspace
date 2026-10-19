"use client"

import { useState } from "react"
import { Check, Download, Link2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collectAssociatedFiles, type PreviewFile } from "@/lib/ide/html-document"
import { buildShareUrl, type ShareParams } from "@/lib/ide/share-link"
import { createZip } from "@/lib/ide/zip"
import { cn } from "@/lib/utils"

/**
 * The share control every IDE toolbar carries.
 *
 * It is deliberately language-agnostic: what comes out of "Download" is decided
 * by `collectAssociatedFiles`, so a new IDE gets working downloads by passing
 * its files in rather than by adding a case here.
 */
export function ShareMenu({
  fileName,
  files,
  linkPath,
  linkParams,
  className,
}: {
  /** The file the menu acts on — the one open in the editor. */
  fileName: string
  /**
   * Every file in the workspace, carrying the live draft for the file being
   * edited. A page needs its siblings in scope so it can take its stylesheet
   * and script with it.
   */
  files: PreviewFile[]
  /** Route the copied link should open. Omit to leave the link action out. */
  linkPath?: string
  linkParams?: ShareParams
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const bundle = collectAssociatedFiles(files, fileName)
  // The file itself is always first, so anything after it is a sibling the
  // page pulls in.
  const extras = Math.max(bundle.length - 1, 0)

  async function copyLink() {
    if (!linkPath) return
    const url = buildShareUrl(linkPath, linkParams ?? {})

    if (!(await writeToClipboard(url))) {
      toast.error("Your browser blocked clipboard access, so the link wasn't copied")
      return
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast.success("Link copied", {
      description: "Anyone who can already open this file will land straight on it.",
    })
  }

  function download() {
    if (bundle.length === 0) {
      toast.error("There is nothing to download yet")
      return
    }

    if (bundle.length === 1) {
      const only = bundle[0]
      saveBlob(new Blob([only.content], { type: "text/plain;charset=utf-8" }), only.name)
      toast.success(`Downloaded ${only.name}`)
      return
    }

    saveBlob(createZip(bundle), `${baseName(fileName)}.zip`)
    toast.success(`Downloaded ${bundle.length} files`, {
      description: bundle.map((f) => f.name).join(", "),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            title={`Share ${fileName}`}
            /* Teal sets it apart from the amber task button and the blue Run
               beside it, while staying inside the same tinted-outline family. */
            className={cn(
              "border-chart-2/40 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2",
              className,
            )}
          />
        }
      >
        <Share2 className="mr-1.5 h-4 w-4" /> Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {extras === 0
              ? "This file on its own"
              : `With ${extras} linked file${extras === 1 ? "" : "s"}`}
          </p>
        </div>
        <DropdownMenuSeparator />
        {linkPath && (
          <DropdownMenuItem onClick={copyLink}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-chart-3" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            {copied ? "Link copied" : "Copy link to file"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={download}>
          <Download className="mr-2 h-4 w-4" />
          {bundle.length > 1 ? `Download ${bundle.length} files (.zip)` : "Download file"}
        </DropdownMenuItem>
        {extras > 0 && (
          <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground text-pretty">
            Includes {bundle.slice(1).map((f) => f.name).join(", ")}.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "index.html" becomes "index", so the archive is named after the page. */
function baseName(name: string) {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking straight away cancels the download in some browsers, so the URL
  // is held just long enough for it to start.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function writeToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Falls through to the selection route below, which still works where the
    // clipboard permission is withheld — common on locked-down school devices.
  }

  try {
    const field = document.createElement("textarea")
    field.value = text
    field.setAttribute("readonly", "")
    field.style.position = "fixed"
    field.style.opacity = "0"
    document.body.appendChild(field)
    field.select()
    // Deprecated, but the only copy route left once the async clipboard API
    // is blocked.
    const copied = document.execCommand("copy")
    field.remove()
    return copied
  } catch {
    return false
  }
}
