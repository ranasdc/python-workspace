"use client"

import { useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { highlightCode } from "@/components/code-editor"
import { saveBlob } from "@/lib/ide/download"
import { editorModeFor } from "@/lib/ide/languages"
import { codeImage, screenshotFileName } from "@/lib/ide/screenshot"
import { cn } from "@/lib/utils"

/**
 * The camera control every IDE surface carries.
 *
 * It knows nothing about what it is photographing: `capture` produces the
 * image and this saves it to the device. A new kind of output gets a working
 * screenshot by supplying its own `capture`.
 */
export function ScreenshotButton({
  label,
  fileName,
  capture,
  disabled = false,
  size = "md",
  className,
}: {
  /** Says what will be captured; used as the tooltip and the accessible name. */
  label: string
  /** Name the image is saved under. */
  fileName: string
  capture: () => Promise<Blob>
  disabled?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"

  async function shoot() {
    if (busy) return
    setBusy(true)
    try {
      saveBlob(await capture(), fileName)
      toast.success("Screenshot saved", { description: fileName })
    } catch (error) {
      toast.error("Couldn't take the screenshot", {
        description: error instanceof Error && error.message ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void shoot()}
      disabled={disabled || busy}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded p-1 transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {busy ? (
        <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden="true" />
      ) : (
        <Camera className={iconClass} aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/**
 * Screenshot of a whole file, including the lines scrolled out of view.
 *
 * Takes the code rather than a handle on the editor, so it can sit in a toolbar
 * well away from the editor it describes.
 */
export function CodeScreenshotButton({
  fileName,
  code,
  className,
}: {
  fileName: string
  code: string
  className?: string
}) {
  // Blank lines trailing the last line of code are not part of "the code".
  const trimmed = code.replace(/\s+$/, "")
  const mode = editorModeFor(fileName)

  return (
    <ScreenshotButton
      label={`Download a screenshot of the code in ${fileName}`}
      fileName={screenshotFileName(fileName, "code")}
      capture={() => codeImage(highlightCode(trimmed, mode), mode)}
      disabled={!trimmed}
      className={className}
    />
  )
}
