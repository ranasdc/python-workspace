import { generateText } from "ai"

// Allow the model a little room to respond.
export const maxDuration = 30

export async function POST(req: Request) {
  let body: { code?: string; error?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const code = (body.code ?? "").slice(0, 8000)
  const error = (body.error ?? "").slice(0, 4000)

  if (!error.trim()) {
    return Response.json({ error: "Missing error output" }, { status: 400 })
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
    console.log("[v0] error-help generation failed:", e instanceof Error ? e.message : e)
    return Response.json(
      { error: "Could not generate a hint right now. Please try again." },
      { status: 500 },
    )
  }
}
