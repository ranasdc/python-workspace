import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  MAX_FOLDER_DEPTH,
  buildFolderTree,
  canHoldSubfolder,
  countFilesDeep,
  filesInTree,
  folderDepth,
  folderPaths,
  subtreeFolderIds,
} from "../lib/ide/folder-tree.ts"

// Course > Unit 1 > Lesson 1, plus a second top-level folder.
const FOLDERS = [
  { id: 1, parentId: null, name: "Course" },
  { id: 2, parentId: 1, name: "Unit 1" },
  { id: 3, parentId: 2, name: "Lesson 1" },
  { id: 4, parentId: null, name: "Extras" },
  { id: 5, parentId: 1, name: "Unit 2" },
]

const FILES = [
  { id: 10, folderId: null, name: "scratch.py" },
  { id: 11, folderId: 1, name: "readme.py" },
  { id: 12, folderId: 3, name: "task.py" },
  { id: 13, folderId: 3, name: "extension.py" },
  { id: 14, folderId: 4, name: "bonus.py" },
]

const names = (nodes) => nodes.map((n) => n.name)

describe("buildFolderTree", () => {
  it("leaves a tree with no nesting exactly as it was", () => {
    // Every folder that existed before nesting has a null parent, so this is
    // the shape every existing workspace has to keep.
    const flat = [
      { id: 1, parentId: null, name: "Week 1" },
      { id: 2, parentId: null, name: "Week 2" },
    ]
    const tree = buildFolderTree(flat, [
      { id: 10, folderId: 1 },
      { id: 11, folderId: null },
    ])
    assert.deepEqual(names(tree.folders), ["Week 1", "Week 2"])
    assert.deepEqual(tree.folders[0].files, [{ id: 10, folderId: 1 }])
    assert.deepEqual(tree.folders[0].folders, [])
    assert.deepEqual(tree.rootFiles, [{ id: 11, folderId: null }])
  })

  it("nests folders under their parent, keeping the order they arrived in", () => {
    const tree = buildFolderTree(FOLDERS, FILES)
    assert.deepEqual(names(tree.folders), ["Course", "Extras"])

    const course = tree.folders[0]
    assert.deepEqual(names(course.folders), ["Unit 1", "Unit 2"])
    assert.deepEqual(names(course.folders[0].folders), ["Lesson 1"])
  })

  it("puts each file in its own folder and nowhere else", () => {
    const tree = buildFolderTree(FOLDERS, FILES)
    const course = tree.folders[0]
    const lesson = course.folders[0].folders[0]

    assert.deepEqual(names(tree.rootFiles), ["scratch.py"])
    assert.deepEqual(names(course.files), ["readme.py"])
    assert.deepEqual(names(course.folders[0].files), [])
    assert.deepEqual(names(lesson.files), ["task.py", "extension.py"])
  })

  it("records how deep each folder is", () => {
    const tree = buildFolderTree(FOLDERS, FILES)
    const course = tree.folders[0]
    assert.equal(course.depth, 1)
    assert.equal(course.folders[0].depth, 2)
    assert.equal(course.folders[0].folders[0].depth, 3)
  })

  it("shows a folder at the top when its parent is not there", () => {
    // Hiding it would hide the files inside it as well.
    const tree = buildFolderTree(
      [{ id: 7, parentId: 999, name: "Orphan" }],
      [{ id: 20, folderId: 7 }],
    )
    assert.deepEqual(names(tree.folders), ["Orphan"])
    assert.equal(tree.folders[0].files.length, 1)
  })

  it("survives folders that point at each other, and keeps both visible", () => {
    const loop = [
      { id: 1, parentId: 2, name: "A" },
      { id: 2, parentId: 1, name: "B" },
    ]
    const tree = buildFolderTree(loop, [])
    const seen = folderPaths(tree.folders).map((f) => f.id)
    assert.deepEqual([...seen].sort(), [1, 2])
  })

  it("does not nest a folder inside itself", () => {
    const tree = buildFolderTree([{ id: 1, parentId: 1, name: "Self" }], [])
    assert.deepEqual(names(tree.folders), ["Self"])
    assert.deepEqual(tree.folders[0].folders, [])
  })
})

