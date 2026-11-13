"use server"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  libraryFiles,
  libraryFolders,
  studentFolders,
} from "@/lib/db/schema"
import { resolveRecipientIds, type RecipientSelection } from "@/lib/distribution"
import { requireTeacherCapability } from "@/lib/entitlements"
import { subtreeFolderIds } from "@/lib/ide/folder-tree"
import { requireUser } from "@/lib/session"

/** A query runner bound to the transaction a distribution runs in. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * First key of the advisory lock taken per class. Any fixed number works; it
 * only has to differ from the key space of every other advisory lock.
 */
const DISTRIBUTION_LOCK_SPACE = 7301

/** Rows per insert, well inside Postgres's limit of 65,535 bound parameters. */
const INSERT_BATCH = 500

// Capability comes from the entitlement engine, not from the session's `role`
// field: a school teacher who signed up as a student must still be able to
// teach, and the session value reflects only a self-declared sign-up choice.
async function requireTeacher() {
  const me = await requireUser()
  await requireTeacherCapability(me.id)
  return me
}

function assertId(value: unknown, what: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${what} not found`)
  }
}

/**
 * Checks the class is the caller's, then works out who receives the work.
 *
 * Everything from here runs behind a lock on the class, held until the
 * transaction ends. "Does this student already have this file?" and the insert
 * that follows are two statements, so two overlapping distributions — a
 * double-click, two tabs — could otherwise both see the file as missing and
 * both create it. Serialising them is what keeps a copy from being duplicated
 * without adding a constraint to the table.
 */
async function resolveRecipients(
  tx: Transaction,
  teacherId: string,
  classId: number,
  selection: RecipientSelection,
) {
  // Ownership first, and before the lock: being a teacher somewhere must not
  // let anyone reach — or even briefly hold up — another teacher's class.
  const [cls] = await tx
    .select({ id: classes.id, isPersonal: classes.isPersonal })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
  if (!cls) throw new Error("Class not found")

  // Distributed files are flagged assignedByTeacher and are deliberately exempt
  // from the recipient's free-tier quota. Without this guard, and the one that
  // drops the teacher from the recipients, a teacher-role account could
  // distribute into its own personal workspace, or to itself, and mint
  // unlimited files the quota never counts.
  if (cls.isPersonal) throw new Error("Cannot distribute into a personal workspace")

  await tx.execute(sql`SELECT pg_advisory_xact_lock(${DISTRIBUTION_LOCK_SPACE}, ${classId})`)

  const enrolled = await tx
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.classId, classId))

  // Every requested id is matched against this class's own enrolments, so a
  // forged request cannot name a student in someone else's class.
  return resolveRecipientIds(
    selection,
    enrolled.map((row) => row.studentId),
    teacherId,
  )
}

// Copy a set of library files to each recipient. If a recipient already has a
// file with the same name in the same location (folder or root), we skip it so
// their work is never overwritten. `folderIdFor` says which of a student's
// folders a file lands in, given the library folder it came from (null = class
// root).
async function copyFilesToStudents(
  tx: Transaction,
  fileIds: number[],
  teacherId: string,
  classId: number,
  recipientIds: string[],
  folderIdFor?: (studentId: string, sourceFolderId: number | null) => number | null,
) {
  if (fileIds.length === 0 || recipientIds.length === 0) return 0

  const sourceFiles = await tx
    .select()
    .from(libraryFiles)
    .where(and(inArray(libraryFiles.id, fileIds), eq(libraryFiles.teacherId, teacherId)))
  if (sourceFiles.length === 0) return 0

  // Withdrawn copies are skipped: they are hidden records of a deleted
  // original, and must not stop a new file of the same name being delivered.
  const existing = await tx
    .select({
      studentId: codeFiles.studentId,
      name: codeFiles.name,
      folderId: codeFiles.folderId,
      sourceLibraryFileId: codeFiles.sourceLibraryFileId,
    })
    .from(codeFiles)
    .where(
      and(
        eq(codeFiles.classId, classId),
        inArray(codeFiles.studentId, recipientIds),
        isNull(codeFiles.withdrawnAt),
      ),
    )
  const taken = new Set(existing.map((e) => `${e.studentId}::${e.folderId ?? "root"}::${e.name}`))
  // A copy is recognised by the original it came from as well as by its name.
  // After a rename, a student whose copy had to keep its old name still holds
  // this file, and must not be sent a second copy of it.
  const held = new Set(
    existing
      .filter((e) => e.sourceLibraryFileId !== null)
      .map((e) => `${e.studentId}::${e.folderId ?? "root"}::${e.sourceLibraryFileId}`),
  )

  const rows: (typeof codeFiles.$inferInsert)[] = []

  for (const student of recipientIds) {
    for (const file of sourceFiles) {
      const folderId = folderIdFor ? folderIdFor(student, file.folderId) : null
      const key = `${student}::${folderId ?? "root"}::${file.name}`
      if (taken.has(key)) continue
      if (held.has(`${student}::${folderId ?? "root"}::${file.id}`)) continue
      // Two library files with one name, in folders that land in the same
      // place, would otherwise both be written in this single pass.
      taken.add(key)
      rows.push({
        classId,
        studentId: student,
        folderId,
        name: file.name,
        // Carried from the source file, so a distributed page lands in the
        // student's HTML IDE rather than appearing in their Python tree.
        language: file.language,
        content: file.content,
        assignedByTeacher: true,
        // Points back at the library file so the student's copy resolves the
        // teacher's current task text, and picks up later edits to it.
        sourceLibraryFileId: file.id,
      })
    }
  }

  for (let start = 0; start < rows.length; start += INSERT_BATCH) {
    await tx.insert(codeFiles).values(rows.slice(start, start + INSERT_BATCH))
  }
  return rows.length
}

/**
 * Send one library file to a whole class, to one student, or to a chosen set.
 *
 * `recipients` is `null` for everyone enrolled, a student id for one, or a
 * list of ids for a selection. The whole operation is one transaction: if any
 * copy fails, none are kept, so a class is never left half-supplied.
 */
export async function distributeFile(
  fileId: number,
  classId: number,
  recipients: RecipientSelection,
) {
  const teacher = await requireTeacher()
  assertId(fileId, "File")
  assertId(classId, "Class")

  const result = await db.transaction(async (tx) => {
    const recipientIds = await resolveRecipients(tx, teacher.id, classId, recipients)
    const delivered = await copyFilesToStudents(tx, [fileId], teacher.id, classId, recipientIds)
    return { delivered, recipients: recipientIds.length }
  })

  revalidatePath("/teacher")
  revalidatePath("/student")
  return result
}

/**
 * Send a library folder, with every folder and file beneath it, to a whole
 * class, to one student, or to a chosen set. Recipients are given as for
 * `distributeFile`, and the same all-or-nothing transaction applies — which
 * here also means no recipient is ever left with the folders but not the
 * files meant to be inside them.
 */
export async function distributeFolder(
  folderId: number,
  classId: number,
  recipients: RecipientSelection,
) {
  const teacher = await requireTeacher()
  assertId(folderId, "Folder")
  assertId(classId, "Class")

  const result = await db.transaction(async (tx) => {
    // Confirm the folder belongs to this teacher and grab its name.
    const [folder] = await tx
      .select()
      .from(libraryFolders)
      .where(and(eq(libraryFolders.id, folderId), eq(libraryFolders.teacherId, teacher.id)))
    if (!folder) throw new Error("Folder not found")

    // The folder travels with everything beneath it. Subfolders always share
    // their parent's IDE, so scoping by language loses nothing.
    const owned = await tx
      .select()
      .from(libraryFolders)
      .where(
        and(eq(libraryFolders.teacherId, teacher.id), eq(libraryFolders.language, folder.language)),
      )
    const ownedById = new Map(owned.map((f) => [f.id, f]))
    // Parents come before their children, so a student's copy of a folder
    // always exists by the time its subfolders are placed inside it.
    const sourceFolders = subtreeFolderIds(owned, folderId).flatMap((id) => {
      const source = ownedById.get(id)
      return source ? [source] : []
    })
    const sourceFolderIds = sourceFolders.map((f) => f.id)

    const files = await tx
      .select({ id: libraryFiles.id })
      .from(libraryFiles)
      .where(
        and(inArray(libraryFiles.folderId, sourceFolderIds), eq(libraryFiles.teacherId, teacher.id)),
      )
    if (files.length === 0) throw new Error("This folder has no files to distribute")

    const recipientIds = await resolveRecipients(tx, teacher.id, classId, recipients)

    // Recreate the folders for each recipient so the whole structure is shared —
    // reusing a teacher-assigned folder of the same name in the same place to
    // avoid duplicates on repeat distributions.
    const assigned =
      recipientIds.length > 0
        ? await tx
            .select()
            .from(studentFolders)
            .where(
              and(
                eq(studentFolders.classId, classId),
                // Same-named folders in different IDEs are different folders.
                eq(studentFolders.language, folder.language),
                eq(studentFolders.assignedByTeacher, true),
                inArray(studentFolders.studentId, recipientIds),
                // A withdrawn folder is a hidden record, never a place to put
                // new work.
                isNull(studentFolders.withdrawnAt),
              ),
            )
        : []

    // Where a folder sits is part of its identity: "Week 1" inside "Unit 2" is
    // not the "Week 1" at the top of the class.
    const placeKey = (student: string, parentId: number | null, name: string) =>
      `${student}::${parentId ?? "root"}::${name}`
    // A copy that records which library folder it came from is found by that
    // first, so it is still recognised after either side has been renamed.
    const originKey = (student: string, parentId: number | null, sourceId: number) =>
      `${student}::${parentId ?? "root"}::${sourceId}`
    const assignedAt = new Map<string, number>()
    const copiedAt = new Map<string, number>()
    const unlinked = new Set<number>()
    for (const f of assigned) {
      const key = placeKey(f.studentId, f.parentId, f.name)
      if (!assignedAt.has(key)) assignedAt.set(key, f.id)
      if (f.sourceLibraryFolderId === null) {
        unlinked.add(f.id)
      } else {
        const origin = originKey(f.studentId, f.parentId, f.sourceLibraryFolderId)
        if (!copiedAt.has(origin)) copiedAt.set(origin, f.id)
      }
    }

    // Library folder id -> student id -> that student's copy of the folder.
    const copyOf = new Map<number, Map<string, number>>()
    for (const source of sourceFolders) {
      const copies = new Map<string, number>()
      const missing: { studentId: string; parentId: number | null }[] = []
      // Folders handed out before copies recorded their origin, matched here by
      // name. They are linked now, so a later rename or delete reaches them.
      const adopt: number[] = []

      for (const student of recipientIds) {
        // The folder being distributed lands at the top of the class, wherever
        // it sat in the library. Everything below it keeps its place.
        const parentCopy =
          source.id === folderId || source.parentId === null
            ? null
            : (copyOf.get(source.parentId)?.get(student) ?? null)
        const existing =
          copiedAt.get(originKey(student, parentCopy, source.id)) ??
          assignedAt.get(placeKey(student, parentCopy, source.name))
        if (existing === undefined) {
          missing.push({ studentId: student, parentId: parentCopy })
          continue
        }
        copies.set(student, existing)
        if (unlinked.delete(existing)) adopt.push(existing)
      }

      for (let start = 0; start < adopt.length; start += INSERT_BATCH) {
        await tx
          .update(studentFolders)
          .set({ sourceLibraryFolderId: source.id })
          .where(
            and(
              inArray(studentFolders.id, adopt.slice(start, start + INSERT_BATCH)),
              eq(studentFolders.classId, classId),
              isNull(studentFolders.sourceLibraryFolderId),
            ),
          )
      }

      for (let start = 0; start < missing.length; start += INSERT_BATCH) {
        const created = await tx
          .insert(studentFolders)
          .values(
            missing.slice(start, start + INSERT_BATCH).map((m) => ({
              classId,
              studentId: m.studentId,
              parentId: m.parentId,
              name: source.name,
              language: source.language,
              assignedByTeacher: true,
              sourceLibraryFolderId: source.id,
            })),
          )
          .returning()
        for (const c of created) {
          copies.set(c.studentId, c.id)
          assignedAt.set(placeKey(c.studentId, c.parentId, c.name), c.id)
          copiedAt.set(originKey(c.studentId, c.parentId, source.id), c.id)
        }
      }

      copyOf.set(source.id, copies)
    }

    const delivered = await copyFilesToStudents(
      tx,
      files.map((f) => f.id),
      teacher.id,
      classId,
      recipientIds,
      (student, sourceFolderId) =>
        sourceFolderId === null ? null : (copyOf.get(sourceFolderId)?.get(student) ?? null),
    )

    return { delivered, recipients: recipientIds.length, folder: folder.name }
  })

  revalidatePath("/teacher")
  revalidatePath("/student")
  return result
}
