"use server"

import { and, desc, eq, inArray, lte } from "drizzle-orm"

import { db } from "@/lib/db"
import { dailyStarterOpens, dailyStarters, dailyStarterResponses, enrollments, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import {
  assertStudentInClass,
  assertTeacherOwnsClass,
  getStudentTeacherClassIds,
} from "@/lib/class-access"
import {
  DIFFICULTIES,
  QUESTION_COUNT,
  isCorrect,
  scoreAnswers,
  toPublicQuestion,
  todayInSchoolTime,
  validateQuestions,
  type PublicQuestion,
  type StarterQuestion,
} from "@/lib/daily-starter"
import { toLanguageId } from "@/lib/ide/languages"
import { after } from "next/server"
import { ensureTodaysAutoStarter, getAutoStarterClass } from "@/lib/auto-starters"

// Small grace so network latency never costs a student their last answer.
const SUBMIT_GRACE_MS = 15000

type StarterRow = typeof dailyStarters.$inferSelect
type ResponseRow = typeof dailyStarterResponses.$inferSelect

async function loadOwnedStarter(userId: string, starterId: number) {
  const [starter] = await db
    .select()
    .from(dailyStarters)
    .where(and(eq(dailyStarters.id, starterId), eq(dailyStarters.teacherId, userId)))
    .limit(1)
  if (!starter) throw new Error("Starter not found.")
  await assertTeacherOwnsClass(userId, starter.classId)
  return starter
}

async function loadAssignedStarterForStudent(userId: string, starterId: number) {
  const [starter] = await db
    .select()
    .from(dailyStarters)
    .where(and(eq(dailyStarters.id, starterId), eq(dailyStarters.status, "assigned")))
    .limit(1)
  if (!starter) throw new Error("Starter not found.")
  await assertStudentInClass(userId, starter.classId)
  return starter
}

async function enrolledCount(classId: number) {
  const rows = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.classId, classId))
  return rows.length
}

function questionsOf(starter: StarterRow) {
  return starter.questions as StarterQuestion[]
}

type AttemptFields = Pick<
  ResponseRow,
  "answers" | "score" | "total" | "submittedAt" | "firstAnswers" | "firstScore" | "firstTotal" | "firstSubmittedAt"
>

/** What the teacher sees: the first submitted attempt, or the first attempt still in progress. */
function firstAttempt(r: AttemptFields) {
  if (r.firstSubmittedAt) {
    return {
      answers: (r.firstAnswers ?? {}) as Record<string, string>,
      score: r.firstScore,
      total: r.firstTotal,
      submittedAt: r.firstSubmittedAt,
    }
  }
  return { answers: r.answers as Record<string, string>, score: r.score, total: r.total, submittedAt: r.submittedAt }
}

/** Per-question class totals from first attempts. Never includes names. */
function aggregate(questions: StarterQuestion[], responses: ResponseRow[]) {
  const attempts = responses.map(firstAttempt)
  return questions.map((q) => {
    let answered = 0
    let correct = 0
    const optionCounts: Record<string, number> = {}
    for (const r of attempts) {
      const a = r.answers[q.id]
      if (a === undefined || a === "") continue
      answered++
      if (isCorrect(q, a)) correct++
      if (q.options) optionCounts[a] = (optionCounts[a] ?? 0) + 1
    }
    return { id: q.id, answered, correct, incorrect: answered - correct, optionCounts }
  })
}

/* ------------------------------ Teacher ------------------------------ */

export type StarterInput = {
  id?: number
  classId: number
  title: string
  topic: string
  language: string
  difficulty: string
  yearGroup: string
  objective: string
  starterDate: string
  timeLimitSeconds: number
  allowRetake: boolean
  questions: StarterQuestion[]
  aiGenerated?: boolean
}

