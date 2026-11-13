import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { MAX_SELECTED_RECIPIENTS, resolveRecipientIds } from "../lib/distribution.ts"

const TEACHER = "teacher-1"
const ENROLLED = ["amy", "ben", "cal", "dee", "eli"]

describe("resolveRecipientIds", () => {
  it("sends to the entire class when nothing is selected", () => {
    assert.deepEqual(resolveRecipientIds(null, ENROLLED, TEACHER), ENROLLED)
  })

  it("sends to one student when given a single id", () => {
    assert.deepEqual(resolveRecipientIds("cal", ENROLLED, TEACHER), ["cal"])
  })

  it("sends to exactly the selected students and nobody else", () => {
    const recipients = resolveRecipientIds(["amy", "cal", "eli"], ENROLLED, TEACHER)
    assert.deepEqual(recipients, ["amy", "cal", "eli"])
    assert.ok(!recipients.includes("ben"))
    assert.ok(!recipients.includes("dee"))
  })

  it("collapses a repeated id, so nobody is sent the same work twice", () => {
    assert.deepEqual(resolveRecipientIds(["amy", "amy", "ben", "amy"], ENROLLED, TEACHER), [
      "amy",
      "ben",
    ])
  })

  it("counts a student enrolled twice only once", () => {
    assert.deepEqual(resolveRecipientIds(null, ["amy", "amy", "ben"], TEACHER), ["amy", "ben"])
  })

  it("refuses a single student who is not in the class", () => {
    assert.throws(() => resolveRecipientIds("zed", ENROLLED, TEACHER), /not in this class/)
  })

  it("refuses the whole selection if any one student is not in the class", () => {
    assert.throws(
      () => resolveRecipientIds(["amy", "zed"], ENROLLED, TEACHER),
      /not in this class/,
    )
  })

  it("refuses an empty selection rather than treating it as everyone", () => {
    assert.throws(() => resolveRecipientIds([], ENROLLED, TEACHER), /at least one student/)
  })

  it("never sends to the teacher, even when they are enrolled in their own class", () => {
    const enrolled = [...ENROLLED, TEACHER]
    assert.deepEqual(resolveRecipientIds(null, enrolled, TEACHER), ENROLLED)
    assert.throws(() => resolveRecipientIds(TEACHER, enrolled, TEACHER), /not in this class/)
    assert.throws(() => resolveRecipientIds(["amy", TEACHER], enrolled, TEACHER), /not in this class/)
  })

  it("rejects a selection that is not a list of ids", () => {
    assert.throws(() => resolveRecipientIds(["amy", 7], ENROLLED, TEACHER), /Invalid/)
    assert.throws(() => resolveRecipientIds(["amy", ""], ENROLLED, TEACHER), /Invalid/)
    assert.throws(() => resolveRecipientIds({ id: "amy" }, ENROLLED, TEACHER), /Invalid/)
    assert.throws(() => resolveRecipientIds(42, ENROLLED, TEACHER), /Invalid/)
  })

  it("rejects an absurdly long selection before doing any work on it", () => {
    const flood = Array.from({ length: MAX_SELECTED_RECIPIENTS + 1 }, () => "amy")
    assert.throws(() => resolveRecipientIds(flood, ENROLLED, TEACHER), /Too many/)
  })

  it("returns nobody for a class with no students", () => {
    assert.deepEqual(resolveRecipientIds(null, [], TEACHER), [])
  })
})
