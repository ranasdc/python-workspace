import { generateText } from "ai"
import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { dailyStarters } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"
import { assertCanGenerateAiTask, recordAiTaskUsage, EntitlementError } from "@/lib/entitlements"
import { AccessError, assertTeacherOwnsClass } from "@/lib/class-access"
import { getLanguage, toLanguageId } from "@/lib/ide/languages"
import { QUESTION_COUNT, validateQuestions, type StarterQuestion } from "@/lib/daily-starter"

export const maxDuration = 60

function statusForCode(code: string) {
  if (code === "ai_not_available") return 402
  if (code === "ai_limit") return 429
  return 403
}

export async function POST(req: Request) {
  const me = await getSessionUser()
  if (!me) return Response.json({ error: "Sign in to generate starters" }, { status: 401 })

  const limit = rateLimit(`generate-starter:${me.id}`, 20, 60 * 60 * 1000)
  if (!limit.ok) {
    return Response.json(
      { error: "That's a lot of generations at once. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    )
  }

  let body: {
    classId?: number
    topic?: string
    language?: string
    difficulty?: string
    yearGroup?: string
    objective?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const classId = Number(body.classId)
  try {
    await assertTeacherOwnsClass(me.id, classId)
  } catch (e) {
    if (e instanceof AccessError) return Response.json({ error: e.message }, { status: 403 })
    throw e
  }

  let entitlement
  try {
    entitlement = await assertCanGenerateAiTask(me.id)
  } catch (e) {
    if (e instanceof EntitlementError) {
      return Response.json({ error: e.message, code: e.code }, { status: statusForCode(e.code) })
    }
    throw e
  }

  const language = getLanguage(toLanguageId(body.language ?? "python"))
  const topic = (body.topic ?? "").slice(0, 200).trim()
  const difficulty = (body.difficulty ?? "mixed").slice(0, 20).trim()
  const yearGroup = (body.yearGroup ?? "").slice(0, 60).trim()
  const objective = (body.objective ?? "").slice(0, 400).trim()
  if (!topic && !objective) {
    return Response.json({ error: "Give a topic or learning objective." }, { status: 400 })
  }

  // Recent prompts for this class so the model avoids repeating itself.
  const recent = await db
    .select({ questions: dailyStarters.questions })
    .from(dailyStarters)
    .where(eq(dailyStarters.classId, classId))
    .orderBy(desc(dailyStarters.id))
    .limit(8)
  const avoid = recent
    .flatMap((r) => (r.questions as StarterQuestion[]).map((q) => q.prompt))
    .slice(0, 30)

  const prompt = `Create a ${QUESTION_COUNT}-question lesson starter quiz for a UK secondary computing class.

Language: ${language.label}
Topic: ${topic || "(see objective)"}
Difficulty: ${difficulty}
Year group / age: ${yearGroup || "not specified"}
Learning objective: ${objective || "not specified"}

Rules:
- Exactly ${QUESTION_COUNT} questions, answerable in about 5 minutes total.
- Use a mix of at least 3 of these types: "mcq", "true_false", "predict_output", "fill_blank", "spot_bug".
- Age-appropriate, unambiguous, one clearly correct answer. No trick questions.
- Code snippets must be short (max 8 lines), valid ${language.label}, and indented with 4 spaces.
- For "predict_output", trace the code carefully; "answer" must be the exact printed output.
- For "mcq" and "spot_bug", give 4 distinct "options"; "answer" must equal one option exactly.
- For "spot_bug", the code contains exactly one bug; options describe possible fixes or lines.
- For "true_false", "answer" is "True" or "False"; omit options.
- For "fill_blank", show the blank as ____ in the code or prompt; give "acceptedAnswers" for valid alternatives.
- "explanation": one or two sentences a student can learn from.
${avoid.length ? `- Do not repeat these recent questions:\n${avoid.map((p) => `  * ${p}`).join("\n")}` : ""}

Respond with ONLY JSON in this shape:
{"questions":[{"type":"mcq","prompt":"...","code":"...","options":["..."],"answer":"...","acceptedAnswers":[],"explanation":"..."}]}`

  try {
    let lastErrors: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      const { text } = await generateText({
        model: "openai/gpt-5-mini",
        prompt:
          attempt === 0
            ? prompt
            : `${prompt}\n\nYour previous attempt had these problems, fix them:\n${lastErrors.join("\n")}`,
      })
      const parsed = extractJson(text)
      const { questions, errors } = validateQuestions(parsed?.questions)
      const types = new Set(questions.map((q) => q.type))
      if (types.size < 2) errors.push("Use a mix of question types.")
      if (errors.length === 0) {
        await recordAiTaskUsage(entitlement)
        return Response.json({ questions })
      }
      lastErrors = errors
    }
    return Response.json(
      { error: "The AI draft didn't pass quality checks. Please try again or adjust the topic." },
      { status: 422 },
    )
  } catch (e) {
    console.error("[generate-starter] failed:", e instanceof Error ? e.message : e)
    return Response.json({ error: "Could not generate a starter right now." }, { status: 500 })
  }
}

function extractJson(text: string): { questions?: unknown } | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}
