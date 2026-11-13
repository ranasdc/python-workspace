"use server"

/**
 * Renaming and deleting files and folders, for every IDE.
 *
 * One module on purpose. The Python and HTML IDEs — and any IDE added later —
 * call these same actions, so who may rename or delete what is decided once,
 * here, rather than once per IDE. Nothing below branches on a language: a
 * file's own `language` column is read only to keep its extension valid.
 *
 * Ownership is read from the rows themselves on every call:
 *
 * - A student's own work is a `code_file` / `student_folder` row carrying
 *   their id with `assignedByTeacher` false. Only they may rename it.
 * - A teacher's resource is a `library_file` / `library_folder` row carrying
 *   their id. The copies handed to students point back at it
 *   (`sourceLibraryFileId` / `sourceLibraryFolderId`) and are flagged
 *   `assignedByTeacher`; only the teacher who owns the original, acting on
 *   classes they own, may rename or withdraw them.
 *
 * No action here consults a plan or subscription. Renaming your own work is
 * ordinary file management, not a paid feature.
 *
 * Expected refusals are returned rather than thrown: a thrown Server Action
 * error has its message redacted in production, which would leave the dialog
 * with nothing useful to show.
 */

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  fileTasks,
  libraryFiles,
  libraryFolders,
  studentFolders,
} from "@/lib/db/schema"
import { getEntitlement } from "@/lib/entitlements"
import {
  hasNameClash,
  planFolderWithdrawal,
  validateFileRename,
  validateFolderRename,
  type RenameOutcome,
} from "@/lib/ide/file-management"
import { subtreeFolderIds } from "@/lib/ide/folder-tree"
import { isLanguageId } from "@/lib/ide/languages"
import { requireUser } from "@/lib/session"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type DeleteOutcome =
  | { ok: true; studentsAffected: number }
  | { ok: false; message: string }

export type LibraryItemReach = { students: number; classes: number }

/** Ids per statement, well inside Postgres's limit on bound parameters. */
const ID_BATCH = 5000

const NOT_A_TEACHER = { ok: false as const, message: "Only teachers can do that." }

function fail(message: string) {
  return { ok: false as const, message }
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function batches<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let start = 0; start < items.length; start += ID_BATCH) {
    out.push(items.slice(start, start + ID_BATCH))
  }
  return out
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

// Capability comes from the entitlement engine, not from the session's `role`
// field: a school teacher who signed up as a student must still be able to
// manage their library, and the session value is only a sign-up choice.
async function currentTeacher() {
  const me = await requireUser()
  const entitlement = await getEntitlement(me.id)
  return entitlement.isTeacher ? me : null
}

/**
 * The classes this teacher owns. Every write to a student's copy is limited to
 * these, so a copy sitting in someone else's class is never touched even if it
 * somehow pointed at this teacher's resource.
 */
async function ownedClassIds(tx: Transaction, teacherId: string) {
  const rows = await tx
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
  return rows.map((row) => row.id)
}

// ---------- Student: rename own files & folders ----------

async function isEnrolled(studentId: string, classId: number) {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId)))
    .limit(1)
  return Boolean(row)
}

