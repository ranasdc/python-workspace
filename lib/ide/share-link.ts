/**
 * The query parameters a copied "link to file" carries, and the helpers that
 * read them back when someone opens one.
 *
 * A file id on its own is not enough to reopen a file. The trees that hold it
 * are keyed on the class and the IDE, and a teacher's dashboard also has to
 * know whether the file lives in a class or in their library — so the link
 * names all of that alongside the id.
 *
 * The link grants no access of its own: opening it still goes through the
 * normal session and ownership checks, so it only ever works for someone who
 * could already reach the file.
 */

export const SHARE_PARAM = {
  file: "file",
  class: "class",
  student: "student",
  ide: "ide",
  view: "view",
} as const

export type ShareParamName = keyof typeof SHARE_PARAM

export type ShareParams = Partial<Record<ShareParamName, string | number | null | undefined>>

/**
 * Built at click time rather than during render: reading `window.location`
 * while rendering would disagree between the server and the client and break
 * hydration.
 */
export function buildShareUrl(path: string, params: ShareParams) {
  const url = new URL(path, window.location.origin)
  for (const [name, value] of Object.entries(params) as [ShareParamName, unknown][]) {
    if (value === null || value === undefined || value === "") continue
    url.searchParams.set(SHARE_PARAM[name], String(value))
  }
  return url.toString()
}

/** Client-only; returns null while server rendering. */
export function readShareParam(name: ShareParamName): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get(SHARE_PARAM[name])
}

/** The numeric form of a share parameter, or null when absent or malformed. */
export function readShareId(name: ShareParamName): number | null {
  const raw = readShareParam(name)
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Strips the parameters once they have been read. Without this the target
 * would still be sitting in the URL later, so changing class by hand could
 * suddenly re-open the linked file, and copying the address bar would hand on
 * stale state.
 */
export function clearShareParams() {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  let changed = false
  for (const name of Object.values(SHARE_PARAM)) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name)
      changed = true
    }
  }
  if (changed) {
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }
}
