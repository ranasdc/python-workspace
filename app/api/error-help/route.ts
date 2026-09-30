import { generateText } from "ai"

import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"
import { errorSignature, findUnlock, resolveAiHelpForFile } from "@/lib/ai-help"
import { AccessError } from "@/lib/class-access"

// Allow the model a little room to respond.
export const maxDuration = 30

export async function POST(req: Request) {
  // This route bills real tokens. It was previously open to the internet.
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return Response.json({ error: "Sign in to get help with errors" }, { status: 401 })
  }

  const limit = rateLimit(`error-help:${sessionUser.id}`, 20, 60 * 60 * 1000)
  if (!limit.ok) {
    return Response.json(
      { error: "You've asked for a lot of hints. Try again a bit later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    )
  }

  let body: { code?: string; error?: string; fileId?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const code = (body.code ?? "").slice(0, 8000)
  const error = (body.error ?? "").slice(0, 4000)
  const fileId = Number(body.fileId)

  if (!error.trim()) {
    return Response.json({ error: "Missing error output" }, { status: 400 })
  }
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return Response.json({ error: "Missing file" }, { status: 400 })
  }

  // The class setting and unlock time are checked here, not trusted from the
  // client, so hiding the button is never the only barrier.
  try {
    const policy = await resolveAiHelpForFile(sessionUser.id, fileId)
    if (!policy.enabled) {
      return Response.json(
        { error: "Your teacher has turned off AI Help for this class." },
        { status: 403 },
      )
    }
    const unlock = await findUnlock(sessionUser.id, fileId, errorSignature(error))
    if (!unlock || unlock.unlockAt.getTime() > Date.now()) {
      return Response.json({ error: "AI Help is not unlocked yet." }, { status: 403 })
    }
  } catch (e) {
    if (e instanceof AccessError) {
      return Response.json({ error: e.message }, { status: 404 })
    }
    throw e
  }

  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: [
        "You are a friendly, patient Python tutor for a student who has already spent 10 minutes",
        "trying to fix an error on their own. Your goal is to teach, not to hand over a finished solution.",
        "",
        "Guidelines:",
        "- Start with one short, encouraging sentence.",
        "- Explain in plain language what the error message actually means.",
        "- Point to the specific line or concept in THEIR code that causes it.",
        "- Give a concrete, targeted hint on how to fix it. You may show a small corrected snippet",
        "  (a few lines) when it genuinely helps understanding, but do NOT rewrite their entire program.",
        "- Keep it concise: aim for under 180 words. Use short paragraphs or a few bullet points.",
        "- Address the student directly as 'you'. Be warm and supportive.",
      ].join("\n"),
      prompt: [
        "Here is the student's Python code:",
        "```python",
        code || "(no code provided)",
        "```",
        "",
        "Here is the error output they got when running it:",
        "```",
        error,
        "```",
        "",
        "Help them understand and fix this error.",
      ].join("\n"),
    })

    return Response.json({ help: text })
  } catch (e) {
    console.error("[error-help] generation failed:", e instanceof Error ? e.message : e)
    return Response.json(
      { error: "Could not generate a hint right now. Please try again." },
      { status: 500 },
    )
  }
}
