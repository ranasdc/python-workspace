"use client"

import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FREE_ALLOWANCE } from "@/lib/plans"
import type { JoinClassResult } from "@/app/actions/classes"

/**
 * Tell a pupil what joining a class actually got them.
 *
 * Every join succeeds the same way, but Pro only follows when someone is
 * paying: a school on a plan, or the class owner on Teacher Pro. A flat
 * "you've joined" otherwise leaves the pupil to discover the free-tier limits
 * on their own and blame the product for them, so that outcome gets a full
 * card instead of a line of text: it names the reason, states the allowance
 * they are left on, and points at the two people who can change it.
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

  if (joined.access === "teacher") {
    toast.success(`You've joined ${joined.name}.`, {
      description:
        "Your teacher's Teacher Pro plan covers everyone they teach, so every Pro feature is unlocked at no cost to you.",
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
            Neither a teacher nor a school plan covers this class, so you stay on
            the free tier: {FREE_ALLOWANCE.student}.
          </p>
          <p className="text-sm text-muted-foreground text-pretty">
            Ask your teacher or tutor whether they have Teacher Pro, or ask your
            school for a code — either one turns Pro on for you automatically, at
            no cost.
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
