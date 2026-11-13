/**
 * Screenshots of an IDE's code and of what that code produced.
 *
 * Nothing here photographs the screen. Code and console text are laid out again
 * on a canvas from the text itself, and a previewed page is re-rendered from its
 * own markup — which is what lets an image cover the whole file, transcript or
 * page rather than only the part scrolled into view.
 *
 * Colours and fonts are read from the page's stylesheet at capture time, so an
 * image always matches the editor theme without a second palette to keep in step.
 *
 * Every IDE gets all of this through the shared ScreenshotButton. An IDE with a
 * new kind of output only has to say how that output becomes a Blob.
 */

import { baseName } from "@/lib/ide/download"

export type ScreenshotPart = "code" | "output" | "preview"

/** "L1.py" + "output" becomes "L1-output.png". */
export function screenshotFileName(fileName: string | null | undefined, part: ScreenshotPart) {
  const stem = fileName ? baseName(fileName.trim()) : ""
  return stem ? `${stem}-${part}.png` : `${part}.png`
}

export type TextRun = { text: string; color: string; font: string }
export type TextFragment = TextRun & { x: number; row: number }
export type MeasureText = (text: string, font: string) => number

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff
}

/** How many leading characters of `text` fit in `room`, never splitting an emoji. */
function fittingLength(text: string, font: string, room: number, measure: MeasureText) {
  let low = 0
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (measure(text.slice(0, middle), font) <= room) low = middle
    else high = middle - 1
  }
  if (low > 0 && low < text.length && isHighSurrogate(text.charCodeAt(low - 1))) low -= 1
  return low
}

/**
 * Position every run of text on a grid of rows.
 *
 * Tabs advance to the next tab stop the way CSS `tab-size` does, and a line
 * wider than `wrapAt` continues on the next row the way a terminal wraps.
 */
export function layoutText(
  lines: TextRun[][],
  measure: MeasureText,
  tabWidth: number,
  wrapAt = Number.POSITIVE_INFINITY,
): { fragments: TextFragment[]; rows: number; width: number } {
  const fragments: TextFragment[] = []
  let row = 0
  let widest = 0

  for (const line of lines) {
    let x = 0

    for (const run of line) {
      const pieces = run.text.split("\t")

      for (let index = 0; index < pieces.length; index++) {
        // The epsilon keeps text that ends exactly on a stop from being read as
        // sitting just short of it and tabbing nowhere.
        if (index > 0) x = (Math.floor(x / tabWidth + 1e-6) + 1) * tabWidth

        let rest = pieces[index]
        while (rest) {
          const width = measure(rest, run.font)
          if (x + width <= wrapAt) {
            fragments.push({ ...run, text: rest, x, row })
            x += width
            break
          }

          let fit = fittingLength(rest, run.font, wrapAt - x, measure)
          if (fit === 0) {
            if (x > 0) {
              widest = Math.max(widest, x)
              row += 1
              x = 0
              continue
            }
            // A single character wider than the whole row still has to go
            // somewhere, or the loop would never end.
            fit = isHighSurrogate(rest.charCodeAt(0)) && rest.length > 1 ? 2 : 1
          }

          const head = rest.slice(0, fit)
          fragments.push({ ...run, text: head, x, row })
          x += measure(head, run.font)
          rest = rest.slice(fit)
          // Only move down when something is left to put there; otherwise the
          // end of the line would count this row a second time.
          if (rest) {
            widest = Math.max(widest, x)
            row += 1
            x = 0
          }
        }
      }
    }

    widest = Math.max(widest, x)
    row += 1
  }

  return { fragments, rows: row, width: widest }
}

/** Every piece of text under `source`, line by line, in its own colour and font. */
function readLines(source: Element): TextRun[][] {
  const lines: TextRun[][] = [[]]
  const styles = new Map<Element, { color: string; font: string }>()
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const owner = node.parentElement ?? source
    let style = styles.get(owner)
    if (!style) {
      const computed = getComputedStyle(owner)
      style = {
        color: computed.color,
        font: `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`,
      }
      styles.set(owner, style)
    }

    const parts = (node.nodeValue ?? "").replace(/\r/g, "").split("\n")
    for (let index = 0; index < parts.length; index++) {
      if (index > 0) lines.push([])
      if (parts[index]) lines[lines.length - 1].push({ text: parts[index], ...style })
    }
  }

  // Output nearly always ends in a newline; the empty row after it is not
  // something anyone wants a picture of.
  while (lines.length > 1 && lines[lines.length - 1].every((run) => !run.text.trim())) lines.pop()
  return lines
}

