import { generateText } from "ai"

import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"
import {
  assertCanGenerateAiTask,
  recordAiTaskUsage,
  EntitlementError,
  type AiTeachingFeature,
} from "@/lib/entitlements"
import { getLanguage, toLanguageId } from "@/lib/ide/languages"
import {
  buildCreatePrompt,
  buildRefinePrompt,
  buildSolutionPrompt,
  extractJsonObject,
  stringField,
  MAX_INSTRUCTIONS,
  MAX_SOLUTION,
  MAX_TITLE,
  type TaskSeed,
} from "@/lib/ai/task-authoring"

export const maxDuration = 60

/**
 * The one AI endpoint behind the Create Task workspace.
 *
 * Generating a task, refining one and writing its model solution are three
 * modes of the same request rather than three routes, so the entitlement gate,
 * the abuse throttle, the usage metering and the error contract exist exactly
 * once. "create" is the default, which keeps the original request and response
 * shape of this endpoint working unchanged.
 */
type Mode = "create" | "refine" | "solution"

const MODE_FEATURE: Record<Mode, AiTeachingFeature> = {
  create: "task",
  refine: "refinement",
  solution: "solution",
}

const MODEL = "openai/gpt-5-mini"

function isMode(value: unknown): value is Mode {
  return value === "create" || value === "refine" || value === "solution"
}

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

  let body: {
    mode?: string
    language?: string
    topic?: string
    difficulty?: string
    yearGroup?: string
    learningObjective?: string
    requirements?: string
    fileName?: string
    title?: string
    instructions?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const mode: Mode = isMode(body.mode) ? body.mode : "create"

  // Entitlement is the real gate (feature access + monthly cap). This is a
  // cheap abuse throttle on top, shared by all three modes so a covered
  // teacher cannot hammer the model by alternating between them.
  const limit = rateLimit(`generate-task:${sessionUser.id}`, 30, 60 * 60 * 1000)
  if (!limit.ok) {
    return Response.json(
      { error: "That's a lot of generations at once. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    )
  }

  // Checked before anything is read from the model, so a refused teacher never
  // causes a generation to be started, billed or partially delivered.
  let entitlement
  try {
    entitlement = await assertCanGenerateAiTask(sessionUser.id, MODE_FEATURE[mode])
  } catch (e) {
    if (e instanceof EntitlementError) {
      return Response.json({ error: e.message, code: e.code }, { status: statusForCode(e.code) })
    }
    throw e
  }

  const language = getLanguage(toLanguageId(body.language ?? "python"))
  const seed: TaskSeed = {
    topic: (body.topic ?? "").slice(0, 300).trim(),
    difficulty: (body.difficulty ?? "").slice(0, 60).trim(),
    yearGroup: (body.yearGroup ?? "").slice(0, 60).trim(),
    learningObjective: (body.learningObjective ?? "").slice(0, 500).trim(),
    requirements: (body.requirements ?? "").slice(0, 1000).trim(),
    fileName: (body.fileName ?? "").slice(0, 120).trim(),
  }
  const current = {
    title: (body.title ?? "").slice(0, MAX_TITLE).trim(),
    instructions: (body.instructions ?? "").slice(0, MAX_INSTRUCTIONS).trim(),
  }

  if (mode === "create" && !seed.topic && !seed.learningObjective && !seed.requirements) {
    return Response.json(
      { error: "Add a topic, learning objective or a draft of the task to generate from." },
      { status: 400 },
    )
  }
  if (mode === "refine" && !current.instructions) {
    return Response.json(
      { error: "Write something in the instructions first, then refine it." },
      { status: 400 },
    )
  }
  if (mode === "solution" && (!current.title || !current.instructions)) {
    return Response.json(
      { error: "A solution needs a task with a title and instructions." },
      { status: 400 },
    )
  }

  const { system, prompt } =
    mode === "create"
      ? buildCreatePrompt(language, seed)
      : mode === "refine"
        ? buildRefinePrompt(language, seed, current)
        : buildSolutionPrompt(language, seed, current)

  try {
    const { text } = await generateText({ model: MODEL, system, prompt })

    // The solution mode answers in markdown, so there is nothing to parse —
    // code full of quotes and newlines survives better outside JSON.
    if (mode === "solution") {
      const solution = text.trim().slice(0, MAX_SOLUTION)
      if (!solution) {
        return Response.json(
          { error: "The solution came back empty. Please try again." },
          { status: 502 },
        )
      }
      await recordAiTaskUsage(entitlement)
      return Response.json({ solution })
    }

    const parsed = extractJsonObject(text)
    const title = stringField(parsed, "title", MAX_TITLE)
    const instructions = stringField(parsed, "instructions", MAX_INSTRUCTIONS)
    if (!title || !instructions) {
      return Response.json(
        { error: "The task came back in an unexpected format. Please try again." },
        { status: 502 },
      )
    }

    // Only a genuinely delivered task is billed. A parse failure above returns
    // before this line, so a broken generation never counts against the cap.
    await recordAiTaskUsage(entitlement)

    if (mode === "refine") {
      return Response.json({
        title,
        instructions,
        summary: stringField(parsed, "summary", 300),
      })
    }

    // A generated task arrives with its solution, so the teacher can review the
    // answer without spending a second generation. An unusable solution is
    // dropped rather than failing the task: the workspace offers Generate
    // Solution as a separate action for exactly this case.
    return Response.json({
      title,
      instructions,
      solution: stringField(parsed, "solution", MAX_SOLUTION) || null,
    })
  } catch (e) {
    console.error(`[generate-task:${mode}] failed:`, e instanceof Error ? e.message : e)
    return Response.json(
      { error: "Could not generate right now. Please try again." },
      { status: 500 },
    )
  }
}
