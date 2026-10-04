import type { LanguageDef } from "@/lib/ide/languages"

/**
 * The prompts behind the three AI tools in the Create Task workspace.
 *
 * Every one of them is handed a `LanguageDef` and asks the registry what the
 * IDE is like, so none of them knows that Python or HTML exist. Adding an IDE
 * adds a registry entry; these prompts then describe it correctly without
 * being touched.
 */

export type TaskSeed = {
  topic: string
  difficulty: string
  yearGroup: string
  learningObjective: string
  requirements: string
  fileName: string
}

/** The seed lines shared by every tool, in a stable order. */
function seedLines(seed: TaskSeed): string[] {
  return [
    seed.topic && `Topic: ${seed.topic}`,
    seed.difficulty && `Difficulty: ${seed.difficulty}`,
    seed.yearGroup && `Year group / age: ${seed.yearGroup}`,
    seed.learningObjective && `Learning objective: ${seed.learningObjective}`,
    seed.requirements && `Additional requirements from the teacher: ${seed.requirements}`,
    seed.fileName && `The student works in a file called: ${seed.fileName}`,
  ].filter((line): line is string => Boolean(line))
}

function environment(language: LanguageDef): string {
  return `The student works in ${language.label}, in ${language.ai.environment}`
}

/**
 * Rules for the student-facing brief. Shared by generation and refinement so
 * a refined task is held to exactly the same standard as a generated one.
 */
function briefRules(): string[] {
  return [
    "- Produce a clear, self-contained task the student can complete in that editor.",
    "- Match the stated difficulty and year group when given; keep the scope realistic for one sitting.",
    "- Instructions must be step-by-step and unambiguous, but must NOT include a full solution.",
    "- You may describe expected output or give a tiny example, but never paste a complete answer.",
    "- Use plain, encouraging language.",
  ]
}

export function buildCreatePrompt(language: LanguageDef, seed: TaskSeed) {
  return {
    system: [
      `You design short programming tasks for school students working in a ${language.label} editor.`,
      "You are writing the task brief the student will read. Write directly to the student.",
      environment(language),
      "",
      "Rules:",
      ...briefRules(),
      "",
      "You also produce the teacher's model solution. The student never sees it.",
      `The solution must be ${language.ai.solutionFormat}.`,
      "",
      "Respond with ONLY a JSON object, no markdown fences, of exactly this shape:",
      '{"title": string, "instructions": string, "solution": string}',
      "The title is a short name (max ~8 words). The instructions may use newlines and simple numbered steps.",
      `The solution is markdown using these headings exactly: "## Solution" (the code, in a ${language.ai.codeFence} fence), "## How it works", "## Expected output", "## Key concepts", "## Teaching notes".`,
      "Escape newlines and quotes properly so the JSON parses.",
    ].join("\n"),
    prompt: [...seedLines(seed), "", "Write the task and its solution now."].join("\n"),
  }
}

export function buildRefinePrompt(
  language: LanguageDef,
  seed: TaskSeed,
  current: { title: string; instructions: string },
) {
  return {
    system: [
      `You improve programming tasks written by teachers for school students working in a ${language.label} editor.`,
      environment(language),
      "",
      "Your job is to make the teacher's task better, NOT to replace it with your own.",
      "- Keep the teacher's intention, subject and any specific requirement they stated.",
      "- Improve clarity, structure, step order, age-appropriateness and alignment with the learning objective.",
      "- Add a worked example of the expected output, constraints or success criteria where they are missing.",
      "- If the teacher's task is only a rough note, turn it into a complete brief on the same subject.",
      "- Never make the task harder or easier than the stated difficulty.",
      "- Never include a full solution in the instructions.",
      "",
      "Rules for the result:",
      ...briefRules(),
      "",
      "Respond with ONLY a JSON object, no markdown fences, of exactly this shape:",
      '{"title": string, "instructions": string, "summary": string}',
      "The summary is one short sentence, written to the teacher, naming what you changed.",
      "Escape newlines and quotes properly so the JSON parses.",
    ].join("\n"),
    prompt: [
      ...seedLines(seed),
      "",
      "The teacher's current task:",
      `Title: ${current.title || "(none yet)"}`,
      "Instructions:",
      current.instructions,
      "",
      "Return the improved version now.",
    ].join("\n"),
  }
}

export function buildSolutionPrompt(
  language: LanguageDef,
  seed: TaskSeed,
  current: { title: string; instructions: string },
) {
  return {
    system: [
      `You write model solutions for ${language.label} tasks set to school students.`,
      environment(language),
      "",
      "You are writing for the teacher, not the student. The student never sees this.",
      `The solution must be ${language.ai.solutionFormat}.`,
      "",
      "Rules:",
      "- Solve exactly the task given. Do not solve a task you would rather have been asked.",
      "- The code must run as written and satisfy every requirement in the instructions.",
      "- Keep it at the level the task is pitched at: the clearest solution a student at that level could plausibly reach, not the cleverest one.",
      "- Be honest where the task is ambiguous: say which reading you solved.",
      "",
      "Respond with markdown only, no preamble, using these headings exactly:",
      `## Solution — the complete code, in a ${language.ai.codeFence} fence.`,
      "## How it works — a short walkthrough of the logic.",
      "## Expected output — what the student should see when it runs, or what the page should look like. Say so plainly if it depends on the student's input.",
      "## Key concepts — the ideas being assessed, as a short bullet list.",
      "## Teaching notes — likely mistakes and what to look for when marking.",
    ].join("\n"),
    prompt: [
      ...seedLines(seed),
      "",
      "The task the student has been set:",
      `Title: ${current.title}`,
      "Instructions:",
      current.instructions,
      "",
      "Write the model solution now.",
    ].join("\n"),
  }
}

/**
 * The model is asked for bare JSON but occasionally wraps it in prose or a
 * code fence. Pull the first balanced object out and hand back the parsed
 * value for the caller to validate.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Trimmed string field from a parsed model response, or "" when unusable. */
export function stringField(
  source: Record<string, unknown> | null,
  key: string,
  maxLength: number,
): string {
  const value = source?.[key]
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export const MAX_TITLE = 200
export const MAX_INSTRUCTIONS = 8000
export const MAX_SOLUTION = 20000
