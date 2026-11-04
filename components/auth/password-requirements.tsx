"use client"

import { Check } from "lucide-react"

import { PASSWORD_RULES } from "@/lib/validation/account"
import { cn } from "@/lib/utils"

/**
 * Indexed by how many rules are met, so the meter and the checklist can never
 * disagree about how strong the password is.
 */
const STRENGTH = [
  { label: "Too weak", color: "bg-destructive" },
  { label: "Too weak", color: "bg-destructive" },
  { label: "Weak", color: "bg-[#f59e0b]" },
  { label: "Fair", color: "bg-[#f59e0b]" },
  { label: "Good", color: "bg-primary" },
  { label: "Strong", color: "bg-[#10b981]" },
]

/**
 * The live checklist shown under a new-password field.
 *
 * It renders whatever PASSWORD_RULES says, so the list a user is working
 * through is literally the list the server will enforce — a rule cannot be
 * added in one place and forgotten in the other.
 *
 * Every requirement is listed from the start, met or not, rather than
 * revealing them one failure at a time. Only the strength summary announces
 * itself to screen readers, and only when the wording actually changes;
 * putting the list itself in a live region would narrate every keystroke.
 */
export function PasswordRequirements({
  password,
  id,
  className,
}: {
  password: string
  id?: string
  className?: string
}) {
  const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length
  const strength = STRENGTH[met]

  return (
    <div id={id} className={cn("mt-1", className)}>
      <div className="flex gap-1.5" aria-hidden="true">
        {PASSWORD_RULES.map((rule, index) => (
          <span
            key={rule.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              password && index < met ? strength.color : "bg-muted",
            )}
          />
        ))}
      </div>

      <p className="mt-1.5 text-xs font-medium text-muted-foreground" aria-live="polite">
        {password ? (
          <>
            Strength: <span className="text-foreground">{strength.label}</span>
          </>
        ) : (
          "Your password must include:"
        )}
      </p>

      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2 text-xs",
                ok ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  ok ? "border-[#10b981] bg-[#10b981] text-white" : "border-border",
                )}
              >
                {ok && <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />}
              </span>
              {rule.label}
              <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
