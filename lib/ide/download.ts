/**
 * Saving a file bundle to disk from the browser.
 *
 * Shared by the IDE's share menu and the public share page so both produce
 * byte-identical downloads: a lone file is saved as itself, and a page that
 * pulls in a stylesheet or a script is saved as a zip of the whole set.
 */

import type { PreviewFile } from "@/lib/ide/html-document"
import { createZip } from "@/lib/ide/zip"

/** "index.html" becomes "index", so an archive is named after the page. */
export function baseName(name: string) {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

export function saveBlob(blob: Blob, filename: string) {
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

/**
 * Save `bundle` under a name derived from `fileName`, zipping only when there
 * is more than one file. Returns what happened so the caller can word its own
 * confirmation.
 */
export function downloadBundle(
  bundle: PreviewFile[],
  fileName: string,
): { saved: false } | { saved: true; zipped: boolean; names: string[] } {
  if (bundle.length === 0) return { saved: false }

  if (bundle.length === 1) {
    const only = bundle[0]
    saveBlob(new Blob([only.content], { type: "text/plain;charset=utf-8" }), only.name)
    return { saved: true, zipped: false, names: [only.name] }
  }

  saveBlob(createZip(bundle), `${baseName(fileName)}.zip`)
  return { saved: true, zipped: true, names: bundle.map((f) => f.name) }
}
