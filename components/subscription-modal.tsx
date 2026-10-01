"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PlanChoice } from "@/components/plan-choice"

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set when the prompt follows a blocked action rather than the Upgrade button. */
  limitType?: "file" | "folder" | null
  /** Called once the student's access has actually changed. */
  onUnlocked?: () => void
}

/**
 * The upgrade prompt for a free student. It offers the same two routes as the
 * welcome screen — a class code from their teacher, or Student Pro — because a
 * pupil whose school already pays should never be asked for money.
 */
export function SubscriptionModal({
  open,
  onOpenChange,
  limitType,
  onUnlocked,
}: SubscriptionModalProps) {
  const router = useRouter()

  const description =
    limitType === "file"
      ? "You've reached your file limit. There are two ways to unlock unlimited files and folders."
      : limitType === "folder"
        ? "You've reached your folder limit. There are two ways to unlock unlimited files and folders."
        : "Two ways to unlock unlimited files and folders in every IDE."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Remounted per opening so a half-finished code entry is never the
            first thing the student sees next time. */}
        <PlanChoice
          key={open ? "open" : "closed"}
          role="student"
          title="Unlock the full workspace"
          description={description}
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
