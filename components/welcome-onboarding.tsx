"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { completeOnboarding, type OnboardingChoice } from "@/app/actions/onboarding"
import {
  PlanChoice,
  PLAN_CHOICE_COPY,
  type PlanChoiceRole,
} from "@/components/plan-choice"

const COPY: Record<
  PlanChoiceRole,
  { title: string; description: string; free: OnboardingChoice }
> = {
  student: {
    title: "Welcome to MyCodePad",
    description: "Choose how you'd like to start. You can change this at any time.",
    free: "individual",
  },
  teacher: {
    title: "Welcome to MyCodePad",
    description:
      "Choose how you'll teach with MyCodePad. You can change this at any time.",
    free: "later",
  },
}

/**
 * First-run choice for a brand new account. It is shown only while the user has
 * no Pro access of their own and no school behind them, and it records the
 * choice so it never appears again.
 */
export function WelcomeOnboarding({ role }: { role: PlanChoiceRole }) {
  const router = useRouter()
  const copy = COPY[role]
  const [open, setOpen] = useState(true)
  const [pending, setPending] = useState(false)

  async function finish(choice: OnboardingChoice) {
    await completeOnboarding(choice)
    setOpen(false)
    router.refresh()
  }

  async function handleFree() {
    setPending(true)
    try {
      await finish(copy.free)
      toast.success("You're all set. Start coding whenever you're ready.")
    } catch {
      // Closing is more important than recording the choice.
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    // Held open deliberately: the choice is made with the buttons below, not by
    // clicking away, so nobody lands in the app without seeing their options.
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-2xl">
        <PlanChoice
          role={role}
          title={copy.title}
          description={copy.description}
          busy={pending}
          onJoined={() => finish(role === "student" ? "class" : "school")}
          // Recorded only once Stripe has accepted it, so a failed checkout
          // leaves the user able to choose again next time.
          onCheckout={() => finish(role === "student" ? "individual" : "teacher_pro")}
          footer={(busy) => (
            <>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={handleFree}
              >
                {pending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Continue for free
              </Button>
              <p className="text-center text-xs text-muted-foreground text-pretty">
                {PLAN_CHOICE_COPY[role].freeNote}
              </p>
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
