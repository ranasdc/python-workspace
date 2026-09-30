export const QUESTION_COUNT = 5

export const QUESTION_TYPES = {
  mcq: "Multiple choice",
  true_false: "True / False",
  predict_output: "Predict the output",
  fill_blank: "Fill in the blank",
  spot_bug: "Spot the bug",
} as const

export type QuestionType = keyof typeof QUESTION_TYPES

/** Types answered by picking an option; the rest are typed answers. */
export const CHOICE_TYPES: QuestionType[] = ["mcq", "true_false", "spot_bug"]

export type StarterQuestion = {
  id: string
  type: QuestionType
  prompt: string
  code?: string
  options?: string[]
  answer: string
  acceptedAnswers?: string[]
  explanation: string
}

/** What students receive before submitting: no answers or explanations. */
export type PublicQuestion = Omit<StarterQuestion, "answer" | "acceptedAnswers" | "explanation">

export const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const

export function isChoiceType(type: QuestionType) {
  return CHOICE_TYPES.includes(type)
}

export function toPublicQuestion(q: StarterQuestion): PublicQuestion {
  return { id: q.id, type: q.type, prompt: q.prompt, code: q.code, options: q.options }
}

function normalise(value: string) {
  return value.replace(/\r\n/g, "\n").trim().replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n")
}

export function isCorrect(q: StarterQuestion, given: string | undefined) {
  if (given === undefined || given === "") return false
  if (isChoiceType(q.type)) return given === q.answer
  const candidates = [q.answer, ...(q.acceptedAnswers ?? [])].map(normalise)
  const g = normalise(given)
  // Typed answers ignore quote style so 'x' and "x" both match.
  const loose = (s: string) => s.replace(/["']/g, "").toLowerCase()
  return candidates.some((c) => c === g || loose(c) === loose(g))
}

export function newQuestionId() {
  return Math.random().toString(36).slice(2, 10)
}

export function emptyQuestion(type: QuestionType = "mcq"): StarterQuestion {
  return {
    id: newQuestionId(),
    type,
    prompt: "",
    code: "",
    options: type === "true_false" ? ["True", "False"] : isChoiceType(type) ? ["", "", "", ""] : undefined,
    answer: "",
    acceptedAnswers: [],
    explanation: "",
  }
}

/**
 * Coerces untrusted input (from the client or the model) into questions and
 * reports every problem found. The server always runs this before saving.
 */
export function validateQuestions(input: unknown): {
  questions: StarterQuestion[]
  errors: string[]
} {
  const errors: string[] = []
  if (!Array.isArray(input)) return { questions: [], errors: ["Questions are missing."] }

  const questions: StarterQuestion[] = input.slice(0, 10).map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
    const type = (Object.keys(QUESTION_TYPES).includes(String(r.type)) ? r.type : "mcq") as QuestionType
    const options = Array.isArray(r.options)
      ? r.options.map((o) => str(o, 300)).filter(Boolean).slice(0, 6)
      : undefined
    const accepted = Array.isArray(r.acceptedAnswers)
      ? r.acceptedAnswers.map((o) => str(o, 500)).filter(Boolean).slice(0, 8)
      : []
    const q: StarterQuestion = {
      id: str(r.id, 20) || newQuestionId(),
      type,
      prompt: str(r.prompt, 1000),
      code: str(r.code, 2000) || undefined,
      options: isChoiceType(type) ? (type === "true_false" ? ["True", "False"] : options) : undefined,
      answer: str(r.answer, 500),
      acceptedAnswers: isChoiceType(type) ? undefined : accepted,
      explanation: str(r.explanation, 1000),
    }
    if (type === "true_false") {
      const a = q.answer.toLowerCase()
      q.answer = a === "true" ? "True" : a === "false" ? "False" : q.answer
    }

    const n = `Question ${i + 1}`
    if (!q.prompt) errors.push(`${n}: the question text is empty.`)
    if (!q.answer) errors.push(`${n}: the correct answer is missing.`)
    if (!q.explanation) errors.push(`${n}: add a short explanation.`)
    if (isChoiceType(type)) {
      const opts = q.options ?? []
      if (opts.length < 2) errors.push(`${n}: needs at least two options.`)
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length)
        errors.push(`${n}: options must all be different.`)
      if (q.answer && !opts.includes(q.answer))
        errors.push(`${n}: the correct answer must match one of the options exactly.`)
    }
    if ((type === "predict_output" || type === "spot_bug") && !q.code)
      errors.push(`${n}: this question type needs a code snippet.`)
    return q
  })

  if (questions.length !== QUESTION_COUNT)
    errors.push(`A starter needs exactly ${QUESTION_COUNT} questions (it has ${questions.length}).`)

  const prompts = questions.map((q) => (q.prompt + (q.code ?? "")).toLowerCase())
  if (new Set(prompts).size !== prompts.length) errors.push("Two questions are identical.")

  return { questions, errors }
}

/** Today's date (YYYY-MM-DD) in UK school time. */
export function todayInSchoolTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date)
}

export function scoreAnswers(questions: StarterQuestion[], answers: Record<string, string>) {
  const results = questions.map((q) => ({ id: q.id, correct: isCorrect(q, answers[q.id]) }))
  return { results, score: results.filter((r) => r.correct).length, total: questions.length }
}