export async function listClassStarters(classId: number) {
  const me = await requireUser()
  await assertTeacherOwnsClass(me.id, classId)

  const starters = await db
    .select()
    .from(dailyStarters)
    .where(eq(dailyStarters.classId, classId))
    .orderBy(desc(dailyStarters.starterDate), desc(dailyStarters.id))

  const ids = starters.map((s) => s.id)
  const responses = ids.length
    ? await db
        .select()
        .from(dailyStarterResponses)
        .where(inArray(dailyStarterResponses.starterId, ids))
    : []
  const enrolled = await enrolledCount(classId)

  return {
    enrolled,
    starters: starters.map((s) => {
      const done = responses
        .filter((r) => r.starterId === s.id)
        .map(firstAttempt)
        .filter((r) => r.submittedAt)
      const avg =
        done.length > 0
          ? Math.round((done.reduce((a, r) => a + (r.score ?? 0) / (r.total || 1), 0) / done.length) * 100)
          : null
      return { ...s, questions: questionsOf(s), submitted: done.length, averagePercent: avg }
    }),
  }
}

export async function saveStarter(input: StarterInput) {
  const me = await requireUser()
  await assertTeacherOwnsClass(me.id, input.classId)

  const { questions, errors } = validateQuestions(input.questions)
  const title = (input.title ?? "").trim().slice(0, 120)
  if (!title) errors.unshift("Give the starter a title.")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starterDate)) errors.push("Choose a valid date.")
  const limit = Math.round(Number(input.timeLimitSeconds))
  if (!Number.isFinite(limit) || limit < 60 || limit > 1800)
    errors.push("Time limit must be between 1 and 30 minutes.")
  if (errors.length) return { ok: false as const, errors }

  const values = {
    classId: input.classId,
    teacherId: me.id,
    title,
    topic: (input.topic ?? "").slice(0, 200),
    language: toLanguageId(input.language ?? "python"),
    difficulty: (DIFFICULTIES as readonly string[]).includes(input.difficulty) ? input.difficulty : "mixed",
    yearGroup: (input.yearGroup ?? "").slice(0, 60),
    objective: (input.objective ?? "").slice(0, 500),
    starterDate: input.starterDate,
    timeLimitSeconds: limit,
    allowRetake: Boolean(input.allowRetake),
    questions,
    updatedAt: new Date(),
  }

  if (input.id) {
    const existing = await loadOwnedStarter(me.id, input.id)
    // Editing questions after students answered would corrupt their scores.
    if (existing.status === "assigned") {
      const [any] = await db
        .select({ id: dailyStarterResponses.id })
        .from(dailyStarterResponses)
        .where(eq(dailyStarterResponses.starterId, existing.id))
        .limit(1)
      if (any && JSON.stringify(existing.questions) !== JSON.stringify(questions)) {
        return {
          ok: false as const,
          errors: ["Students have already answered this starter, so its questions can't change. Duplicate it instead."],
        }
      }
    }
    await db.update(dailyStarters).set(values).where(eq(dailyStarters.id, existing.id))
    return { ok: true as const, id: existing.id }
  }

  const [row] = await db
    .insert(dailyStarters)
    .values({ ...values, aiGenerated: Boolean(input.aiGenerated) })
    .returning({ id: dailyStarters.id })
  return { ok: true as const, id: row.id }
}

export async function setStarterAssigned(starterId: number, assigned: boolean) {
  const me = await requireUser()
  const starter = await loadOwnedStarter(me.id, starterId)
  if (assigned) {
    const { errors } = validateQuestions(starter.questions)
    if (errors.length) return { ok: false as const, errors }
  }
  await db
    .update(dailyStarters)
    .set({ status: assigned ? "assigned" : "draft", updatedAt: new Date() })
    .where(eq(dailyStarters.id, starterId))
  return { ok: true as const }
}

export async function deleteStarter(starterId: number) {
  const me = await requireUser()
  await loadOwnedStarter(me.id, starterId)
  await db.delete(dailyStarterResponses).where(eq(dailyStarterResponses.starterId, starterId))
  await db.delete(dailyStarters).where(eq(dailyStarters.id, starterId))
}