describe("subtreeFolderIds", () => {
  it("returns the folder and everything beneath it", () => {
    assert.deepEqual([...subtreeFolderIds(FOLDERS, 1)].sort(), [1, 2, 3, 5])
  })

  it("leaves sibling trees out", () => {
    assert.ok(!subtreeFolderIds(FOLDERS, 1).includes(4))
    assert.deepEqual(subtreeFolderIds(FOLDERS, 4), [4])
  })

  it("lists every parent before its children", () => {
    // Distribution creates folders in this order, and a pupil's copy of a
    // folder has to exist before a subfolder can be put inside it.
    const ids = subtreeFolderIds(FOLDERS, 1)
    for (const id of ids) {
      const parentId = FOLDERS.find((f) => f.id === id).parentId
      if (id === 1) continue
      assert.ok(ids.indexOf(parentId) < ids.indexOf(id), `${parentId} must precede ${id}`)
    }
  })

  it("starts from a subfolder without climbing back up", () => {
    assert.deepEqual(subtreeFolderIds(FOLDERS, 2), [2, 3])
  })

  it("terminates on a loop", () => {
    const loop = [
      { id: 1, parentId: 2, name: "A" },
      { id: 2, parentId: 1, name: "B" },
    ]
    assert.deepEqual([...subtreeFolderIds(loop, 1)].sort(), [1, 2])
  })
})

describe("folderDepth", () => {
  it("counts a top-level folder as level 1", () => {
    assert.equal(folderDepth(FOLDERS, 1), 1)
    assert.equal(folderDepth(FOLDERS, 2), 2)
    assert.equal(folderDepth(FOLDERS, 3), 3)
  })

  it("is 0 for a folder that is not in the set", () => {
    assert.equal(folderDepth(FOLDERS, 999), 0)
  })

  it("terminates on a loop", () => {
    const loop = [
      { id: 1, parentId: 2, name: "A" },
      { id: 2, parentId: 1, name: "B" },
    ]
    assert.equal(folderDepth(loop, 1), 2)
  })
})

describe("the depth limit", () => {
  it("allows a subfolder everywhere above the bottom level and nowhere on it", () => {
    for (let depth = 1; depth < MAX_FOLDER_DEPTH; depth++) {
      assert.ok(canHoldSubfolder(depth), `level ${depth} should take a subfolder`)
    }
    assert.ok(!canHoldSubfolder(MAX_FOLDER_DEPTH))
  })

  it("agrees with the depth a chain of folders actually reaches", () => {
    // Build a chain exactly as deep as the limit, the way repeated "new
    // subfolder" clicks would, and check the last one is where creation stops.
    const chain = Array.from({ length: MAX_FOLDER_DEPTH }, (_, i) => ({
      id: i + 1,
      parentId: i === 0 ? null : i,
      name: `Level ${i + 1}`,
    }))
    const deepest = chain[chain.length - 1].id
    assert.equal(folderDepth(chain, deepest), MAX_FOLDER_DEPTH)
    assert.ok(!canHoldSubfolder(folderDepth(chain, deepest)))
    assert.ok(canHoldSubfolder(folderDepth(chain, deepest - 1)))
  })
})

describe("reading a tree back out", () => {
  const tree = buildFolderTree(FOLDERS, FILES)

  it("finds every file in every subfolder", () => {
    const all = [...tree.rootFiles, ...filesInTree(tree.folders)]
    assert.deepEqual(
      all.map((f) => f.id).sort(),
      FILES.map((f) => f.id).sort(),
    )
  })

  it("counts the files in subfolders towards the folder that holds them", () => {
    const course = tree.folders[0]
    assert.equal(countFilesDeep(course), 3)
    assert.equal(countFilesDeep(course.folders[0]), 2)
    assert.equal(countFilesDeep(course.folders[1]), 0)
  })

  it("gives each folder its full path, parents first", () => {
    assert.deepEqual(
      folderPaths(tree.folders).map((f) => f.path),
      ["Course", "Course / Unit 1", "Course / Unit 1 / Lesson 1", "Course / Unit 2", "Extras"],
    )
  })
})
