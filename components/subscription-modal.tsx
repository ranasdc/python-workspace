"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PlanChoice, type PlanChoiceRole } from "@/components/plan-choice"

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whose upgrade routes to offer. Defaults to the student pair. */
  role?: PlanChoiceRole
  /** Set when the prompt follows a blocked action rather than the Upgrade button. */
  limitType?: "file" | "folder" | null
  /** Overrides the heading, for a prompt about a specific blocked feature. */
  title?: string
  /** Overrides the body copy. Takes precedence over `limitType`. */
  description?: string
  /** Called once the user's access has actually changed. */
  onUnlocked?: () => void
}

/**
 * The upgrade prompt, shared by every path that asks someone to unlock more.
 *
 * It always offers the same two routes as the first-run welcome screen — a
 * code from the school, or the paid plan — because someone whose school
 * already pays should never be asked for money. The `role` prop is what makes
 * it serve a teacher as well as a pupil: the teacher sees the teacher code
 * route and Teacher Pro, from the same component, styling and checkout flow
 * used at onboarding.
 */
export function SubscriptionModal({
  open,
  onOpenChange,
  role = "student",
  limitType,
  title,
  description,
  onUnlocked,
}: SubscriptionModalProps) {
  const router = useRouter()

  // A teacher and a pupil unlock different things, so the default wording
  // follows the role rather than describing a pupil's file allowance to a
  // teacher who came here about classes.
  const body =
    description ??
    (limitType === "file"
      ? "You've reached your file limit. There are two ways to unlock unlimited files and folders."
      : limitType === "folder"
        ? "You've reached your folder limit. There are two ways to unlock unlimited files and folders."
        : role === "teacher"
          ? "Two ways to unlock unlimited classes, students and the AI teaching tools."
          : "Two ways to unlock unlimited files and folders in every IDE.")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Remounted per opening so a half-finished code entry is never the
            first thing the user sees next time. */}
        <PlanChoice
          key={open ? "open" : "closed"}
          role={role}
          title={title ?? "Unlock the full workspace"}
          description={body}
          onJoined={() => {
            onOpenChange(false)
            onUnlocked?.()
            router.refresh()
          }}
          footer={(busy) => (
            <Button
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Maybe later
            </Button>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
