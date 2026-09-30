import "server-only"

import { generateText } from "ai"
import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { dailyStarters } from "@/lib/db/schema"
import { getLanguage, toLanguageId } from "@/lib/ide/languages"
import { QUESTION_COUNT, validateQuestions, type StarterQuestion } from "@/lib/daily-starter"

export type StarterBrief = {
  classId: number
  topic: string
  language?: string
  difficulty?: string
  yearGroup?: string
  objective?: string
}

/** Recent prompts for a class so the model avoids repeating itself. */
async function recentPrompts(classId: number) {
  const recent = await db
    .select({ questions: dailyStarters.questions })
    .from(dailyStarters)
    .where(eq(dailyStarters.classId, classId))
    .orderBy(desc(dailyStarters.id))
    .limit(8)
  return recent.flatMap((r) => (r.questions as StarterQuestion[]).map((q) => q.prompt)).slice(0, 30)
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

/**
 * Drafts a validated starter. Returns null when the model fails the quality
 * checks twice. Shared by the teacher composer and automatic daily starters so
 * both produce exactly the same kind of questions.
 */
export async function generateStarterQuestions(brief: StarterBrief): Promise<StarterQuestion[] | null> {
  const language = getLanguage(toLanguageId(brief.language ?? "python"))
  const topic = brief.topic.slice(0, 200).trim()
  const difficulty = (brief.difficulty ?? "mixed").slice(0, 20).trim()
  const yearGroup = (brief.yearGroup ?? "").slice(0, 60).trim()
  const objective = (brief.objective ?? "").slice(0, 400).trim()
  const avoid = await recentPrompts(brief.classId)

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

  let lastErrors: string[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      prompt:
        attempt === 0 ? prompt : `${prompt}\n\nYour previous attempt had these problems, fix them:\n${lastErrors.join("\n")}`,
    })
    const { questions, errors } = validateQuestions(extractJson(text)?.questions)
    if (new Set(questions.map((q) => q.type)).size < 2) errors.push("Use a mix of question types.")
    if (errors.length === 0) return questions
    lastErrors = errors
  }
  return null
}
