/**
 * The rules for renaming and withdrawing files and folders, for every IDE.
 *
 * Nothing here knows which IDE it is working for, or touches the database. The
 * rename dialog runs these checks to give an answer as the user types, and the
 * server actions run the same ones again before anything is written, so the
 * two can never disagree about what a valid name is. An IDE added to the
 * registry in `languages.ts` gets all of it without a change in this file.
 */

import {
  extensionOf,
  languageForExtension,
  normaliseFileName,
  type LanguageId,
} from "@/lib/ide/languages"

export const MAX_NAME_LENGTH = 100

/** Characters no common filesystem accepts, so a download always unpacks. */
const FORBIDDEN_CHARACTERS = /[\\/:*?"<>|]/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/
const FORBIDDEN_MESSAGE = 'Names can\'t contain any of these characters: \\ / : * ? " < > |'

/** An ending that reads as a file type, such as ".txt", rather than "v1.2". */
const LOOKS_LIKE_EXTENSION = /^\.[a-z][a-z0-9]{0,5}$/

export type RenameCheck =
  | { ok: true; name: string; unchanged: boolean }
  | { ok: false; error: string }

/** What a rename action hands back to the dialog that asked for it. */
export type RenameOutcome =
  | { ok: true; name: string; notice?: string }
  | { ok: false; message: string }

function commonProblem(trimmed: string, noun: "file" | "folder"): string | null {
  if (!trimmed) return `Enter a ${noun} name`
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Keep the name to ${MAX_NAME_LENGTH} characters or fewer`
  }
  if (FORBIDDEN_CHARACTERS.test(trimmed) || CONTROL_CHARACTERS.test(trimmed)) {
    return FORBIDDEN_MESSAGE
  }
  return null
}

/** The extension exactly as stored, including the dot, or "" when there is none. */
function storedExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  return dot <= 0 ? "" : fileName.slice(dot)
}

/**
 * Check a new name for an existing file.
 *
 * A rename never changes what kind of file it is: the ending the file already
 * has is kept, and added back when it is left off. That is what stops
 * `lesson.py` becoming `revision.txt`, or a stylesheet being renamed into the
 * Python IDE's tree.
 */
export function validateFileRename(
  currentName: string,
  input: string,
  language: LanguageId,
): RenameCheck {
  const trimmed = typeof input === "string" ? input.trim() : ""
  const problem = commonProblem(trimmed, "file")
  if (problem) return { ok: false, error: problem }
  if (trimmed.includes("..")) return { ok: false, error: 'File names can\'t contain ".."' }

  const currentExt = storedExtension(currentName)

  // A file with no ending predates the rule that every file has one, so it is
  // named the way a new file would be.
  if (!currentExt) {
    const normalised = normaliseFileName(trimmed, language)
    if (!normalised.ok) return normalised
    return { ok: true, name: normalised.name, unchanged: normalised.name === currentName }
  }

  const typedExt = extensionOf(trimmed)
  let name: string

  if (typedExt === currentExt.toLowerCase()) {
    name = trimmed
  } else if (
    typedExt &&
    (languageForExtension(typedExt) !== null || LOOKS_LIKE_EXTENSION.test(typedExt))
  ) {
    return {
      ok: false,
      error: `Renaming can't change the file type. End the name with ${currentExt}, or leave the ending off and it is added for you.`,
    }
  } else {
    name = `${trimmed}${currentExt}`
  }

  // A name that is nothing but its ending, such as ".py".
  if (name.length <= currentExt.length || name.startsWith(".")) {
    return { ok: false, error: "Enter a file name" }
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Keep the name to ${MAX_NAME_LENGTH} characters or fewer` }
  }

  return { ok: true, name, unchanged: name === currentName }
}

/** Check a new name for an existing folder. */
export function validateFolderRename(currentName: string, input: string): RenameCheck {
  const trimmed = typeof input === "string" ? input.trim() : ""
  const problem = commonProblem(trimmed, "folder")
  if (problem) return { ok: false, error: problem }
  if (trimmed === "." || trimmed === "..") {
    return { ok: false, error: "Enter a folder name" }
  }
  return { ok: true, name: trimmed, unchanged: trimmed === currentName }
}

/**
 * Whether a name is already used by something else in the same place.
 *
 * Compared without regard to case: `Notes.py` beside `notes.py` cannot be
 * unpacked on most computers, and reads as a mistake everywhere else.
 */
export function hasNameClash(siblingNames: readonly string[], name: string): boolean {
  const wanted = name.trim().toLowerCase()
  return siblingNames.some((sibling) => sibling.trim().toLowerCase() === wanted)
}

export type WithdrawalFolder = {
  id: number
  parentId: number | null
  assignedByTeacher: boolean
}

export type WithdrawalFile = {
  folderId: number | null
  assignedByTeacher: boolean
}

export type FolderWithdrawalPlan = {
  /** Every folder that was the teacher's to take back, kept or not. */
  teacherFolderIds: number[]
  /** Folders with nothing of the pupil's in them: hidden from the pupil. */
  withdrawFolderIds: number[]
  /** Folders still holding the pupil's own work: they become the pupil's. */
  handOverFolderIds: number[]
}

/**
 * Decide what happens to pupils' copies of a folder a teacher is deleting.
 *
 * The teacher's folders go, with any teacher folders inside them. But a pupil
 * can save their own files and folders inside a folder they were given, and
 * that work is theirs: a folder still holding any of it — directly, or further
 * down — is kept and handed to the pupil rather than taken away with the work
 * inside it.
 *
 * `folders` and `files` are the pupils' live rows; `copyIds` are the folders
 * that are copies of what is being deleted.
 */
export function planFolderWithdrawal(input: {
  folders: readonly WithdrawalFolder[]
  files: readonly WithdrawalFile[]
  copyIds: readonly number[]
}): FolderWithdrawalPlan {
  const byId = new Map(input.folders.map((folder) => [folder.id, folder]))
  const childrenOf = new Map<number, WithdrawalFolder[]>()
  for (const folder of input.folders) {
    if (folder.parentId === null) continue
    const bucket = childrenOf.get(folder.parentId)
    if (bucket) bucket.push(folder)
    else childrenOf.set(folder.parentId, [folder])
  }

  // The copies themselves, and every teacher folder beneath them. A folder the
  // pupil made is never a candidate, and neither is anything inside it.
  const teacherFolders = new Set<number>()
  const queue = input.copyIds.filter((id) => byId.has(id))
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (teacherFolders.has(id)) continue
    teacherFolders.add(id)
    for (const child of childrenOf.get(id) ?? []) {
      if (child.assignedByTeacher) queue.push(child.id)
    }
  }

  const holdsPupilFile = new Set<number>()
  for (const file of input.files) {
    if (file.folderId !== null && !file.assignedByTeacher) holdsPupilFile.add(file.folderId)
  }

  const kept = new Map<number, boolean>()
  const mustKeep = (id: number): boolean => {
    const known = kept.get(id)
    if (known !== undefined) return known
    // Set before descending so rows that point at each other cannot recurse
    // forever; nothing in the product creates such a loop.
    kept.set(id, false)
    const result =
      holdsPupilFile.has(id) ||
      (childrenOf.get(id) ?? []).some(
        (child) => !teacherFolders.has(child.id) || mustKeep(child.id),
      )
    kept.set(id, result)
    return result
  }

  const withdrawFolderIds: number[] = []
  const handOverFolderIds: number[] = []
  for (const id of teacherFolders) {
    if (mustKeep(id)) handOverFolderIds.push(id)
    else withdrawFolderIds.push(id)
  }

  return { teacherFolderIds: [...teacherFolders], withdrawFolderIds, handOverFolderIds }
}
