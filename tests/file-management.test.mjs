import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  MAX_NAME_LENGTH,
  hasNameClash,
  planFolderWithdrawal,
  validateFileRename,
  validateFolderRename,
} from "../lib/ide/file-management.ts"
import { LANGUAGE_ORDER, LANGUAGES } from "../lib/ide/languages.ts"

describe("validateFileRename", () => {
  it("renames within the same type", () => {
    assert.deepEqual(validateFileRename("lesson1.py", "revision.py", "python"), {
      ok: true,
      name: "revision.py",
      unchanged: false,
    })
    assert.deepEqual(validateFileRename("index.html", "homepage.html", "html"), {
      ok: true,
      name: "homepage.html",
      unchanged: false,
    })
  })

  it("adds the existing ending back when it is left off", () => {
    assert.equal(validateFileRename("lesson1.py", "revision", "python").name, "revision.py")
    assert.equal(validateFileRename("style.css", "theme", "html").name, "theme.css")
    assert.equal(validateFileRename("app.js", "main", "html").name, "main.js")
  })

  it("keeps a version number in the name rather than reading it as a type", () => {
    assert.equal(validateFileRename("draft.py", "draft v1.2", "python").name, "draft v1.2.py")
  })

  it("trims surrounding whitespace", () => {
    assert.equal(validateFileRename("a.py", "  b.py  ", "python").name, "b.py")
  })

  it("never changes the file's type", () => {
    for (const attempt of ["revision.txt", "revision.html", "revision.css", "revision.js"]) {
      const result = validateFileRename("lesson.py", attempt, "python")
      assert.equal(result.ok, false, attempt)
      assert.match(result.error, /can't change the file type/)
    }
    // Staying inside the HTML IDE is still a change of type.
    assert.equal(validateFileRename("index.html", "index.css", "html").ok, false)
    assert.equal(validateFileRename("style.css", "style.py", "html").ok, false)
  })

  it("rejects empty names and names that are only an ending", () => {
    assert.equal(validateFileRename("a.py", "", "python").ok, false)
    assert.equal(validateFileRename("a.py", "   ", "python").ok, false)
    assert.equal(validateFileRename("a.py", ".py", "python").ok, false)
  })

  it("rejects characters a filesystem cannot store", () => {
    for (const bad of ["a/b.py", "a\\b.py", "a:b.py", "a*b.py", "a?b.py", 'a"b.py', "a<b.py", "a>b.py", "a|b.py", "a\nb.py", "../a.py"]) {
      assert.equal(validateFileRename("x.py", bad, "python").ok, false, JSON.stringify(bad))
    }
  })

  it("rejects names that are too long, counting the ending", () => {
    const stem = "a".repeat(MAX_NAME_LENGTH - 2)
    assert.equal(validateFileRename("x.py", stem, "python").ok, false)
    assert.equal(validateFileRename("x.py", "a".repeat(MAX_NAME_LENGTH - 3), "python").ok, true)
  })

  it("reports an unchanged name so nothing is written", () => {
    assert.equal(validateFileRename("lesson.py", "lesson.py", "python").unchanged, true)
    assert.equal(validateFileRename("lesson.py", " lesson ", "python").unchanged, true)
  })

  it("is not something a non-string can get through", () => {
    assert.equal(validateFileRename("x.py", undefined, "python").ok, false)
    assert.equal(validateFileRename("x.py", { length: 3 }, "python").ok, false)
  })

  it("applies to every IDE in the registry, including ones added later", () => {
    for (const id of LANGUAGE_ORDER) {
      for (const ext of LANGUAGES[id].extensions) {
        const current = `original${ext}`
        assert.deepEqual(
          validateFileRename(current, "renamed", id),
          { ok: true, name: `renamed${ext}`, unchanged: false },
          `${id} ${ext}`,
        )
        assert.equal(validateFileRename(current, `renamed${ext}`, id).name, `renamed${ext}`)
      }
    }
  })
})

describe("validateFolderRename", () => {
  it("accepts an ordinary new name", () => {
    assert.deepEqual(validateFolderRename("Python Exercises", "Year 9 Python Exercises"), {
      ok: true,
      name: "Year 9 Python Exercises",
      unchanged: false,
    })
  })

  it("trims, and treats a trimmed match as unchanged", () => {
    assert.equal(validateFolderRename("Week 1", "  Week 2 ").name, "Week 2")
    assert.equal(validateFolderRename("Week 1", " Week 1 ").unchanged, true)
  })

  it("rejects empty, dot-only and unstorable names", () => {
    for (const bad of ["", "   ", ".", "..", "a/b", "a\\b", "Unit 2: Loops", "what?", "a|b"]) {
      assert.equal(validateFolderRename("Week 1", bad).ok, false, JSON.stringify(bad))
    }
    assert.equal(validateFolderRename("Week 1", "a".repeat(MAX_NAME_LENGTH + 1)).ok, false)
  })
})

describe("hasNameClash", () => {
  it("matches regardless of case and surrounding space", () => {
    assert.equal(hasNameClash(["Notes.py", "main.py"], "notes.py"), true)
    assert.equal(hasNameClash(["Week 1 "], "week 1"), true)
  })

  it("is false when the name is free", () => {
    assert.equal(hasNameClash(["main.py"], "notes.py"), false)
    assert.equal(hasNameClash([], "notes.py"), false)
  })
})

describe("planFolderWithdrawal", () => {
  const teacher = (id, parentId = null) => ({ id, parentId, assignedByTeacher: true })
  const pupil = (id, parentId = null) => ({ id, parentId, assignedByTeacher: false })
  const sorted = (plan) => ({
    teacherFolderIds: [...plan.teacherFolderIds].sort((a, b) => a - b),
    withdrawFolderIds: [...plan.withdrawFolderIds].sort((a, b) => a - b),
    handOverFolderIds: [...plan.handOverFolderIds].sort((a, b) => a - b),
  })

  it("withdraws a distributed folder and the teacher folders inside it", () => {
    const plan = planFolderWithdrawal({
      folders: [teacher(1), teacher(2, 1), teacher(3, 2)],
      files: [
        { folderId: 1, assignedByTeacher: true },
        { folderId: 3, assignedByTeacher: true },
      ],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1, 2, 3],
      withdrawFolderIds: [1, 2, 3],
      handOverFolderIds: [],
    })
  })

  it("leaves folders outside the copy alone", () => {
    const plan = planFolderWithdrawal({
      // 1 is the copy; 5 is another distributed folder; 6 is the pupil's own.
      folders: [teacher(1), teacher(5), pupil(6)],
      files: [{ folderId: 6, assignedByTeacher: false }],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1],
      withdrawFolderIds: [1],
      handOverFolderIds: [],
    })
  })

  it("hands over a folder that holds the pupil's own file", () => {
    const plan = planFolderWithdrawal({
      folders: [teacher(1)],
      files: [
        { folderId: 1, assignedByTeacher: true },
        { folderId: 1, assignedByTeacher: false },
      ],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1],
      withdrawFolderIds: [],
      handOverFolderIds: [1],
    })
  })

  it("keeps the whole path down to a pupil's own work, and only that path", () => {
    const plan = planFolderWithdrawal({
      // 1 > 2 > 3 holds the pupil's file; 1 > 4 holds only the teacher's.
      folders: [teacher(1), teacher(2, 1), teacher(3, 2), teacher(4, 1)],
      files: [
        { folderId: 3, assignedByTeacher: false },
        { folderId: 4, assignedByTeacher: true },
      ],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1, 2, 3, 4],
      withdrawFolderIds: [4],
      handOverFolderIds: [1, 2, 3],
    })
  })

  it("keeps a folder holding a pupil-made subfolder, and never touches that subfolder", () => {
    const plan = planFolderWithdrawal({
      // The pupil made folder 9 inside the teacher's folder 1, with a teacher
      // folder 10 somehow beneath it: nothing under a pupil's folder is taken.
      folders: [teacher(1), pupil(9, 1), teacher(10, 9)],
      files: [],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1],
      withdrawFolderIds: [],
      handOverFolderIds: [1],
    })
  })

  it("treats each pupil's copy separately", () => {
    const plan = planFolderWithdrawal({
      // Copy 1 belongs to a pupil who added a file; copy 2 to one who did not.
      folders: [teacher(1), teacher(2)],
      files: [{ folderId: 1, assignedByTeacher: false }],
      copyIds: [1, 2],
    })
    assert.deepEqual(sorted(plan), {
      teacherFolderIds: [1, 2],
      withdrawFolderIds: [2],
      handOverFolderIds: [1],
    })
  })

  it("ignores copy ids that are not among the live folders", () => {
    const plan = planFolderWithdrawal({ folders: [teacher(1)], files: [], copyIds: [1, 404] })
    assert.deepEqual(sorted(plan).teacherFolderIds, [1])
  })

  it("ends on rows that point at each other", () => {
    const plan = planFolderWithdrawal({
      folders: [teacher(1, 2), teacher(2, 1)],
      files: [],
      copyIds: [1],
    })
    assert.deepEqual(sorted(plan).withdrawFolderIds, [1, 2])
  })
})
