/**
 * Deciding whether a stored solution still answers the task it was written
 * for.
 *
 * A solution is generated against one wording of a brief. If the teacher later
 * changes "use a FOR loop" to "use a WHILE loop" the stored solution silently
 * becomes the wrong answer, and nothing in the task row would say so. This
 * module is the single judgement of that, shared by the authoring UI (which
 * warns live, as the teacher types) and the save path (which stores the
 * snapshot the next comparison is made against).
 *
 * It is deliberately a heuristic and deliberately non-blocking: the worst case
 * either way is a warning the teacher dismisses, so it is tuned to catch
 * meaning changes rather than to be exactly right about prose.
 *
 * Language-independent by construction — it compares words, never syntax — so
 * it serves a Python task, an HTML task and whatever IDE is added next.
 */

/** Identifier-ish runs. Punctuation and markup are noise for this comparison. */
const WORD = /[a-z0-9_]+/g

/**
 * Words that carry the *instruction* in a programming brief rather than its
 * phrasing. Swapping any one of them rewrites the exercise even when the
 * sentence around it barely moves, so a change to this set is treated as
 * material however small the edit looks.
 *
 * Shared across languages on purpose: a term that means nothing for one IDE
 * simply never appears in its tasks.
 */
const MEANING_WORDS = new Set([
  // Control flow and structure
  "for", "while", "loop", "repeat", "if", "else", "elif", "switch", "case",
  "function", "def", "method", "class", "recursion", "recursive", "nested",
  "try", "except", "catch", "finally", "break", "continue", "return",
  // Data
  "list", "array", "dictionary", "dict", "tuple", "set", "string", "integer",
  "int", "float", "boolean", "bool", "variable", "constant", "parameter",
  "argument", "index", "slice", "key", "value",
  // Common operations
  "input", "output", "print", "range", "append", "sort", "reverse", "sum",
  "average", "mean", "count", "min", "max", "random", "length", "len",
  "read", "write", "file", "import", "concatenate", "split", "join",
  "uppercase", "lowercase", "round",
  // Web
  "html", "css", "javascript", "flexbox", "grid", "table", "form", "button",
  "image", "link", "heading", "paragraph", "nav", "header", "footer",
  "section", "selector", "hover", "animation", "responsive", "media", "query",
  "attribute", "element", "tag", "stylesheet", "script", "event", "click",
])

/**
 * The comparable form of a task: lower-cased words only, so reformatting,
 * punctuation and whitespace changes are not mistaken for edits.
 *
 * The result is what gets stored as `solutionFingerprint`. Keeping the words
 * rather than a hash is what allows the word-level comparison below, and a
 * task is small enough that the storage is not worth optimising away.
 */
export function taskFingerprint(title: string, instructions: string): string {
  return (`${title}\n${instructions}`.toLowerCase().match(WORD) ?? []).join(" ")
}

function tally(words: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
  return counts
}

/** Overlap of two word bags, 0 (nothing shared) to 1 (identical). */
function similarity(before: string[], after: string[]): number {
  const a = tally(before)
  const b = tally(after)
  let shared = 0
  let total = 0
  for (const word of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(word) ?? 0
    const y = b.get(word) ?? 0
    shared += Math.min(x, y)
    total += Math.max(x, y)
  }
  return total === 0 ? 1 : shared / total
}

function meaningWordsIn(words: string[]): Set<string> {
  return new Set(words.filter((word) => MEANING_WORDS.has(word)))
}

/**
 * Below this, the brief has been reworked enough that the old answer should be
 * questioned. Set high because a solution that quietly stops matching is a
 * worse failure than a warning a teacher waves away.
 */
const SIMILARITY_FLOOR = 0.95

/**
 * Whether the solution recorded against `fingerprint` may no longer match the
 * task as it now reads.
 *
 * Returns false when there is nothing to compare — a task with no recorded
 * fingerprint (every task written before solutions existed) is never accused
 * of being out of date.
 */
export function isSolutionStale(
  fingerprint: string | null | undefined,
  title: string,
  instructions: string,
): boolean {
  if (!fingerprint) return false

  const current = taskFingerprint(title, instructions)
  if (current === fingerprint) return false

  const before = fingerprint.split(" ").filter(Boolean)
  const after = current.split(" ").filter(Boolean)

  const wasMeaning = meaningWordsIn(before)
  const nowMeaning = meaningWordsIn(after)
  if (wasMeaning.size !== nowMeaning.size) return true
  for (const word of nowMeaning) {
    if (!wasMeaning.has(word)) return true
  }

  return similarity(before, after) < SIMILARITY_FLOOR
}
