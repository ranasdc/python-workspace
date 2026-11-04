/**
 * Where the Python runtime is loaded from, in one place.
 *
 * Some school networks block cdn.jsdelivr.net outright because they classify
 * the whole domain as a content delivery service. When that happens the IDE
 * cannot start Python at all, so the source has to be swappable without
 * touching the worker, the hook, or any component.
 */

/**
 * Pinned deliberately. The loader, the Emscripten glue, the WebAssembly binary
 * and the stdlib archive are built together and are not interchangeable
 * between releases, so this version must match the hosted asset directory
 * exactly. Changing it means re-mirroring every file in PYODIDE_RUNTIME_FILES.
 */
export const PYODIDE_VERSION = "0.26.4"

/** The public CDN, used unless an override is configured. */
export const PYODIDE_CDN_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

/**
 * Every file Pyodide 0.26.4 fetches to reach a working interpreter, taken from
 * the loader's own source rather than assumed: pyodide.js resolves
 * `${indexURL}pyodide.asm.js`, and the glue then fetches the wasm binary, the
 * stdlib archive and the lockfile from the same directory.
 *
 * Hosting pyodide.js alone does not work — it would simply fetch the remaining
 * four files from wherever indexURL points, which is the blocked CDN again.
 *
 * Sizes are the uncompressed bytes served by jsDelivr for v0.26.4 and are used
 * by scripts/fetch-pyodide-runtime.mjs to verify a complete mirror.
 */
export const PYODIDE_RUNTIME_FILES = [
  { name: "pyodide.js", bytes: 14_761, role: "Loader entry point" },
  { name: "pyodide.asm.js", bytes: 1_229_099, role: "Emscripten glue" },
  { name: "pyodide.asm.wasm", bytes: 10_088_051, role: "CPython WebAssembly binary" },
  { name: "python_stdlib.zip", bytes: 2_341_872, role: "Python standard library" },
  { name: "pyodide-lock.json", bytes: 106_335, role: "Package lockfile, read during init" },
] as const

/** Roughly 13.8 MB uncompressed for a complete runtime. */
export const PYODIDE_RUNTIME_BYTES = PYODIDE_RUNTIME_FILES.reduce((sum, f) => sum + f.bytes, 0)

/**
 * The runtime source. Set NEXT_PUBLIC_PYODIDE_INDEX_URL to a directory holding
 * the files above — for example https://mycodepad.com/pyodide/v0.26.4/full/ or
 * the same-origin /pyodide/v0.26.4/full/ — to serve Python from a domain the
 * school already trusts. Unset, it falls back to the CDN that works today.
 *
 * A trailing slash is required by Pyodide's indexURL, so it is added here
 * rather than relying on whoever sets the variable to remember.
 */
export function getPyodideIndexURL(): string {
  const configured = process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL?.trim()
  if (!configured) return PYODIDE_CDN_INDEX_URL
  return configured.endsWith("/") ? configured : `${configured}/`
}

/**
 * Budget for fetching pyodide.js, which is only ~15 KB.
 *
 * Nothing else can load if this does not arrive, so a short budget turns a
 * blocked or black-holed request into a clear message quickly instead of an
 * endless spinner. A filtering proxy that drops packets silently is exactly
 * the case a plain error handler never catches.
 */
export const PYODIDE_LOADER_TIMEOUT_MS = 20_000

/**
 * Budget for the remaining ~13.7 MB once the loader has arrived.
 *
 * Deliberately generous: a slow school connection is not a failure, and timing
 * out a download that is still progressing would be a worse bug than the one
 * being fixed here.
 */
export const PYODIDE_RUNTIME_TIMEOUT_MS = 120_000

/** Shown when the runtime cannot be reached at all. */
export const PYODIDE_BLOCKED_MESSAGE =
  "Python could not be loaded. Your school network or browser may be blocking a required Python runtime resource. Please contact your IT administrator or try again."

/** Shown when the device itself is offline, which is not an IT problem. */
export const PYODIDE_OFFLINE_MESSAGE =
  "Python could not be loaded because your device is offline. Reconnect to the internet and try again."

/** Shown when the download starts but never finishes. */
export const PYODIDE_TIMEOUT_MESSAGE =
  "Python is taking too long to load. Your connection may be slow or a required runtime file may be blocked. Please try again, or contact your IT administrator if this keeps happening."