/** Teacher-only: individual results are visible here and nowhere else. */
export async function getStarterResults(starterId: number) {
  const me = await requireUser()
  const starter = await loadOwnedStarter(me.id, starterId)
  const questions = questionsOf(starter)

  const students = await db
    .select({ id: user.id, name: user.name })
    .from(enrollments)
    .innerJoin(user, eq(user.id, enrollments.studentId))
    .where(eq(enrollments.classId, starter.classId))
  const responses = await db
    .select()
    .from(dailyStarterResponses)
    .where(eq(dailyStarterResponses.starterId, starterId))

  return {
    starter: { ...starter, questions },
    aggregate: aggregate(questions, responses),
    enrolled: students.length,
    students: students
      .map((s) => {
        const row = responses.find((x) => x.studentId === s.id)
        const r = row ? firstAttempt(row) : null
        const answers = r?.answers ?? {}
        return {
          id: s.id,
          name: s.name,
          status: r?.submittedAt ? "submitted" : r ? "in_progress" : "not_started",
          score: r?.score ?? null,
          total: r?.total ?? questions.length,
          perQuestion: questions.map((q) => (answers[q.id] ? isCorrect(q, answers[q.id]) : null)),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/* ---------------------------- Warm-up mode --------------------------- */

export async function getWarmupData(starterId: number) {
  const me = await requireUser()
  const starter = await loadOwnedStarter(me.id, starterId)
  const questions = questionsOf(starter)
  const responses = await db
    .select()
    .from(dailyStarterResponses)
    .where(eq(dailyStarterResponses.starterId, starterId))
  return {
    starter: { ...starter, questions },
    aggregate: aggregate(questions, responses),
    enrolled: await enrolledCount(starter.classId),
    joined: responses.length,
  }
}

export async function setWarmupState(
  starterId: number,
  state: { index?: number; revealed?: boolean; active?: boolean },
) {
  const me = await requireUser()
  const starter = await loadOwnedStarter(me.id, starterId)
  const count = questionsOf(starter).length
  const patch: Partial<StarterRow> = { updatedAt: new Date() }
  if (state.index !== undefined) {
    patch.warmupIndex = Math.max(0, Math.min(count - 1, Math.round(state.index)))
    patch.warmupRevealed = false
  }
  if (state.revealed !== undefined) patch.warmupRevealed = state.revealed
  if (state.active !== undefined) {
    patch.warmupActive = state.active
    // Starting a warm-up makes it available to the class.
    if (state.active) patch.status = "assigned"
  }
  await db.update(dailyStarters).set(patch).where(eq(dailyStarters.id, starterId))
}

/* ------------------------------ Student ------------------------------ */

export type StudentStarterSummary = {
  id: number
  className: string
  title: string
  topic: string
  starterDate: string
  timeLimitSeconds: number
  questionCount: number
  status: "not_started" | "in_progress" | "submitted"
  score: number | null
  total: number | null
  warmupActive: boolean
}

/**
 * Classes whose starters a student sees. Individual Student Pro learners have
 * no teacher, so their personal workspace receives an automatic daily starter.
 */
async function starterClassesFor(userId: string) {
  const teacherClasses = await getStudentTeacherClassIds(userId)
  if (teacherClasses.length > 0) return { classRows: teacherClasses, autoClass: null }
  const autoClass = await getAutoStarterClass(userId)
  return { classRows: autoClass ? [autoClass] : [], autoClass }
}

export async function getStudentStarters() {
  const me = await requireUser()
  const { classRows, autoClass } = await starterClassesFor(me.id)
  if (classRows.length === 0) return { today: [], history: [], preparing: false }

  const today = todayInSchoolTime()
  // Generation can take a few seconds; never hold the page up for it.
  if (autoClass) after(() => ensureTodaysAutoStarter(me.id, autoClass.id))
  const starters = await db
    .select()
    .from(dailyStarters)
    .where(
      and(
        inArray(dailyStarters.classId, classRows.map((c) => c.id)),
        eq(dailyStarters.status, "assigned"),
        lte(dailyStarters.starterDate, today),
      ),
    )
    .orderBy(desc(dailyStarters.starterDate), desc(dailyStarters.id))
    .limit(60)

  const responses = starters.length
    ? await db
        .select()
        .from(dailyStarterResponses)
        .where(
          and(
            eq(dailyStarterResponses.studentId, me.id),
            inArray(dailyStarterResponses.starterId, starters.map((s) => s.id)),
          ),
        )
    : []

  const summaries: StudentStarterSummary[] = starters.map((s) => {
    const r = responses.find((x) => x.starterId === s.id)
    return {
      id: s.id,
      className: classRows.find((c) => c.id === s.classId)?.name ?? "",
      title: s.title,
      topic: s.topic,
      starterDate: s.starterDate,
      timeLimitSeconds: s.timeLimitSeconds,
      questionCount: questionsOf(s).length,
      status: r?.submittedAt ? "submitted" : r ? "in_progress" : "not_started",
      score: r?.submittedAt ? r.score : null,
      total: r?.submittedAt ? r.total : null,
      warmupActive: s.warmupActive,
    }
  })

  const todaySummaries = summaries.filter((s) => s.starterDate === today || s.warmupActive)
  return {
    today: todaySummaries,
    history: summaries.filter((s) => s.starterDate !== today && !s.warmupActive),
    preparing: Boolean(autoClass) && todaySummaries.length === 0,
  }
}

export type PendingStarter = {
  id: number
  title: string
  className: string
  questionCount: number
  timeLimitSeconds: number
}

/** Today's starters the student has not opened yet. Drives the banner and header highlight. */
export async function getPendingStarters(): Promise<PendingStarter[]> {
  const me = await requireUser()
  const { classRows, autoClass } = await starterClassesFor(me.id)
  if (classRows.length === 0) return []

  // This is a background poll, so it can wait for the first generation of the day.
  if (autoClass) await ensureTodaysAutoStarter(me.id, autoClass.id)

  const today = todayInSchoolTime()
  const starters = await db
    .select()
    .from(dailyStarters)
    .where(
      and(
        inArray(dailyStarters.classId, classRows.map((c) => c.id)),
        eq(dailyStarters.status, "assigned"),
        lte(dailyStarters.starterDate, today),
      ),
    )
    .orderBy(desc(dailyStarters.starterDate), desc(dailyStarters.id))
    .limit(20)

  const current = starters.filter((s) => s.starterDate === today || s.warmupActive)
  if (current.length === 0) return []
  const ids = current.map((s) => s.id)

  const [opens, responses] = await Promise.all([
    db
      .select({ starterId: dailyStarterOpens.starterId })
      .from(dailyStarterOpens)
      .where(and(eq(dailyStarterOpens.studentId, me.id), inArray(dailyStarterOpens.starterId, ids))),
    db
      .select({ starterId: dailyStarterResponses.starterId })
      .from(dailyStarterResponses)
      .where(and(eq(dailyStarterResponses.studentId, me.id), inArray(dailyStarterResponses.starterId, ids))),
  ])
  const seen = new Set([...opens, ...responses].map((r) => r.starterId))

  return current
    .filter((s) => !seen.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      className: classRows.find((c) => c.id === s.classId)?.name ?? "",
      questionCount: questionsOf(s).length,
      timeLimitSeconds: s.timeLimitSeconds,
    }))
}

export async function markStarterOpened(starterId: number) {
  const me = await requireUser()
  await loadAssignedStarterForStudent(me.id, starterId)
  await db.insert(dailyStarterOpens).values({ starterId, studentId: me.id }).onConflictDoNothing()
}

export type StudentStarterDetail = {
  id: number
  title: string
  topic: string
  timeLimitSeconds: number
  allowRetake: boolean
  warmup: { active: boolean; index: number; revealed: boolean }
  questions: PublicQuestion[]
  answers: Record<string, string>
  startedAt: number | null
  serverNow: number
  /** The first submitted attempt: the only one the teacher sees. */
  recordedAttempt: null | { score: number; total: number }
  isPractice: boolean
  result: null | {
    score: number
    total: number
    questions: StarterQuestion[]
    correct: Record<string, boolean>
  }
}

export async function getStudentStarter(starterId: number): Promise<StudentStarterDetail> {
  const me = await requireUser()
  const starter = await loadAssignedStarterForStudent(me.id, starterId)
  const questions = questionsOf(starter)
  const [response] = await db
    .select()
    .from(dailyStarterResponses)
    .where(and(eq(dailyStarterResponses.starterId, starterId), eq(dailyStarterResponses.studentId, me.id)))
    .limit(1)

  const answers = (response?.answers ?? {}) as Record<string, string>
  // Answers are revealed in warm-up once the teacher shows them to the class.
  const submitted = Boolean(response?.submittedAt)

  return {
    id: starter.id,
    title: starter.title,
    topic: starter.topic,
    timeLimitSeconds: starter.timeLimitSeconds,
    allowRetake: starter.allowRetake,
    warmup: { active: starter.warmupActive, index: starter.warmupIndex, revealed: starter.warmupRevealed },
    questions: questions.map(toPublicQuestion),
    answers,
    startedAt: response ? response.startedAt.getTime() : null,
    serverNow: Date.now(),
    recordedAttempt: response?.firstSubmittedAt
      ? { score: response.firstScore ?? 0, total: response.firstTotal ?? questions.length }
      : null,
    isPractice: Boolean(
      response?.firstSubmittedAt && response.submittedAt?.getTime() !== response.firstSubmittedAt.getTime(),
    ),
    result: submitted
      ? {
          score: response!.score ?? 0,
          total: response!.total ?? questions.length,
          questions,
          correct: Object.fromEntries(questions.map((q) => [q.id, isCorrect(q, answers[q.id])])),
        }
      : null,
  }
}

async function getOrStartResponse(studentId: string, starterId: number) {
  await db
    .insert(dailyStarterResponses)
    .values({ starterId, studentId, answers: {} })
    .onConflictDoNothing()
  const [row] = await db
    .select()
    .from(dailyStarterResponses)
    .where(and(eq(dailyStarterResponses.starterId, starterId), eq(dailyStarterResponses.studentId, studentId)))
    .limit(1)
  return row
}

function timeExpired(starter: StarterRow, response: ResponseRow) {
  // Warm-ups are paced by the teacher, so the personal timer does not apply.
  if (starter.warmupActive) return false
  return Date.now() > response.startedAt.getTime() + starter.timeLimitSeconds * 1000 + SUBMIT_GRACE_MS
}

export async function startStarter(starterId: number) {
  const me = await requireUser()
  await loadAssignedStarterForStudent(me.id, starterId)
  await getOrStartResponse(me.id, starterId)
  return getStudentStarter(starterId)
}

export async function saveStarterAnswer(starterId: number, questionId: string, answer: string) {
  const me = await requireUser()
  const starter = await loadAssignedStarterForStudent(me.id, starterId)
  if (!questionsOf(starter).some((q) => q.id === questionId)) throw new Error("Unknown question.")
  const response = await getOrStartResponse(me.id, starterId)
  if (response.submittedAt) return { ok: false as const, reason: "submitted" }
  if (timeExpired(starter, response)) return { ok: false as const, reason: "expired" }

  const answers = { ...(response.answers as Record<string, string>), [questionId]: String(answer).slice(0, 500) }
  await db.update(dailyStarterResponses).set({ answers }).where(eq(dailyStarterResponses.id, response.id))
  return { ok: true as const }
}

export async function submitStarter(starterId: number, finalAnswers: Record<string, string>) {
  const me = await requireUser()
  const starter = await loadAssignedStarterForStudent(me.id, starterId)
  const questions = questionsOf(starter)
  const response = await getOrStartResponse(me.id, starterId)

  if (!response.submittedAt) {
    let answers = response.answers as Record<string, string>
    // After the deadline only the answers already saved count.
    if (!timeExpired(starter, response)) {
      const allowed = new Set(questions.map((q) => q.id))
      for (const [k, v] of Object.entries(finalAnswers ?? {})) {
        if (allowed.has(k) && typeof v === "string") answers = { ...answers, [k]: v.slice(0, 500) }
      }
    }
    const { score, total } = scoreAnswers(questions, answers)
    const now = new Date()
    const first = response.firstSubmittedAt
      ? {}
      : { firstAnswers: answers, firstScore: score, firstTotal: total, firstSubmittedAt: now }
    await db
      .update(dailyStarterResponses)
      .set({ answers, score, total, submittedAt: now, ...first })
      .where(eq(dailyStarterResponses.id, response.id))
  }
  return getStudentStarter(starterId)
}

export async function retakeStarter(starterId: number) {
  const me = await requireUser()
  const starter = await loadAssignedStarterForStudent(me.id, starterId)
  if (!starter.allowRetake) throw new Error("Your teacher hasn't allowed retakes for this starter.")
  await db
    .update(dailyStarterResponses)
    .set({ answers: {}, score: null, total: null, submittedAt: null, startedAt: new Date() })
    .where(and(eq(dailyStarterResponses.starterId, starterId), eq(dailyStarterResponses.studentId, me.id)))
  return getStudentStarter(starterId)
}

export async function getStarterQuestionCount() {
  return QUESTION_COUNT
}
