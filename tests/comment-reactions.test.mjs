import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMMENT_REACTIONS,
  getCommentReaction,
  isCommentReaction,
  reactionClasses,
} from "@/lib/ide/comment-reactions"

test("offers exactly the three replies a pupil can give", () => {
  assert.deepEqual(
    COMMENT_REACTIONS.map((r) => r.id),
    ["acknowledged", "corrected", "need_help"],
  )
})

test("every reply is presentable on both sides of the thread", () => {
  for (const reaction of COMMENT_REACTIONS) {
    assert.ok(reaction.label, `${reaction.id} needs a pupil-facing label`)
    assert.ok(reaction.teacherLabel, `${reaction.id} needs a teacher-facing label`)
    assert.ok(reaction.hint, `${reaction.id} needs a tooltip explaining it`)
  }
})

test("accepts the known replies", () => {
  for (const reaction of COMMENT_REACTIONS) {
    assert.equal(isCommentReaction(reaction.id), true)
  }
})

test("rejects anything else, so a crafted request cannot be stored", () => {
  // The guard stands between an untrusted request body and a column that both
  // dashboards render, so the rejections matter more than the acceptances.
  for (const value of [
    "ACKNOWLEDGED",
    "acknowledged ",
    "needs_help",
    "",
    null,
    undefined,
    0,
    1,
    {},
    [],
    ["acknowledged"],
    { id: "acknowledged" },
    "<script>alert(1)</script>",
    "acknowledged'; drop table file_comment; --",
  ]) {
    assert.equal(isCommentReaction(value), false, `${JSON.stringify(value)} must be rejected`)
  }
})

test("resolves a stored reply to its definition", () => {
  assert.equal(getCommentReaction("need_help")?.teacherLabel, "Needs help")
  assert.equal(getCommentReaction("corrected")?.label, "Made correction")
})

test("treats an absent or unrecognised reply as no reply", () => {
  // A comment predating this feature, or one whose value no longer exists after
  // a rename, must render as "not answered yet" rather than crashing the thread.
  assert.equal(getCommentReaction(null), null)
  assert.equal(getCommentReaction(undefined), null)
  assert.equal(getCommentReaction("retired_reaction"), null)
})

test("gives each reply one colour, shared by button and badge", () => {
  const tones = new Set()
  for (const reaction of COMMENT_REACTIONS) {
    const classes = reactionClasses(reaction)
    assert.ok(classes.active.includes(reaction.tone))
    assert.ok(classes.badge.includes(reaction.tone))
    tones.add(reaction.tone)
  }
  // Distinct tones: a teacher scanning a thread tells the three replies apart by
  // colour before reading a word of them.
  assert.equal(tones.size, COMMENT_REACTIONS.length)
})

test("class strings stay literal so Tailwind can see them", () => {
  // Assembling these from the tone at runtime would compile away to nothing.
  for (const reaction of COMMENT_REACTIONS) {
    const { active, badge } = reactionClasses(reaction)
    for (const value of [active, badge]) {
      assert.ok(!value.includes("${"), "classes must not be template-assembled")
      assert.ok(!value.includes("undefined"), "classes must not contain undefined")
    }
  }
})
