import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { layoutText, parsePageSnapshot, screenshotFileName } from "../lib/ide/screenshot.ts"

// A stand-in for a monospaced font: every character is 10 wide.
const measure = (text) => text.length * 10
const run = (text) => ({ text, color: "black", font: "mono" })

describe("screenshotFileName", () => {
  it("names the image after the file and the part captured", () => {
    assert.equal(screenshotFileName("L1.py", "code"), "L1-code.png")
    assert.equal(screenshotFileName("index.html", "preview"), "index-preview.png")
  })

  it("still produces a usable name when no file is known", () => {
    assert.equal(screenshotFileName(undefined, "output"), "output.png")
    assert.equal(screenshotFileName("  ", "output"), "output.png")
  })
})

describe("layoutText", () => {
  it("gives every line its own row and reports the widest one", () => {
    const { fragments, rows, width } = layoutText([[run("ab")], [], [run("abcd")]], measure, 40)
    assert.equal(rows, 3)
    assert.equal(width, 40)
    assert.deepEqual(
      fragments.map((f) => [f.text, f.x, f.row]),
      [
        ["ab", 0, 0],
        ["abcd", 0, 2],
      ],
    )
  })

  it("places runs on one line after each other", () => {
    const { fragments } = layoutText([[run("if"), run(" x:")]], measure, 40)
    assert.deepEqual(
      fragments.map((f) => [f.text, f.x]),
      [
        ["if", 0],
        [" x:", 20],
      ],
    )
  })

  it("advances a tab to the next stop rather than by a fixed amount", () => {
    const { fragments } = layoutText([[run("a\tb\t\tc")], [run("abcd\te")]], measure, 40)
    assert.deepEqual(
      fragments.map((f) => [f.text, f.x, f.row]),
      [
        ["a", 0, 0],
        ["b", 40, 0],
        ["c", 120, 0],
        ["abcd", 0, 1],
        // Text ending exactly on a stop still moves on to the following one.
        ["e", 80, 1],
      ],
    )
  })

  it("wraps a line that is wider than the limit onto further rows", () => {
    const { fragments, rows, width } = layoutText([[run("abcdefgh")], [run("z")]], measure, 40, 30)
    assert.equal(rows, 4)
    assert.equal(width, 30)
    assert.deepEqual(
      fragments.map((f) => [f.text, f.x, f.row]),
      [
        ["abc", 0, 0],
        ["def", 0, 1],
        ["gh", 0, 2],
        ["z", 0, 3],
      ],
    )
  })

  it("moves a run that does not fit after earlier text to a fresh row", () => {
    const { fragments } = layoutText([[run("abc"), run("de")]], measure, 40, 30)
    assert.deepEqual(
      fragments.map((f) => [f.text, f.x, f.row]),
      [
        ["abc", 0, 0],
        ["de", 0, 1],
      ],
    )
  })

  it("does not split an emoji in half when wrapping", () => {
    // Two UTF-16 units each, so a cut after an odd count would break one.
    const { fragments } = layoutText([[run("😀😀")]], measure, 40, 30)
    assert.deepEqual(
      fragments.map((f) => f.text),
      ["😀", "😀"],
    )
  })

  it("terminates when a single character is wider than the limit", () => {
    const { fragments, rows } = layoutText([[run("ab")]], measure, 40, 5)
    assert.equal(rows, 2)
    assert.deepEqual(
      fragments.map((f) => f.text),
      ["a", "b"],
    )
  })
})

describe("parsePageSnapshot", () => {
  const valid = {
    markup: "<html></html>",
    width: 800,
    height: 2400,
    viewportHeight: 600,
    background: "rgb(255, 255, 255)",
  }

  it("accepts a well-formed report", () => {
    assert.deepEqual(parsePageSnapshot(valid), valid)
  })

  it("refuses a report with no usable markup or size", () => {
    assert.equal(parsePageSnapshot(null), null)
    assert.equal(parsePageSnapshot({ ...valid, markup: "" }), null)
    assert.equal(parsePageSnapshot({ ...valid, markup: 42 }), null)
    assert.equal(parsePageSnapshot({ ...valid, width: 0 }), null)
    assert.equal(parsePageSnapshot({ ...valid, height: Number.NaN }), null)
    assert.equal(parsePageSnapshot({ ...valid, height: "2400" }), null)
  })

  it("refuses a document too large to render safely", () => {
    assert.equal(parsePageSnapshot({ ...valid, markup: "x".repeat(8_000_001) }), null)
  })

  it("bounds the sizes a page claims for itself", () => {
    const parsed = parsePageSnapshot({ ...valid, width: 1e9, height: Number.MAX_VALUE })
    assert.equal(parsed.width, 8_000)
    assert.equal(parsed.height, 15_000)
  })

  it("falls back when the frame height or background is unusable", () => {
    const parsed = parsePageSnapshot({ ...valid, viewportHeight: -1, background: { a: 1 } })
    assert.equal(parsed.viewportHeight, 2400)
    assert.equal(parsed.background, "#ffffff")
  })
})