const MAX_SIDE = 16_384
/**
 * Pixel budgets to try in turn. Browsers differ wildly in how large a canvas
 * they will hand back — some phones stop near 16 million pixels — and none of
 * them says so in advance, so a refused canvas is simply retried smaller.
 */
const PIXEL_BUDGETS = [32_000_000, 12_000_000]

async function renderPng(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): Promise<Blob> {
  // At least 2x, so text stays sharp when the image is zoomed or printed.
  const preferred = Math.max(window.devicePixelRatio || 1, 2)

  for (const budget of PIXEL_BUDGETS) {
    const scale = Math.min(
      preferred,
      MAX_SIDE / width,
      MAX_SIDE / height,
      Math.sqrt(budget / (width * height)),
    )
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.floor(width * scale))
    canvas.height = Math.max(1, Math.floor(height * scale))

    const context = canvas.getContext("2d")
    if (!context) continue

    context.scale(canvas.width / width, canvas.height / height)
    paint(context)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (blob) return blob
  }

  throw new Error("This is too large for your browser to turn into one image.")
}

const PADDING = 12
/** Stops a two-line snippet coming out as a sliver. */
const MIN_TEXT_WIDTH = 320

type Gutter = { background: string; color: string; border: string }

async function textImage({
  source,
  background,
  gutter,
  wrapColumns,
}: {
  /** The element holding the text. Its own font, line height and tab size are used. */
  source: HTMLElement
  background: string
  /** Numbers each row down the left. Only meaningful without wrapping. */
  gutter?: Gutter
  wrapColumns?: number
}): Promise<Blob> {
  const lines = readLines(source)
  const base = getComputedStyle(source)
  const baseFont = `${base.fontStyle} ${base.fontWeight} ${base.fontSize} ${base.fontFamily}`
  const fontSize = Number.parseFloat(base.fontSize) || 14
  const lineHeight = Number.parseFloat(base.lineHeight) || Math.round(fontSize * 1.5)
  const tabSize = Number.parseInt(base.tabSize, 10) || 8

  // Measuring before a web font has arrived would size everything for the
  // fallback face and then draw it in the real one.
  await document.fonts?.ready

  const scratch = document.createElement("canvas").getContext("2d")
  if (!scratch) throw new Error("Your browser could not prepare the image.")

  let current = ""
  const measure: MeasureText = (text, font) => {
    if (font !== current) {
      scratch.font = font
      current = font
    }
    return scratch.measureText(text).width
  }

  const column = measure("0", baseFont)
  const { fragments, rows, width: textWidth } = layoutText(
    lines,
    measure,
    column * tabSize,
    wrapColumns ? column * wrapColumns : undefined,
  )

  const metrics = scratch.measureText("Mg")
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize * 0.8
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? fontSize * 0.2
  const baseline = (lineHeight - (ascent + descent)) / 2 + ascent

  const gutterWidth = gutter ? Math.ceil(PADDING + measure(String(rows), baseFont) + 8) : 0
  const textLeft = gutterWidth + PADDING
  const width = Math.ceil(textLeft + Math.max(textWidth, MIN_TEXT_WIDTH) + PADDING)
  const height = Math.ceil(PADDING * 2 + rows * lineHeight)

  return renderPng(width, height, (context) => {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
    context.textBaseline = "alphabetic"

    if (gutter) {
      context.fillStyle = gutter.background
      context.fillRect(0, 0, gutterWidth, height)
      context.fillStyle = gutter.border
      context.fillRect(gutterWidth - 1, 0, 1, height)

      context.font = baseFont
      context.fillStyle = gutter.color
      context.textAlign = "right"
      for (let row = 0; row < rows; row++) {
        context.fillText(String(row + 1), gutterWidth - 8, PADDING + row * lineHeight + baseline)
      }
      context.textAlign = "left"
    }

    for (const fragment of fragments) {
      context.font = fragment.font
      context.fillStyle = fragment.color
      context.fillText(fragment.text, textLeft + fragment.x, PADDING + fragment.row * lineHeight + baseline)
    }
  })
}

/**
 * The whole of a file as the editor would show it, line numbers included.
 *
 * `highlightedHtml` is the editor's own syntax-highlighted markup. It is styled
 * off screen by the same classes the editor uses, so every token takes its
 * colour from the stylesheet rather than from a copy of the palette kept here.
 */
