"use client"

import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FREE_ALLOWANCE } from "@/lib/plans"
import type { JoinClassResult } from "@/app/actions/classes"

/**
 * Tell a pupil what joining a class actually got them.
 *
 * Every join succeeds the same way, but only a class inside a paying school
 * unlocks Pro. A flat "you've joined" in the other case leaves the pupil to
 * discover the free-tier limits on their own and blame the product for them,
 * so that outcome gets a full card instead of a line of text: it names the
 * reason, states the allowance they are left on, and offers the ways out.
 */
export function showClassJoinedToast(
  joined: JoinClassResult,
  options?: { onSeePlans?: () => void },
) {
  if (joined.access === "school") {
    toast.success(`You've joined ${joined.name}.`, {
      description:
        "Your school's plan covers you, so every Pro feature is unlocked at no cost.",
    })
    return
  }

  if (joined.access === "individual") {
    toast.success(`You've joined ${joined.name}.`, {
      description:
        "Your teacher can now set you work. Your Student Pro plan carries on as normal.",
    })
    return
  }

  toast.custom(
    (id) => (
      <div className="flex w-full gap-3 rounded-lg border border-amber-500/50 bg-popover p-4 text-popover-foreground shadow-lg">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-sm font-semibold text-pretty">
            You&apos;ve joined {joined.name}, but Pro isn&apos;t included
          </p>
          <p className="text-sm text-muted-foreground text-pretty">
            This class isn&apos;t covered by a school plan, so you stay on the free
            tier: {FREE_ALLOWANCE.student}.
          </p>
          <p className="text-sm text-muted-foreground text-pretty">
            Ask your teacher whether your school is getting a plan, or upgrade
            yourself whenever you like.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {options?.onSeePlans && (
              <Button
                size="sm"
                onClick={() => {
                  toast.dismiss(id)
                  options.onSeePlans?.()
                }}
              >
                See plans
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => toast.dismiss(id)}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    ),
    { duration: 14000 },
  )
}