export async function renameStudentFile(fileId: number, name: string): Promise<RenameOutcome> {
  const me = await requireUser()
  if (!isId(fileId)) return fail("File not found")

  // Scoped to the caller's own rows, so another student's file is simply not
  // found, whatever id a crafted request names.
  const [file] = await db
    .select({
      id: codeFiles.id,
      classId: codeFiles.classId,
      folderId: codeFiles.folderId,
      name: codeFiles.name,
      language: codeFiles.language,
      assignedByTeacher: codeFiles.assignedByTeacher,
    })
    .from(codeFiles)
    .where(
      and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, me.id), isNull(codeFiles.withdrawnAt)),
    )
    .limit(1)
  if (!file) return fail("File not found")

  // Checked here and not only by hiding the menu: the file sits in the
  // student's own tree, so without this a request made by hand would rename it.
  if (file.assignedByTeacher) {
    return fail("This file was shared by your teacher, so only they can rename it.")
  }

  // Work kept after leaving a class is a record, as it is for delete.
  if (!(await isEnrolled(me.id, file.classId))) {
    return fail("You are no longer in this class, so its files can't be changed.")
  }

  if (!isLanguageId(file.language)) return fail("This file can't be renamed.")
  const checked = validateFileRename(file.name, name, file.language)
  if (!checked.ok) return fail(checked.error)
  if (checked.unchanged) return { ok: true, name: checked.name }

  const siblings = await db
    .select({ name: codeFiles.name })
    .from(codeFiles)
    .where(
      and(
        eq(codeFiles.studentId, me.id),
        eq(codeFiles.classId, file.classId),
        file.folderId === null ? isNull(codeFiles.folderId) : eq(codeFiles.folderId, file.folderId),
        ne(codeFiles.id, file.id),
        isNull(codeFiles.withdrawnAt),
      ),
    )
  if (hasNameClash(siblings.map((s) => s.name), checked.name)) {
    return fail(`There is already a file called "${checked.name}" here.`)
  }

  // Only the name changes. Content, folder, marking and feedback all hang off
  // the row's id, so they stay exactly as they were.
  await db
    .update(codeFiles)
    .set({ name: checked.name })
    .where(and(eq(codeFiles.id, file.id), eq(codeFiles.studentId, me.id)))

  revalidatePath("/student")
  revalidatePath("/teacher")
  return { ok: true, name: checked.name }
}

export async function renameStudentFolder(folderId: number, name: string): Promise<RenameOutcome> {
  const me = await requireUser()
  if (!isId(folderId)) return fail("Folder not found")

  const [folder] = await db
    .select({
      id: studentFolders.id,
      classId: studentFolders.classId,
      parentId: studentFolders.parentId,
      name: studentFolders.name,
      language: studentFolders.language,
      assignedByTeacher: studentFolders.assignedByTeacher,
    })
    .from(studentFolders)
    .where(
      and(
        eq(studentFolders.id, folderId),
        eq(studentFolders.studentId, me.id),
        isNull(studentFolders.withdrawnAt),
      ),
    )
    .limit(1)
  if (!folder) return fail("Folder not found")

  if (folder.assignedByTeacher) {
    return fail("This folder was shared by your teacher, so only they can rename it.")
  }

  if (!(await isEnrolled(me.id, folder.classId))) {
    return fail("You are no longer in this class, so its folders can't be changed.")
  }

  const checked = validateFolderRename(folder.name, name)
  if (!checked.ok) return fail(checked.error)
  if (checked.unchanged) return { ok: true, name: checked.name }

  const siblings = await db
    .select({ name: studentFolders.name })
    .from(studentFolders)
    .where(
      and(
        eq(studentFolders.studentId, me.id),
        eq(studentFolders.classId, folder.classId),
        eq(studentFolders.language, folder.language),
        folder.parentId === null
          ? isNull(studentFolders.parentId)
          : eq(studentFolders.parentId, folder.parentId),
        ne(studentFolders.id, folder.id),
        isNull(studentFolders.withdrawnAt),
      ),
    )
  if (hasNameClash(siblings.map((s) => s.name), checked.name)) {
    return fail(`There is already a folder called "${checked.name}" here.`)
  }

  // Files and subfolders refer to this folder by id, so everything inside it
  // stays where it is.
  await db
    .update(studentFolders)
    .set({ name: checked.name })
    .where(and(eq(studentFolders.id, folder.id), eq(studentFolders.studentId, me.id)))

  revalidatePath("/student")
  revalidatePath("/teacher")
  return { ok: true, name: checked.name }
}

// ---------- Teacher: rename library resources and their distributed copies ----------

