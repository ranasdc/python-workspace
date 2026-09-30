"use client"

import { useState, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  GraduationCap,
  Loader2,
  School,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { completeOnboarding, type OnboardingChoice } from "@/app/actions/onboarding"
import { joinClass } from "@/app/actions/classes"
import { joinSchoolWithCode } from "@/app/actions/schools"
import { startCheckout } from "@/app/actions/billing"
import { PLANS, formatPrice, type PlanId } from "@/lib/plans"

type Role = "student" | "teacher"

type Copy = {
  title: string
  description: string
  /** The option that redeems a code from a school. */
  code: {
    icon: ComponentType<{ className?: string }>
    badge: string
    heading: string
    summary: string
    features: string[]
    action: string
    stepTitle: string
    stepDescription: string
    label: string
    placeholder: string
    submit: string
  }
  /** The paid plan for someone buying on their own. */
  pro: {
    planId: PlanId
    icon: ComponentType<{ className?: string }>
    summary: string
    action: string
  }
  /** The way to carry on without paying or joining a school. */
  free: {
    choice: OnboardingChoice
    action: string
    note: string
  }
}

const COPY: Record<Role, Copy> = {
  student: {
    title: "Welcome to MyCodePad",
    description: "Choose how you'd like to start. You can change this at any time.",
    code: {
      icon: GraduationCap,
      badge: "Free with your school",
      heading: "Join your class",
      summary: "Use the class code your teacher gave you.",
      features: [
        "Everything in Student Pro, paid for by your school",
        "Work set by your teacher",
        "Feedback on the code you write",
      ],
      action: "Enter class code",
      stepTitle: "Join your class",
      stepDescription:
        "Enter the class code your teacher gave you. If your school has a plan, full access is unlocked straight away.",
      label: "Class code",
      placeholder: "ABC123",
      submit: "Join class",
    },
    pro: {
      planId: "student_pro",
      icon: Sparkles,
      summary: "For learning on your own, without a school.",
      action: "Upgrade to Student Pro",
    },
    free: {
      choice: "individual",
      action: "Continue for free",
      note: "1 folder and 2 files in each IDE. Upgrade whenever you like.",
    },
  },
  teacher: {
    title: "Welcome to MyCodePad",
    description:
      "Choose how you'll teach with MyCodePad. You can change this at any time.",
    code: {
      icon: School,
      badge: "Paid for by your school",
      heading: "Join your school",
      summary: "Use the teacher code from your school administrator.",
      features: [
        "Everything in Teacher Pro, at no personal cost",
        "Your classes covered by the school plan",
        "Shared with the rest of your department",
      ],
      action: "Enter teacher code",
      stepTitle: "Join your school",
      stepDescription:
        "Enter the teacher code from your school administrator. Your classes and students are covered by the school plan.",
      label: "Teacher code",
      placeholder: "ABCD2345EFGH",
      submit: "Join school",
    },
    pro: {
      planId: "teacher_pro",
      icon: Sparkles,
      summary: "For running your own classes, without a school plan.",
      action: "Upgrade to Teacher Pro",
    },
    free: {
      choice: "later",
      action: "Continue for free",
      note: "1 class with up to 5 students. Upgrade whenever you like.",
    },
  },
}

/**
 * First-run choice for a brand new account. It is shown only while the user has
 * no Pro access of their own and no school behind them, and it records the
 * choice so it never appears again.
 */
export function WelcomeOnboarding({ role }: { role: Role }) {
  const router = useRouter()
  const copy = COPY[role]
  const plan = PLANS[copy.pro.planId]
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<"choose" | "code">("choose")
  const [pending, setPending] = useState<"code" | "pro" | "free" | null>(null)

  const busy = pending !== null

  async function finish(choice: OnboardingChoice) {
    await completeOnboarding(choice)
    setOpen(false)
    router.refresh()
  }

  async function handleCode(formData: FormData) {
    setPending("code")
    try {
      if (role === "student") {
        const joined = await joinClass(formData)
        await finish("class")
        toast.success(`You've joined ${joined.name}.`)
      } else {
        const result = await joinSchoolWithCode(formData)
        await finish("school")
        toast.success(
          result.alreadyMember
            ? "You're already a member of this school."
            : "You've joined your school. Full Pro access is now unlocked.",
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work")
    } finally {
      setPending(null)
    }
  }

  async function handlePro() {
    setPending("pro")
    try {
      // Record the choice only once Stripe has accepted it, so a failed
      // checkout leaves the user able to choose again next time.
      const { url } = await startCheckout(copy.pro.planId)
      await finish(role === "student" ? "individual" : "teacher_pro")
      // Stripe refuses to render inside an iframe, so break out when embedded.
      if (window.self !== window.top) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        window.location.href = url
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setPending(null)
    }
  }

  async function handleFree() {
    setPending("free")
    try {
      await finish(copy.free.choice)
      toast.success("You're all set. Start coding whenever you're ready.")
    } catch {
      // Closing is more important than recording the choice.
      setOpen(false)
    } finally {
      setPending(null)
    }
  }

  const CodeIcon = copy.code.icon
  const ProIcon = copy.pro.icon

  return (
    // Held open deliberately: the choice is made with the buttons below, not by
    // clicking away, so nobody lands in the app without seeing their options.
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-2xl">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{copy.title}</DialogTitle>
              <DialogDescription className="text-pretty">
                {copy.description}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                icon={CodeIcon}
                badge={copy.code.badge}
                heading={copy.code.heading}
                summary={copy.code.summary}
                features={copy.code.features}
                action={copy.code.action}
                disabled={busy}
                onAction={() => setStep("code")}
              />
              <OptionCard
                icon={ProIcon}
                badge={`${formatPrice(plan.priceInPence)} a ${plan.interval}`}
                heading={plan.name}
                summary={copy.pro.summary}
                features={plan.features}
                action={copy.pro.action}
                highlighted
                disabled={busy}
                loading={pending === "pro"}
                onAction={handlePro}
              />
            </div>

            <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={handleFree}
              >
                {pending === "free" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {copy.free.action}
              </Button>
              <p className="text-center text-xs text-muted-foreground text-pretty">
                {copy.free.note}
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CodeIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <DialogTitle>{copy.code.stepTitle}</DialogTitle>
              <DialogDescription className="text-pretty">
                {copy.code.stepDescription}
              </DialogDescription>
            </DialogHeader>

            <form action={handleCode} className="flex flex-col gap-3">
              <Label htmlFor="onboarding-code">{copy.code.label}</Label>
              <Input
                id="onboarding-code"
                name={role === "student" ? "joinCode" : "code"}
                placeholder={copy.code.placeholder}
                autoComplete="off"
                autoFocus
                className="font-mono uppercase"
                required
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStep("choose")}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {pending === "code" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {copy.code.submit}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OptionCard({
  icon: Icon,
  badge,
  heading,
  summary,
  features,
  action,
  onAction,
  highlighted,
  disabled,
  loading,
}: {
  icon: ComponentType<{ className?: string }>
  badge: string
  heading: string
  summary: string
  features: string[]
  action: string
  onAction: () => void
  highlighted?: boolean
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border bg-card p-4 ${
        highlighted ? "border-primary" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {badge}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{heading}</h3>
        <p className="text-sm text-muted-foreground text-pretty">{summary}</p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-muted-foreground text-pretty">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "default" : "outline"}
        className="mt-auto w-full"
        disabled={disabled}
        onClick={onAction}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {action}
      </Button>
    </div>
  )
}
