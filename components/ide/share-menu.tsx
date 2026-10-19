"use client"

import { useCallback, useState } from "react"
import { Check, Download, Globe, Link2Off, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getFileShare, publishFile, unpublishFile, type ShareTarget } from "@/app/actions/shares"
import { collectAssociatedFiles, type PreviewFile } from "@/lib/ide/html-document"
import { downloadBundle } from "@/lib/ide/download"
import { shareUrl } from "@/lib/ide/share-link"
import { cn } from "@/lib/utils"

/**
 * The share control every IDE toolbar carries.
 *
 * It is deliberately language-agnostic: what comes out of "Download" is decided
 * by `collectAssociatedFiles`, so a new IDE gets working downloads by passing
 * its files in rather than by adding a case here.
 *
 * The link it copies is public — anyone holding it can read the file without an
 * account — so it is only offered for files the signed-in user owns, and the
 * menu says so in as many words before they copy it.
 */
export function ShareMenu({
  fileName,
  files,
  share,
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
  /**
   * The file as the server knows it. Omit to leave the public link out
   * entirely, which is what the teacher's review view does: a pupil's work is
   * the pupil's to publish.
   */
  share?: ShareTarget
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  // undefined = not looked up yet, null = looked up and not published.
  const [token, setToken] = useState<string | null | undefined>(undefined)

  const bundle = collectAssociatedFiles(files, fileName)
  // The file itself is always first, so anything after it is a sibling the
  // page pulls in.
  const extras = Math.max(bundle.length - 1, 0)

  // Looked up when the menu opens so it can offer "stop sharing" for a file
  // that is already public, and so the common case — copying a link that
  // already exists — needs no round trip and stays inside the click gesture.
  const loadStatus = useCallback(
    async (open: boolean) => {
      if (!open || !share || token !== undefined) return
      const result = await getFileShare(share)
      setToken(result.ok ? result.token : null)
    },
    [share, token],
  )

  function confirmCopied(url: string, created: boolean) {
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast.success(created ? "Public link created and copied" : "Public link copied", {
      description: url,
    })
  }

  async function copyLink() {
    if (!share || busy) return

    // Already published: copy straight away, with no await before the clipboard
    // call. Safari drops the clipboard permission once the click gesture has
    // been handed off to a promise, so this path matters.
    if (token) {
      const url = shareUrl(token)
      if (await writeToClipboard(url)) confirmCopied(url, false)
      else reportCopyFailure(url)
      return
    }

    setBusy(true)
    try {
      const result = await publishFile(share)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      if (!result.token) {
        toast.error("Couldn't create a link. Try again.")
        return
      }

      setToken(result.token)
      const url = shareUrl(result.token)
      if (await writeToClipboard(url)) confirmCopied(url, true)
      else reportCopyFailure(url)
    } finally {
      setBusy(false)
    }
  }

  async function stopSharing() {
    if (!share || busy) return
    setBusy(true)
    try {
      const result = await unpublishFile(share)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setToken(null)
      toast.success("Link turned off", {
        description: "Anyone opening the old link now sees nothing.",
      })
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const result = downloadBundle(bundle, fileName)
    if (!result.saved) {
      toast.error("There is nothing to download yet")
      return
    }

    if (!result.zipped) {
      toast.success(`Downloaded ${result.names[0]}`)
      return
    }

    toast.success(`Downloaded ${result.names.length} files`, {
      description: result.names.join(", "),
    })
  }

  return (
    <DropdownMenu onOpenChange={loadStatus}>
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
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {extras === 0
              ? "This file on its own"
              : `With ${extras} linked file${extras === 1 ? "" : "s"}`}
          </p>
        </div>
        <DropdownMenuSeparator />
        {share && (
          <>
            <DropdownMenuItem
              // The menu stays open so the item can turn into "Link copied" and
              // "Stop sharing" can appear underneath it. Closing would unmount
              // both mid-await and leave the click with nothing to show for it.
              closeOnClick={false}
              onClick={() => void copyLink()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : copied ? (
                <Check className="mr-2 h-4 w-4 text-chart-3" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              {copied ? "Link copied" : "Copy link to file"}
            </DropdownMenuItem>
            <p className="px-2 pb-1 pl-8 text-[11px] leading-tight text-muted-foreground text-pretty">
              Public link — visible to anyone, no sign-in needed.
            </p>
            {token && (
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => void stopSharing()}
                disabled={busy}
                className="text-muted-foreground"
              >
                <Link2Off className="mr-2 h-4 w-4" />
                Stop sharing
              </DropdownMenuItem>
            )}
          </>
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

/**
 * Copying can fail outright on locked-down devices, so the link is shown in a
 * toast the user can select by hand rather than lost with an apology.
 */
function reportCopyFailure(url: string) {
  toast.warning("Your browser blocked copying, so here is the link", {
    description: url,
    duration: 12_000,
  })
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
