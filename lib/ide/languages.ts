/**
 * The registry of IDEs MyCodePad offers.
 *
 * Everything language-specific lives here: labels, file extensions, free-tier
 * allowances, editor highlighting and starter content. Server actions, the
 * entitlement engine and the UI all read from this one table, so adding a
 * third language is a matter of adding an entry rather than touching billing,
 * storage and the workspace in turn.
 */

export type LanguageId = "python" | "html"

/** Prism grammar used to highlight a file. */
export type EditorMode = "python" | "markup" | "css" | "javascript"

export type LanguageLimits = {
  /** null means unlimited. */
  maxFiles: number | null
  maxFolders: number | null
}

export type LanguageDef = {
  id: LanguageId
  label: string
  /** Shown under the label in the IDE switcher. */
  blurb: string
  /**
   * Theme token this IDE is coloured with, everywhere it appears: the active
   * workspace tab, and the language cards on the marketing page. Defined once
   * here so the colour a student learns on the landing page is the same one
   * that tells them which IDE they are in.
   */
  accent: string
  /**
   * Extensions this IDE accepts. The first is appended when a student types a
   * bare name, and the whole list is what keeps files out of the wrong tree.
   */
  extensions: string[]
  /** Free-tier allowance, counted per IDE rather than across the account. */
  freeLimits: LanguageLimits
  /** Reserved for future paid-only IDEs. Nothing sets it today. */
  proOnly?: boolean
}

export const LANGUAGES: Record<LanguageId, LanguageDef> = {
  python: {
    id: "python",
    label: "Python",
    blurb: "Run code and see output",
    // Indigo, the product's own primary hue.
    accent: "var(--chart-1)",
    extensions: [".py"],
    freeLimits: { maxFiles: 2, maxFolders: 1 },
  },
  html: {
    id: "html",
    label: "HTML",
    blurb: "Build pages with HTML, CSS & JS",
    // Amber, near HTML5's brand orange and the furthest hue from Python's
    // indigo, so the two IDEs are told apart at a glance rather than read.
    accent: "var(--chart-4)",
    extensions: [".html", ".htm", ".css", ".js"],
    freeLimits: { maxFiles: 3, maxFolders: 1 },
  },
}

/** Display order for the switcher. Python first: it is the original IDE. */
export const LANGUAGE_ORDER: LanguageId[] = ["python", "html"]

/**
 * Python remains the default so every existing student, and every existing
 * row in the database, keeps behaving exactly as it did before HTML existed.
 */
export const DEFAULT_LANGUAGE: LanguageId = "python"

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === "string" && value in LANGUAGES
}

/**
 * Validate untrusted input.
 *
 * Throws rather than falling back, because a silent fallback on a bad value
 * would write a file into the wrong language's tree — the one failure mode
 * this whole design exists to prevent.
 */
export function toLanguageId(value: unknown): LanguageId {
  if (!isLanguageId(value)) throw new Error("Unknown IDE")
  return value
}

export function getLanguage(id: LanguageId): LanguageDef {
  return LANGUAGES[id]
}

/** Lower-cased extension including the dot, or "" when there is none. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot <= 0) return ""
  return fileName.slice(dot).toLowerCase()
}

/** Which language owns an extension, or null if nothing claims it. */
export function languageForExtension(ext: string): LanguageId | null {
  for (const id of LANGUAGE_ORDER) {
    if (LANGUAGES[id].extensions.includes(ext)) return id
  }
  return null
}

/**
 * Highlighting follows the individual file, not the IDE: inside the HTML IDE a
 * .css file should read as CSS.
 */
export function editorModeFor(fileName: string): EditorMode {
  switch (extensionOf(fileName)) {
    case ".css":
      return "css"
    case ".js":
      return "javascript"
    case ".html":
    case ".htm":
      return "markup"
    default:
      return "python"
  }
}

export type NormalisedName =
  | { ok: true; name: string }
  | { ok: false; error: string }

/**
 * Validate and complete a file name for a given IDE.
 *
 * Besides appending a default extension, this is the gate that stops a student
 * typing "notes.py" in the HTML IDE and quietly creating a Python file that
 * the Python IDE would then list.
 */
export function normaliseFileName(input: string, language: LanguageId): NormalisedName {
  const def = LANGUAGES[language]
  const trimmed = input.trim()

  if (!trimmed) return { ok: false, error: "Enter a file name" }

  // Names are stored flat and later used as preview asset keys, so anything
  // that looks like a path is rejected outright.
  if (/[\\/]/.test(trimmed) || trimmed.includes("..")) {
    return { ok: false, error: "File names cannot contain slashes" }
  }

  const ext = extensionOf(trimmed)

  if (!ext) {
    return { ok: true, name: `${trimmed}${def.extensions[0]}` }
  }

  // A name that is nothing but an extension, e.g. ".py".
  if (trimmed.length === ext.length) {
    return { ok: false, error: "Enter a file name" }
  }

  if (def.extensions.includes(ext)) {
    return { ok: true, name: trimmed }
  }

  const owner = languageForExtension(ext)
  if (owner) {
    return {
      ok: false,
      error: `${ext} files belong to the ${LANGUAGES[owner].label} IDE. Switch IDE to create one.`,
    }
  }

  return {
    ok: false,
    error: `${def.label} files use ${def.extensions.join(", ")}`,
  }
}

const PYTHON_STARTER = `# Welcome to your Python file!
# Write code below and press Run to execute it in your browser.

print("Hello, world!")
`

const HTML_STARTER = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>Hello, world!</h1>
    <p>Edit this file and press Run to see your page.</p>

    <script src="script.js"></script>
  </body>
</html>
`

const CSS_STARTER = `/* Styles for your page. Linked from index.html. */

body {
  font-family: system-ui, sans-serif;
  margin: 2rem;
  line-height: 1.5;
}

h1 {
  color: #2563eb;
}
`

const JS_STARTER = `// JavaScript for your page. Linked from index.html.

console.log("Script loaded!");
`

/** Starter content chosen by extension, so every new file opens ready to run. */
export function starterContentFor(fileName: string): string {
  switch (extensionOf(fileName)) {
    case ".html":
    case ".htm":
      return HTML_STARTER
    case ".css":
      return CSS_STARTER
    case ".js":
      return JS_STARTER
    default:
      return PYTHON_STARTER
  }
}
