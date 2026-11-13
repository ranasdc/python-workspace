/**
 * Sizing rules for the editor/output split shared by every IDE.
 *
 * Kept free of React and the DOM so the arithmetic that decides how far a
 * divider may travel can be tested on its own, and so a future IDE gets the
 * same limits by using the same layout component rather than by copying them.
 */

/** Which way the two panes sit: side by side, or one above the other. */
export type SplitAxis = "horizontal" | "vertical"

/** The share of the split given to the output pane on each axis, 0 to 1. */
export type SplitSizes = Record<SplitAxis, number>

export const DEFAULT_SPLIT: SplitSizes = { horizontal: 0.5, vertical: 0.5 }

/**
 * The smallest either pane may be dragged to, in pixels.
 *
 * Wider side by side than stacked: a code line needs room to be read, while a
 * few lines of height are enough to keep a console or an editor usable.
 */
export const MIN_PANE_PX: Record<SplitAxis, { editor: number; output: number }> = {
  horizontal: { editor: 240, output: 220 },
  vertical: { editor: 120, output: 96 },
}

/** Outer bounds that hold whatever the container measures. */
const MIN_FRACTION = 0.1
const MAX_FRACTION = 0.9

/**
 * Keeps the output pane's share inside what both panes can live with.
 *
 * A container too small to honour both minimums falls back to an even split:
 * neither pane can be made usable there, so neither is favoured.
 */
export function clampOutputFraction(
  fraction: number,
  containerPx: number,
  axis: SplitAxis,
): number {
  if (!Number.isFinite(fraction)) return DEFAULT_SPLIT[axis]
  if (!Number.isFinite(containerPx) || containerPx <= 0) {
    return Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, fraction))
  }

  const minimum = MIN_PANE_PX[axis]
  const lowest = Math.max(MIN_FRACTION, minimum.output / containerPx)
  const highest = Math.min(MAX_FRACTION, 1 - minimum.editor / containerPx)
  if (lowest > highest) return 0.5

  return Math.min(highest, Math.max(lowest, fraction))
}

/**
 * The output pane's share when the divider sits under the pointer.
 *
 * The editor is always the leading pane, so everything from the pointer to the
 * far edge belongs to the output.
 */
export function outputFractionAt(pointerPx: number, startPx: number, sizePx: number): number {
  if (!Number.isFinite(sizePx) || sizePx <= 0) return 0.5
  return 1 - (pointerPx - startPx) / sizePx
}

function readFraction(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, value))
}

/**
 * Reads a remembered layout, tolerating anything a browser might hand back:
 * nothing, a value written by an older build, or a string someone edited.
 */
export function parseSplitSizes(raw: string | null | undefined): SplitSizes {
  if (!raw) return { ...DEFAULT_SPLIT }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_SPLIT }
    const record = parsed as Record<string, unknown>
    return {
      horizontal: readFraction(record.horizontal, DEFAULT_SPLIT.horizontal),
      vertical: readFraction(record.vertical, DEFAULT_SPLIT.vertical),
    }
  } catch {
    return { ...DEFAULT_SPLIT }
  }
}

export function serialiseSplitSizes(sizes: SplitSizes): string {
  return JSON.stringify({
    horizontal: Number(sizes.horizontal.toFixed(4)),
    vertical: Number(sizes.vertical.toFixed(4)),
  })
}

/**
 * Where a layout is remembered. The user id is part of the key so two people
 * sharing one browser never inherit each other's proportions.
 */
export function splitStorageKey(userId: string, scope: string): string {
  return `mcp:ide-split:${userId}:${scope}`
}