/** Shown when some students' copies could not take the new name. */
function keptOldNameNotice(skipped: number, kind: "file" | "folder") {
  if (skipped === 0) return undefined
  return `${plural(skipped, "student")} already ${skipped === 1 ? "has" : "have"} a ${kind} with that name in the same place, so their copy kept its old name.`
}

export async function renameLibraryFile(fileId: number, name: string): Promise<RenameOutcome> {
  const teacher = await currentTeacher()
  if (!teacher) return NOT_A_TEACHER
  if (!isId(fileId)) return fail("File not found")

  // Another teacher's file is not in this set, so it reads as not found.
  const [file] = await db
    .select()
    .from(libraryFiles)
    .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.teacherId, teacher.id)))
    .limit(1)
  if (!file) return fail("File not found")

  if (!isLanguageId(file.language)) return fail("This file can't be renamed.")
  const checked = validateFileRename(file.name, name, file.language)
  if (!checked.ok) return fail(checked.error)
  if (checked.unchanged) return { ok: true, name: checked.name }
  const newName = checked.name

  const siblings = await db
    .select({ name: libraryFiles.name })
    .from(libraryFiles)
    .where(
      and(
        eq(libraryFiles.teacherId, teacher.id),
        eq(libraryFiles.language, file.language),
        file.folderId === null
          ? isNull(libraryFiles.folderId)
          : eq(libraryFiles.folderId, file.folderId),
        ne(libraryFiles.id, file.id),
      ),
    )
  if (hasNameClash(siblings.map((s) => s.name), newName)) {
    return fail(`There is already a file called "${newName}" here.`)
  }

  const skipped = await db.transaction(async (tx) => {
    await tx
      .update(libraryFiles)
      .set({ name: newName })
      .where(and(eq(libraryFiles.id, file.id), eq(libraryFiles.teacherId, teacher.id)))

    const classIds = await ownedClassIds(tx, teacher.id)
    if (classIds.length === 0) return 0

    const copies = and(
      eq(codeFiles.sourceLibraryFileId, file.id),
      eq(codeFiles.assignedByTeacher, true),
      isNull(codeFiles.withdrawnAt),
      inArray(codeFiles.classId, classIds),
    )

    // Each student's copy takes the new name in place: same row, same content,
    // same folder. A copy is left alone only where the student already has
    // something else by that name beside it, so two files never share a name.
    await tx
      .update(codeFiles)
      .set({ name: newName })
      .where(
        and(
          copies,
          sql`NOT EXISTS (
            SELECT 1 FROM "code_file" other
            WHERE other."studentId" = "code_file"."studentId"
              AND other."classId" = "code_file"."classId"
              AND other."folderId" IS NOT DISTINCT FROM "code_file"."folderId"
              AND other."id" <> "code_file"."id"
              AND other."withdrawnAt" IS NULL
              AND lower(other."name") = lower(${newName})
          )`,
        ),
      )

    const left = await tx
      .select({ id: codeFiles.id })
      .from(codeFiles)
      .where(and(copies, ne(codeFiles.name, newName)))
    return left.length
  })

  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, name: newName, notice: keptOldNameNotice(skipped, "file") }
}

