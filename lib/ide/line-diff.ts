/**
 * Line-level diff behind the teacher-correction marks.
 *
 * A naive positional comparison is wrong for this job: inserting one line at the
 * top of a file would report every following line as changed and the pupil would
 * see their whole file lit up. So this walks a longest-common-subsequence table
 * and marks only the lines that genuinely differ.
 */

/**
 * Above this, the LCS table stops being worth its memory. School code files are
 * a few dozen lines, so this ceiling is never reached in practice -- it exists
 * so a pasted-in monster file degrades instead of stalling the request.
 */
const MAX_DIFF_LINES = 1200

/**
 * 1-based line numbers in `after` that are new or changed relative to `before`.
 *
 * Deletions are intentionally absent: a removed line has no line left in
 * `after` to mark. The header attribution is what tells the pupil a correction
 * happened; these marks only point at what is now on screen.
 */
export function changedLineNumbers(before: string, after: string): number[] {
  if (before === after) return []

  const a = before.split("\n")
  const b = after.split("\n")

  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    const positional: number[] = []
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== a[i]) positional.push(i + 1)
    }
    return positional
  }

  const m = a.length
  const n = b.length
  const width = n + 1

  // dp[i][j] = length of the LCS of a[i..] and b[j..], filled backwards so the
  // forward walk below can choose the branch that keeps the most lines matched.
  const dp = new Int32Array((m + 1) * width)
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  const changed: number[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      // The pupil's line was dropped; nothing in `after` to mark.
      i++
    } else {
      changed.push(j + 1)
      j++
    }
  }
  while (j < n) {
    changed.push(j + 1)
    j++
  }

  return changed
}

/** Parses the stored JSON column, tolerating anything that is not a clean array. */
export function parseMarkedLines(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
  } catch {
    return []
  }
}
