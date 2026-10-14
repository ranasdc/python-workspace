import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { changedLineNumbers, parseMarkedLines } from "../lib/ide/line-diff.ts"

const PUPIL_FILE = ['# Shopping total', 'items = 3', 'price = 2.50', 'print("Total is " + total)'].join(
  "\n",
)

describe("changedLineNumbers", () => {
  it("marks nothing when the teacher saves without changing anything", () => {
    assert.deepEqual(changedLineNumbers(PUPIL_FILE, PUPIL_FILE), [])
  })

  it("marks only the line the teacher actually corrected", () => {
    const corrected = PUPIL_FILE.replace("+ total)", "+ str(total))")
    assert.deepEqual(changedLineNumbers(PUPIL_FILE, corrected), [4])
  })

  it("marks only the inserted line, not everything after it", () => {
    // The reason this uses an LCS rather than comparing by position: a naive
    // diff reports all four following lines here and lights up the whole file.
    const withComment = "# Corrected below\n" + PUPIL_FILE
    assert.deepEqual(changedLineNumbers(PUPIL_FILE, withComment), [1])
  })

  it("marks an insertion in the middle at its new position", () => {
    assert.deepEqual(changedLineNumbers("a\nb\nc", "a\nb\nNEW\nc"), [3])
  })

  it("marks nothing for a pure deletion, which has no line left to point at", () => {
    assert.deepEqual(changedLineNumbers("a\nb\nc", "a\nc"), [])
  })

  it("marks appended lines", () => {
    assert.deepEqual(changedLineNumbers("a", "a\nb\nc"), [2, 3])
  })

  it("marks every line when the file is rewritten wholesale", () => {
    assert.deepEqual(changedLineNumbers("a\nb", "x\ny"), [1, 2])
  })

  it("treats a changed line as one mark rather than a delete plus an insert", () => {
    assert.deepEqual(changedLineNumbers("a\nb\nc", "a\nX\nc"), [2])
  })

  it("handles an empty original file", () => {
    assert.deepEqual(changedLineNumbers("", "print(1)"), [1])
  })

  it("degrades to a positional diff instead of stalling on a huge file", () => {
    // Past MAX_DIFF_LINES the LCS table is abandoned; the result is cruder but
    // the request still returns, which is the point.
    const big = Array.from({ length: 1300 }, (_, i) => `line ${i}`).join("\n")
    const edited = big.replace("line 0", "line zero")
    assert.deepEqual(changedLineNumbers(big, edited), [1])
  })
})

describe("parseMarkedLines", () => {
  it("reads back the line numbers that were stored", () => {
    assert.deepEqual(parseMarkedLines(JSON.stringify([1, 3])), [1, 3])
  })

  it("returns nothing for a file that was never corrected", () => {
    assert.deepEqual(parseMarkedLines(null), [])
    assert.deepEqual(parseMarkedLines(undefined), [])
    assert.deepEqual(parseMarkedLines(""), [])
  })

  it("survives malformed or unexpected column contents", () => {
    // A highlight is cosmetic, so bad data must not break the editor.
    assert.deepEqual(parseMarkedLines("not json"), [])
    assert.deepEqual(parseMarkedLines('{"lines":[1]}'), [])
    assert.deepEqual(parseMarkedLines('["1","2"]'), [])
  })

  it("drops values that could not be real line numbers", () => {
    assert.deepEqual(parseMarkedLines('[1,"x",0,-2,3]'), [1, 3])
  })
})