export async function renameLibraryFolder(folderId: number, name: string): Promise<RenameOutcome> {
  const teacher = await currentTeacher()
  if (!teacher) return NOT_A_TEACHER
  if (!isId(folderId)) return fail("Folder not found")

  const [folder] = await db
    .select()
    .from(libraryFolders)
    .where(and(eq(libraryFolders.id, folderId), eq(libraryFolders.teacherId, teacher.id)))
    .limit(1)
  if (!folder) return fail("Folder not found")

  const checked = validateFolderRename(folder.name, name)
  if (!checked.ok) return fail(checked.error)
  if (checked.unchanged) return { ok: true, name: checked.name }
  const newName = checked.name

  const siblings = await db
    .select({ name: libraryFolders.name })
    .from(libraryFolders)
    .where(
      and(
        eq(libraryFolders.teacherId, teacher.id),
        eq(libraryFolders.language, folder.language),
        folder.parentId === null
          ? isNull(libraryFolders.parentId)
          : eq(libraryFolders.parentId, folder.parentId),
        ne(libraryFolders.id, folder.id),
      ),
    )
  if (hasNameClash(siblings.map((s) => s.name), newName)) {
    return fail(`There is already a folder called "${newName}" here.`)
  }

  const skipped = await db.transaction(async (tx) => {
    await tx
      .update(libraryFolders)
      .set({ name: newName })
      .where(and(eq(libraryFolders.id, folder.id), eq(libraryFolders.teacherId, teacher.id)))

    const classIds = await ownedClassIds(tx, teacher.id)
    if (classIds.length === 0) return 0

    const copies = and(
      eq(studentFolders.sourceLibraryFolderId, folder.id),
      eq(studentFolders.assignedByTeacher, true),
      isNull(studentFolders.withdrawnAt),
      inArray(studentFolders.classId, classIds),
    )

    // Only the folder row's name changes. Its files and subfolders point at it
    // by id, so every student's copy keeps its whole contents and structure.
    await tx
      .update(studentFolders)
      .set({ name: newName })
      .where(
        and(
          copies,
          sql`NOT EXISTS (
            SELECT 1 FROM "student_folder" other
            WHERE other."studentId" = "student_folder"."studentId"
              AND other."classId" = "student_folder"."classId"
              AND other."language" = "student_folder"."language"
              AND other."parentId" IS NOT DISTINCT FROM "student_folder"."parentId"
              AND other."id" <> "student_folder"."id"
              AND other."withdrawnAt" IS NULL
              AND lower(other."name") = lower(${newName})
          )`,
        ),
      )

    const left = await tx
      .select({ id: studentFolders.id })
      .from(studentFolders)
      .where(and(copies, ne(studentFolders.name, newName)))
    return left.length
  })

  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, name: newName, notice: keptOldNameNotice(skipped, "folder") }
}

// ---------- Teacher: delete library resources and withdraw their copies ----------

/**
 * Hide every live copy of these library files from the students who hold one.
 *
 * Withdrawn, not deleted: a student may have worked in their copy, and a
 * teacher may have marked or commented on it. The row keeps all of that; it is
 * only skipped by every read from now on.
 */
async function withdrawFileCopies(
  tx: Transaction,
  libraryFileIds: number[],
  classIds: number[],
  affected: Set<string>,
) {
  if (classIds.length === 0) return
  for (const ids of batches(libraryFileIds)) {
    const rows = await tx
      .update(codeFiles)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          inArray(codeFiles.sourceLibraryFileId, ids),
          eq(codeFiles.assignedByTeacher, true),
          isNull(codeFiles.withdrawnAt),
          inArray(codeFiles.classId, classIds),
        ),
      )
      .returning({ studentId: codeFiles.studentId })
    for (const row of rows) affected.add(row.studentId)
  }
}

export async function deleteLibraryFile(fileId: number): Promise<DeleteOutcome> {
  const teacher = await currentTeacher()
  if (!teacher) return NOT_A_TEACHER
  if (!isId(fileId)) return fail("File not found")

  const affected = new Set<string>()
  const found = await db.transaction(async (tx) => {
    const [file] = await tx
      .select({ id: libraryFiles.id })
      .from(libraryFiles)
      .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.teacherId, teacher.id)))
      .limit(1)
    if (!file) return false

    // One rule for every distribution of this file: each class and each
    // student that received it loses it together, in the same transaction as
    // the original, so nothing is left pointing at a file that has gone.
    await withdrawFileCopies(tx, [file.id], await ownedClassIds(tx, teacher.id), affected)

    await tx
      .delete(fileTasks)
      .where(and(eq(fileTasks.libraryFileId, file.id), eq(fileTasks.teacherId, teacher.id)))
    await tx
      .delete(libraryFiles)
      .where(and(eq(libraryFiles.id, file.id), eq(libraryFiles.teacherId, teacher.id)))
    return true
  })
  if (!found) return fail("File not found")

  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, studentsAffected: affected.size }
}

