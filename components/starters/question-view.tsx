"use client"

import { Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { QUESTION_TYPES, isChoiceType, type PublicQuestion } from "@/lib/daily-starter"

export type Reveal = { answer: string; explanation: string; correct?: boolean }

export function CodeSnippet({ code, large }: { code: string; large?: boolean }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono leading-relaxed text-foreground",
        large ? "text-xl md:text-2xl" : "text-sm",
      )}
    >
      <code>{code}</code>
    </pre>
  )
}

export function QuestionView({
  question,
  index,
  value,
  onChange,
  disabled,
  reveal,
  counts,
  large,
}: {
  question: PublicQuestion
  index: number
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  reveal?: Reveal
  /** Class totals per option, shown in warm-up mode. */
  counts?: Record<string, number>
  large?: boolean
}) {
  const totalVotes = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0

  return (
    <div className={cn("flex flex-col", large ? "gap-6" : "gap-4")}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Question {index + 1} · {QUESTION_TYPES[question.type]}
        </span>
        <h3 className={cn("font-semibold text-balance", large ? "text-3xl md:text-4xl" : "text-lg")}>
          {question.prompt}
        </h3>
      </div>

      {question.code && <CodeSnippet code={question.code} large={large} />}

      {isChoiceType(question.type) && question.options ? (
        <div role="radiogroup" aria-label={`Answer for question ${index + 1}`} className="grid gap-2 sm:grid-cols-2">
          {question.options.map((opt, i) => {
            const selected = value === opt
            const isAnswer = reveal?.answer === opt
            const count = counts?.[opt] ?? 0
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange?.(opt)}
                className={cn(
                  "relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 text-left transition-colors",
                  large ? "min-h-20 py-4 text-xl" : "min-h-12 py-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !disabled && "hover:border-primary/60",
                  selected && !reveal && "border-primary bg-primary/10",
                  reveal && isAnswer && "border-chart-3 bg-chart-3/15",
                  reveal && selected && !isAnswer && "border-destructive bg-destructive/10",
                  !selected && !(reveal && isAnswer) && "border-border bg-card",
                  disabled && "cursor-default",
                )}
              >
                {counts && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span
                  className={cn(
                    "relative flex shrink-0 items-center justify-center rounded-md border font-semibold",
                    large ? "h-10 w-10 text-lg" : "h-7 w-7 text-xs",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="relative flex-1 font-mono">{opt}</span>
                {counts && (
                  <span className="relative tabular-nums text-muted-foreground">
                    {count} · {pct}%
                  </span>
                )}
                {reveal && isAnswer && <Check className="relative h-5 w-5 text-chart-3" aria-label="Correct answer" />}
                {reveal && selected && !isAnswer && <X className="relative h-5 w-5 text-destructive" aria-label="Your answer" />}
              </button>
            )
          })}
        </div>
      ) : (
        !counts && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`answer-${question.id}`} className="text-sm font-medium">
              Your answer
            </label>
            {question.type === "predict_output" ? (
              <textarea
                id={`answer-${question.id}`}
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange?.(e.target.value)}
                rows={3}
                placeholder="Type exactly what the program prints"
                className="rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
              />
            ) : (
              <Input
                id={`answer-${question.id}`}
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder="Type the missing code"
                className="font-mono"
              />
            )}
          </div>
        )
      )}

      {reveal && (
        <div
          className={cn(
            "rounded-lg border p-4",
            reveal.correct === false ? "border-destructive/40 bg-destructive/5" : "border-chart-3/40 bg-chart-3/10",
          )}
        >
          {reveal.correct !== undefined && (
            <p className={cn("text-sm font-semibold", reveal.correct ? "text-chart-3" : "text-destructive")}>
              {reveal.correct ? "Correct" : "Not quite"}
            </p>
          )}
          {!isChoiceType(question.type) && (
            <p className={cn("mt-1", large ? "text-xl" : "text-sm")}>
              Answer: <span className="whitespace-pre-wrap font-mono font-semibold">{reveal.answer}</span>
            </p>
          )}
          <p className={cn("mt-1 text-muted-foreground text-pretty", large ? "text-lg" : "text-sm")}>
            {reveal.explanation}
          </p>
        </div>
      )}
    </div>
  )
}