export async function codeImage(highlightedHtml: string, mode: string): Promise<Blob> {
  const probe = document.createElement("div")
  probe.className = "pycharm-editor text-sm"
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none"

  const gutter = document.createElement("div")
  gutter.className = "pycharm-gutter"
  const pre = document.createElement("pre")
  pre.className = "pycharm-code whitespace-pre leading-6"
  const code = document.createElement("code")
  code.className = `code-highlight language-${mode}`
  code.innerHTML = highlightedHtml

  pre.appendChild(code)
  probe.append(gutter, pre)
  document.body.appendChild(probe)

  try {
    const gutterStyle = getComputedStyle(gutter)
    return await textImage({
      source: pre,
      background: getComputedStyle(probe).backgroundColor,
      gutter: {
        background: gutterStyle.backgroundColor,
        color: gutterStyle.color,
        border: gutterStyle.borderRightColor,
      },
    })
  } finally {
    probe.remove()
  }
}

/** Wide enough for any ordinary output; longer lines wrap as a terminal would. */
const CONSOLE_COLUMNS = 110

/**
 * Everything a program has printed so far, however far it has scrolled.
 *
 * `transcript` is the console's own text; `surface` supplies its background.
 */
export function consoleImage(transcript: HTMLElement, surface: HTMLElement): Promise<Blob> {
  return textImage({
    source: transcript,
    background: getComputedStyle(surface).backgroundColor,
    wrapColumns: CONSOLE_COLUMNS,
  })
}

/** A previewed page, described by the frame it runs in. */
export type PageSnapshot = {
  /** The page's current DOM as XHTML, scripts removed. */
  markup: string
  /** Full scrollable size, in CSS pixels. */
  width: number
  height: number
  /** Height of the frame the page was laid out in, which `vh` units refer to. */
  viewportHeight: number
  background: string
}

const MAX_MARKUP_LENGTH = 8_000_000
const MAX_PAGE_WIDTH = 8_000
const MAX_PAGE_HEIGHT = 15_000
const MAX_PAGE_SLICES = 40

function boundedSize(value: unknown, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.min(Math.ceil(value), max)
    : 0
}

/**
 * Validate what a preview frame reports about itself.
 *
 * The frame runs whatever a pupil — or the author of a shared link — wrote, so
 * its answer is untrusted: the sizes are bounded and an oversized document is
 * refused rather than handed to the renderer.
 */
export function parsePageSnapshot(data: unknown): PageSnapshot | null {
  if (!data || typeof data !== "object") return null
  const { markup, width, height, viewportHeight, background } = data as Record<string, unknown>

  if (typeof markup !== "string" || !markup || markup.length > MAX_MARKUP_LENGTH) return null

  const pageWidth = boundedSize(width, MAX_PAGE_WIDTH)
  const pageHeight = boundedSize(height, MAX_PAGE_HEIGHT)
  if (!pageWidth || !pageHeight) return null

  return {
    markup,
    width: pageWidth,
    height: pageHeight,
    viewportHeight: boundedSize(viewportHeight, pageHeight) || pageHeight,
    background: typeof background === "string" && background.length <= 100 ? background : "#ffffff",
  }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Your browser could not draw this page as an image."))
    image.src = source
  })
}

/**
 * The full length of a previewed page.
 *
 * The markup is drawn as an SVG image, which a browser renders without running
 * scripts or fetching anything, so untrusted markup is inert here. It is drawn
 * one frame-height at a time: an SVG's viewport is its own size, so rendering
 * the page in a single tall image would stretch everything sized in `vh`.
 */
export async function pageImage(snapshot: PageSnapshot): Promise<Blob> {
  const { markup, width, height } = snapshot
  const slice = Math.max(
    Math.min(snapshot.viewportHeight, height),
    Math.ceil(height / MAX_PAGE_SLICES),
  )

  const slices: { image: HTMLImageElement; top: number }[] = []
  for (let top = 0; top < height; top += slice) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${slice}">` +
      `<foreignObject x="0" y="${-top}" width="${width}" height="${height}">${markup}</foreignObject>` +
      `</svg>`
    slices.push({
      image: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
      top,
    })
  }

  return renderPng(width, height, (context) => {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    // An unparseable colour is ignored by the canvas, leaving the white above.
    context.fillStyle = snapshot.background
    context.fillRect(0, 0, width, height)

    for (const { image, top } of slices) {
      const visible = Math.min(slice, height - top)
      context.drawImage(image, 0, 0, width, visible, 0, top, width, visible)
    }
  })
}