export async function deleteLibraryFolder(folderId: number): Promise<DeleteOutcome> {
  const teacher = await currentTeacher()
  if (!teacher) return NOT_A_TEACHER
  if (!isId(folderId)) return fail("Folder not found")

  const affected = new Set<string>()
  const found = await db.transaction(async (tx) => {
    // Only this teacher's folders are read, so the subtree can never reach
    // into a colleague's library.
    const owned = await tx
      .select({
        id: libraryFolders.id,
        parentId: libraryFolders.parentId,
        name: libraryFolders.name,
      })
      .from(libraryFolders)
      .where(eq(libraryFolders.teacherId, teacher.id))
    if (!owned.some((folder) => folder.id === folderId)) return false

    const doomedFolders = subtreeFolderIds(owned, folderId)
    const doomedFiles = (
      await tx
        .select({ id: libraryFiles.id })
        .from(libraryFiles)
        .where(
          and(inArray(libraryFiles.folderId, doomedFolders), eq(libraryFiles.teacherId, teacher.id)),
        )
    ).map((row) => row.id)

    const classIds = await ownedClassIds(tx, teacher.id)
    await withdrawFileCopies(tx, doomedFiles, classIds, affected)

    const copies = classIds.length
      ? await tx
          .select({
            id: studentFolders.id,
            classId: studentFolders.classId,
            studentId: studentFolders.studentId,
          })
          .from(studentFolders)
          .where(
            and(
              inArray(studentFolders.sourceLibraryFolderId, doomedFolders),
              eq(studentFolders.assignedByTeacher, true),
              isNull(studentFolders.withdrawnAt),
              inArray(studentFolders.classId, classIds),
            ),
          )
      : []

    if (copies.length > 0) {
      for (const copy of copies) affected.add(copy.studentId)
      const copyClassIds = [...new Set(copies.map((copy) => copy.classId))]
      const studentIds = [...new Set(copies.map((copy) => copy.studentId))]

      // The trees these copies sit in, to see what each student has put inside
      // the folders they were given.
      const [liveFolders, liveFiles] = await Promise.all([
        tx
          .select({
            id: studentFolders.id,
            parentId: studentFolders.parentId,
            assignedByTeacher: studentFolders.assignedByTeacher,
          })
          .from(studentFolders)
          .where(
            and(
              inArray(studentFolders.classId, copyClassIds),
              inArray(studentFolders.studentId, studentIds),
              isNull(studentFolders.withdrawnAt),
            ),
          ),
        tx
          .select({ folderId: codeFiles.folderId, assignedByTeacher: codeFiles.assignedByTeacher })
          .from(codeFiles)
          .where(
            and(
              inArray(codeFiles.classId, copyClassIds),
              inArray(codeFiles.studentId, studentIds),
              isNull(codeFiles.withdrawnAt),
            ),
          ),
      ])

      const plan = planFolderWithdrawal({
        folders: liveFolders,
        files: liveFiles,
        copyIds: copies.map((copy) => copy.id),
      })
      const now = new Date()

      // Teacher files still sitting in these folders — ones whose original was
      // deleted before copies were tracked — go with the folder. A student's
      // own files are never matched: they are not flagged assignedByTeacher.
      for (const ids of batches(plan.teacherFolderIds)) {
        await tx
          .update(codeFiles)
          .set({ withdrawnAt: now })
          .where(
            and(
              inArray(codeFiles.folderId, ids),
              eq(codeFiles.assignedByTeacher, true),
              isNull(codeFiles.withdrawnAt),
              inArray(codeFiles.classId, classIds),
            ),
          )
      }
      for (const ids of batches(plan.withdrawFolderIds)) {
        await tx
          .update(studentFolders)
          .set({ withdrawnAt: now })
          .where(and(inArray(studentFolders.id, ids), inArray(studentFolders.classId, classIds)))
      }
      // A folder still holding the student's own work becomes theirs, so that
      // work stays exactly where they saved it.
      for (const ids of batches(plan.handOverFolderIds)) {
        await tx
          .update(studentFolders)
          .set({ assignedByTeacher: false, sourceLibraryFolderId: null })
          .where(and(inArray(studentFolders.id, ids), inArray(studentFolders.classId, classIds)))
      }
    }

    if (doomedFiles.length > 0) {
      await tx
        .delete(fileTasks)
        .where(
          and(inArray(fileTasks.libraryFileId, doomedFiles), eq(fileTasks.teacherId, teacher.id)),
        )
    }
    await tx
      .delete(libraryFiles)
      .where(
        and(inArray(libraryFiles.folderId, doomedFolders), eq(libraryFiles.teacherId, teacher.id)),
      )
    await tx
      .delete(libraryFolders)
      .where(
        and(inArray(libraryFolders.id, doomedFolders), eq(libraryFolders.teacherId, teacher.id)),
      )
    return true
  })
  if (!found) return fail("Folder not found")

  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, studentsAffected: affected.size }
}

