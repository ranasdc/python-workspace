import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"
import { assertCanGenerateAiTask, recordAiTaskUsage, EntitlementError } from "@/lib/entitlements"
import { AccessError, assertTeacherOwnsClass } from "@/lib/class-access"
import { generateStarterQuestions } from "@/lib/starter-generator"

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

  const topic = (body.topic ?? "").trim()
  const objective = (body.objective ?? "").trim()
  if (!topic && !objective) {
    return Response.json({ error: "Give a topic or learning objective." }, { status: 400 })
  }

  try {
    const questions = await generateStarterQuestions({
      classId,
      topic,
      objective,
      language: body.language,
      difficulty: body.difficulty,
      yearGroup: body.yearGroup,
    })
    if (!questions) {
      return Response.json(
        { error: "The AI draft didn't pass quality checks. Please try again or adjust the topic." },
        { status: 422 },
      )
    }
    await recordAiTaskUsage(entitlement)
    return Response.json({ questions })
  } catch (e) {
    console.error("[generate-starter] failed:", e instanceof Error ? e.message : e)
    return Response.json({ error: "Could not generate a starter right now." }, { status: 500 })
  }
}
