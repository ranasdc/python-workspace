import "server-only"

import { and, desc, eq, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { autoStarterClaims, classes, dailyStarterResponses, dailyStarters, enrollments } from "@/lib/db/schema"
import { getEntitlement } from "@/lib/entitlements"
import { todayInSchoolTime } from "@/lib/daily-starter"
import { generateStarterQuestions } from "@/lib/starter-generator"

export const AUTO_STARTER_CLASS_LABEL = "Daily practice"

// A claim older than this is from a request that died mid-generation.
const STALE_CLAIM_MS = 3 * 60 * 1000

// A KS3/GCSE-style Python progression. Each day moves to the next topic, so a
// learner cycles through the whole course and every earlier topic keeps coming
// back as "mixed" review questions.
const CURRICULUM: { topic: string; objective: string }[] = [
  { topic: "Variables and assignment", objective: "Store, update and print values in variables." },
  { topic: "Data types and casting", objective: "Tell int, float, str and bool apart and convert between them." },
  { topic: "Input and output", objective: "Use input() and print() and remember input() returns a string." },
  { topic: "Arithmetic operators", objective: "Use +, -, *, /, //, % and ** and predict their results." },
  { topic: "Selection with if, elif and else", objective: "Choose between branches using conditions." },
  { topic: "Comparison and Boolean logic", objective: "Combine conditions with and, or and not." },
  { topic: "for loops and range()", objective: "Repeat code a fixed number of times and trace range()." },
  { topic: "while loops", objective: "Repeat until a condition changes and avoid infinite loops." },
  { topic: "Strings and string methods", objective: "Index, slice and use methods like upper(), len() and find()." },
  { topic: "Lists", objective: "Create, index, append to and loop over lists." },
  { topic: "Functions and parameters", objective: "Define functions that take parameters." },
  { topic: "Return values and scope", objective: "Return values from functions and understand local variables." },
  { topic: "Nested loops", objective: "Trace loops inside loops." },
  { topic: "Dictionaries", objective: "Store and look up key-value pairs." },
  { topic: "2D lists", objective: "Read and update values in a list of lists." },
  { topic: "Validation and error handling", objective: "Validate input and handle errors with try and except." },
  { topic: "Searching and sorting", objective: "Trace linear search, binary search and bubble sort." },
  { topic: "Tracing and debugging", objective: "Trace unfamiliar code and find logic errors." },
]

// Below this first-attempt score, tomorrow revisits the same topic.
const REVISIT_BELOW = 0.6

/**
 * The personal workspace that should receive automatic starters, or null.
 * Only individual Student Pro learners qualify: anyone in a teacher-led class
 * gets starters from that teacher, and school students are covered by school.
 */
export async function getAutoStarterClass(userId: string) {
  const entitlement = await getEntitlement(userId)
  if (entitlement.isTeacher || entitlement.plan !== "student_pro" || entitlement.source !== "individual") {
    return null
  }

  const rows = await db
    .select({ id: classes.id, isPersonal: classes.isPersonal, teacherId: classes.teacherId })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(eq(enrollments.studentId, userId))
  if (rows.some((r) => !r.isPersonal)) return null

  const personal = rows.find((r) => r.teacherId === userId)
  return personal ? { id: personal.id, name: AUTO_STARTER_CLASS_LABEL } : null
}

async function pickBrief(classId: number, userId: string) {
  const previous = await db
    .select({ id: dailyStarters.id, topic: dailyStarters.topic })
    .from(dailyStarters)
    .where(and(eq(dailyStarters.classId, classId), eq(dailyStarters.aiGenerated, true)))
    .orderBy(desc(dailyStarters.starterDate), desc(dailyStarters.id))
    .limit(2)

  const last = previous[0]
  if (!last) return { ...CURRICULUM[0], revisit: false }

  const lastIndex = CURRICULUM.findIndex((c) => c.topic === last.topic)
  const next = CURRICULUM[(lastIndex + 1) % CURRICULUM.length]

  // Revisit a weak topic once, then move on either way so nobody gets stuck.
  const alreadyRevisited = previous[1]?.topic === last.topic
  if (lastIndex !== -1 && !alreadyRevisited) {
    const [response] = await db
      .select({ score: dailyStarterResponses.firstScore, total: dailyStarterResponses.firstTotal })
      .from(dailyStarterResponses)
      .where(and(eq(dailyStarterResponses.starterId, last.id), eq(dailyStarterResponses.studentId, userId)))
      .limit(1)
    if (response?.total && (response.score ?? 0) / response.total < REVISIT_BELOW) {
      return { ...CURRICULUM[lastIndex], revisit: true }
    }
  }
  return { ...next, revisit: false }
}

async function claimToday(classId: number, starterDate: string) {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS)
  const won = await db
    .insert(autoStarterClaims)
    .values({ classId, starterDate })
    .onConflictDoUpdate({
      target: [autoStarterClaims.classId, autoStarterClaims.starterDate],
      set: { claimedAt: sql`now()` },
      setWhere: lt(autoStarterClaims.claimedAt, staleBefore),
    })
    .returning({ id: autoStarterClaims.id })
  return won.length > 0
}

async function hasStarterFor(classId: number, starterDate: string) {
  const [row] = await db
    .select({ id: dailyStarters.id })
    .from(dailyStarters)
    .where(and(eq(dailyStarters.classId, classId), eq(dailyStarters.starterDate, starterDate)))
    .limit(1)
  return Boolean(row)
}

/**
 * Makes sure today's automatic starter exists. Safe to call on every poll:
 * it is a single indexed lookup once the starter has been created.
 */
export async function ensureTodaysAutoStarter(userId: string, classId: number) {
  const today = todayInSchoolTime()
  if (await hasStarterFor(classId, today)) return
  if (!(await claimToday(classId, today))) return

  try {
    // Re-check after winning in case a stale claim's owner finished after all.
    if (await hasStarterFor(classId, today)) return
    const brief = await pickBrief(classId, userId)
    const questions = await generateStarterQuestions({
      classId,
      topic: brief.topic,
      difficulty: "mixed",
      yearGroup: "Independent learner, ages 11-16",
      objective: brief.revisit
        ? `${brief.objective} This is a second look after a tricky first attempt: build confidence with clear, supportive questions.`
        : `${brief.objective} Include one or two quick review questions on earlier Python basics.`,
    })
    if (!questions) throw new Error("Generated starter failed quality checks")

    await db.insert(dailyStarters).values({
      classId,
      teacherId: userId,
      title: brief.revisit ? `${brief.topic} (revisit)` : brief.topic,
      topic: brief.topic,
      language: "python",
      difficulty: "mixed",
      yearGroup: "",
      objective: brief.objective,
      starterDate: today,
      timeLimitSeconds: 300,
      allowRetake: true,
      questions,
      status: "assigned",
      aiGenerated: true,
    })
  } catch (e) {
    // Release the claim so the next poll can try again.
    await db
      .delete(autoStarterClaims)
      .where(and(eq(autoStarterClaims.classId, classId), eq(autoStarterClaims.starterDate, today)))
    console.error("[auto-starter] generation failed:", e instanceof Error ? e.message : e)
  }
}
