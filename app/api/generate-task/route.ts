import { generateText } from "ai"

import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"
import {
  assertCanGenerateAiTask,
  recordAiTaskUsage,
  EntitlementError,
} from "@/lib/entitlements"
import { getLanguage, toLanguageId } from "@/lib/ide/languages"

export const maxDuration = 30

// Maps an entitlement failure to the right HTTP status so the client can tell
// "upgrade needed" apart from "you hit this month's cap".
function statusForCode(code: string): number {
  if (code === "ai_not_available") return 402
  if (code === "ai_limit") return 429
  return 403
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return Response.json({ error: "Sign in to generate tasks" }, { status: 401 })
  }

  // Entitlement is the real gate (feature access + monthly cap). This is a
  // cheap abuse throttle on top, so a covered teacher cannot hammer the model.
  const limit = rateLimit(`generate-task:${sessionUser.id}`, 30, 60 * 60 * 1000)
  if (!limit.ok) {
    return Response.json(
      { error: "That's a lot of generations at once. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    )
  }

  let entitlement
  try {
    entitlement = await assertCanGenerateAiTask(sessionUser.id)
  } catch (e) {
    if (e instanceof EntitlementError) {
      return Response.json({ error: e.message, code: e.code }, { status: statusForCode(e.code) })
    }
    throw e
  }

  let body: {
    language?: string
    topic?: string
    difficulty?: string
    yearGroup?: string
    learningObjective?: string
    fileName?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const language = getLanguage(toLanguageId(body.language ?? "python"))
  const topic = (body.topic ?? "").slice(0, 300).trim()
  const difficulty = (body.difficulty ?? "").slice(0, 60).trim()
  const yearGroup = (body.yearGroup ?? "").slice(0, 60).trim()
  const learningObjective = (body.learningObjective ?? "").slice(0, 500).trim()
  const fileName = (body.fileName ?? "").slice(0, 120).trim()

  if (!topic && !learningObjective) {
    return Response.json(
      { error: "Give a topic or a learning objective to generate from." },
      { status: 400 },
    )
  }

  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: [
        `You design short programming tasks for school students working in a ${language.label} editor.`,
        "You are writing the task brief the student will read. Write directly to the student.",
        "",
        "Rules:",
        "- Produce a clear, self-contained task the student can complete in that editor.",
        "- Match the stated difficulty and year group when given; keep the scope realistic for one sitting.",
        "- Instructions must be step-by-step and unambiguous, but must NOT include a full solution.",
        "- You may describe expected output or give a tiny example, but never paste a complete answer.",
        "- Use plain, encouraging language.",
        "",
        "Respond with ONLY a JSON object, no markdown fences, of exactly this shape:",
        '{"title": string, "instructions": string}',
        "The title is a short name (max ~8 words). The instructions may use newlines and simple numbered steps.",
      ].join("\n"),
      prompt: [
        topic && `Topic: ${topic}`,
        difficulty && `Difficulty: ${difficulty}`,
        yearGroup && `Year group / age: ${yearGroup}`,
        learningObjective && `Learning objective: ${learningObjective}`,
        fileName && `The student works in a file called: ${fileName}`,
        "",
        "Write the task now.",
      ]
        .filter(Boolean)
        .join("\n"),
    })

    const parsed = extractTask(text)
    if (!parsed) {
      return Response.json(
        { error: "The task came back in an unexpected format. Please try again." },
        { status: 502 },
      )
    }

    // Only a genuinely delivered task is billed. A parse failure above returns
    // before this line, so a broken generation never counts against the cap.
    await recordAiTaskUsage(entitlement)

    return Response.json({ title: parsed.title, instructions: parsed.instructions })
  } catch (e) {
    console.error("[generate-task] failed:", e instanceof Error ? e.message : e)
    return Response.json(
      { error: "Could not generate a task right now. Please try again." },
      { status: 500 },
    )
  }
}

// The model is asked for bare JSON, but occasionally wraps it in prose or a
// code fence. Pull the first balanced object out and validate the two fields
// we actually use.
function extractTask(text: string): { title: string; instructions: string } | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const obj = JSON.parse(text.slice(start, end + 1))
    const title = typeof obj.title === "string" ? obj.title.trim() : ""
    const instructions = typeof obj.instructions === "string" ? obj.instructions.trim() : ""
    if (!title || !instructions) return null
    return { title: title.slice(0, 200), instructions: instructions.slice(0, 8000) }
  } catch {
    return null
  }
}
