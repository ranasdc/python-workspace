import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_SPLIT,
  MIN_PANE_PX,
  clampOutputFraction,
  outputFractionAt,
  parseSplitSizes,
  serialiseSplitSizes,
  splitStorageKey,
} from "../lib/ide/split-layout.ts"

describe("clampOutputFraction", () => {
  it("leaves a share alone when both panes have room", () => {
    assert.equal(clampOutputFraction(0.4, 1200, "horizontal"), 0.4)
  })

  it("stops the output shrinking below its minimum width", () => {
    const fraction = clampOutputFraction(0.01, 1000, "horizontal")
    assert.equal(fraction, MIN_PANE_PX.horizontal.output / 1000)
  })

  it("stops the editor shrinking below its minimum width", () => {
    const fraction = clampOutputFraction(0.99, 1000, "horizontal")
    assert.equal(fraction, 1 - MIN_PANE_PX.horizontal.editor / 1000)
  })

  it("uses the smaller minimums when the panes are stacked", () => {
    const fraction = clampOutputFraction(0.99, 600, "vertical")
    assert.equal(fraction, 1 - MIN_PANE_PX.vertical.editor / 600)
  })

  it("never gives either pane less than a tenth, however large the container", () => {
    assert.equal(clampOutputFraction(0, 100_000, "horizontal"), 0.1)
    assert.equal(clampOutputFraction(1, 100_000, "horizontal"), 0.9)
  })

  it("splits evenly when the container cannot fit both minimums", () => {
    assert.equal(clampOutputFraction(0.9, 300, "horizontal"), 0.5)
  })

  it("falls back to the default for a value that is not a number", () => {
    assert.equal(clampOutputFraction(Number.NaN, 1000, "horizontal"), DEFAULT_SPLIT.horizontal)
  })

  it("still bounds the share before the container has been measured", () => {
    assert.equal(clampOutputFraction(2, 0, "vertical"), 0.9)
    assert.equal(clampOutputFraction(-1, 0, "vertical"), 0.1)
  })
})

describe("outputFractionAt", () => {
  it("gives the output everything past the pointer", () => {
    assert.equal(outputFractionAt(700, 200, 1000), 0.5)
    assert.equal(outputFractionAt(450, 200, 1000), 0.75)
  })

  it("does not divide by an unmeasured container", () => {
    assert.equal(outputFractionAt(500, 0, 0), 0.5)
  })
})

describe("remembered layouts", () => {
  it("round-trips the proportions it stores", () => {
    const stored = serialiseSplitSizes({ horizontal: 0.3, vertical: 0.65 })
    assert.deepEqual(parseSplitSizes(stored), { horizontal: 0.3, vertical: 0.65 })
  })

  it("starts from the default when nothing is stored", () => {
    assert.deepEqual(parseSplitSizes(null), DEFAULT_SPLIT)
    assert.deepEqual(parseSplitSizes(""), DEFAULT_SPLIT)
  })

  it("ignores a value that is not valid JSON", () => {
    assert.deepEqual(parseSplitSizes("{not json"), DEFAULT_SPLIT)
  })

  it("ignores stored values of the wrong shape", () => {
    assert.deepEqual(parseSplitSizes("42"), DEFAULT_SPLIT)
    assert.deepEqual(parseSplitSizes('{"horizontal":"wide","vertical":null}'), DEFAULT_SPLIT)
  })

  it("pulls an out-of-range stored value back inside the bounds", () => {
    assert.deepEqual(parseSplitSizes('{"horizontal":5,"vertical":-2}'), {
      horizontal: 0.9,
      vertical: 0.1,
    })
  })

  it("keeps one axis when only the other is damaged", () => {
    assert.deepEqual(parseSplitSizes('{"horizontal":0.25}'), {
      horizontal: 0.25,
      vertical: DEFAULT_SPLIT.vertical,
    })
  })

  it("never hands back the shared default object to be mutated", () => {
    const first = parseSplitSizes(null)
    first.horizontal = 0.2
    assert.equal(parseSplitSizes(null).horizontal, DEFAULT_SPLIT.horizontal)
  })

  it("keys the layout by user and by workspace", () => {
    assert.notEqual(splitStorageKey("a", "student"), splitStorageKey("b", "student"))
    assert.notEqual(splitStorageKey("a", "student"), splitStorageKey("a", "teacher-library"))
  })
})