/**
 * How many students and classes hold a live copy of a library file or folder.
 *
 * Read by the delete confirmation, so a teacher sees who is affected before
 * agreeing. Limited to the caller's own resources and own classes, so it says
 * nothing about anyone else's.
 */
export async function getLibraryItemReach(
  kind: "file" | "folder",
  id: number,
): Promise<LibraryItemReach> {
  const none = { students: 0, classes: 0 }
  const teacher = await currentTeacher()
  if (!teacher || !isId(id)) return none

  let fileIds: number[] = []
  let folderIds: number[] = []

  if (kind === "file") {
    const [file] = await db
      .select({ id: libraryFiles.id })
      .from(libraryFiles)
      .where(and(eq(libraryFiles.id, id), eq(libraryFiles.teacherId, teacher.id)))
      .limit(1)
    if (!file) return none
    fileIds = [file.id]
  } else {
    const owned = await db
      .select({
        id: libraryFolders.id,
        parentId: libraryFolders.parentId,
        name: libraryFolders.name,
      })
      .from(libraryFolders)
      .where(eq(libraryFolders.teacherId, teacher.id))
    if (!owned.some((folder) => folder.id === id)) return none
    folderIds = subtreeFolderIds(owned, id)
    fileIds = (
      await db
        .select({ id: libraryFiles.id })
        .from(libraryFiles)
        .where(
          and(inArray(libraryFiles.folderId, folderIds), eq(libraryFiles.teacherId, teacher.id)),
        )
    ).map((row) => row.id)
  }

  const classIds = (
    await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, teacher.id))
  ).map((row) => row.id)
  if (classIds.length === 0) return none

  const [fileCopies, folderCopies] = await Promise.all([
    fileIds.length
      ? db
          .selectDistinct({ studentId: codeFiles.studentId, classId: codeFiles.classId })
          .from(codeFiles)
          .where(
            and(
              inArray(codeFiles.sourceLibraryFileId, fileIds),
              eq(codeFiles.assignedByTeacher, true),
              isNull(codeFiles.withdrawnAt),
              inArray(codeFiles.classId, classIds),
            ),
          )
      : [],
    folderIds.length
      ? db
          .selectDistinct({ studentId: studentFolders.studentId, classId: studentFolders.classId })
          .from(studentFolders)
          .where(
            and(
              inArray(studentFolders.sourceLibraryFolderId, folderIds),
              eq(studentFolders.assignedByTeacher, true),
              isNull(studentFolders.withdrawnAt),
              inArray(studentFolders.classId, classIds),
            ),
          )
      : [],
  ])

  const students = new Set<string>()
  const reached = new Set<number>()
  for (const row of [...fileCopies, ...folderCopies]) {
    students.add(row.studentId)
    reached.add(row.classId)
  }
  return { students: students.size, classes: reached.size }
}
