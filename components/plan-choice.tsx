"use client"

import { useState, type ComponentType, type ReactNode } from "react"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { joinClass } from "@/app/actions/classes"
import { joinSchoolWithCode } from "@/app/actions/schools"
import { startCheckout } from "@/app/actions/billing"
import { showClassJoinedToast } from "@/lib/class-join-toast"
import { FREE_ALLOWANCE, PLANS, formatPrice, type PlanId } from "@/lib/plans"

export type PlanChoiceRole = "student" | "teacher"

type Copy = {
  /** Redeeming a code so the school pays instead of the person. */
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
  /** What staying on the free tier actually means, for the footer. */
  freeNote: string
}

/**
 * Shared wording for the two ways to unlock everything. Exported so the
 * screens that wrap `PlanChoice` can reuse the same phrases in their footers.
 */
export const PLAN_CHOICE_COPY: Record<PlanChoiceRole, Copy> = {
  student: {
    code: {
      icon: GraduationCap,
      badge: "Free with your school",
      heading: "Join your class",
      summary:
        "Get it from your teacher — they may already have a class code for you.",
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
    freeNote: `${FREE_ALLOWANCE.student}. Upgrade whenever you like.`,
  },
  teacher: {
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
    freeNote: `${FREE_ALLOWANCE.teacher}. Upgrade whenever you like.`,
  },
}

/**
 * The two routes to a full account, side by side: redeem a code so the school
 * pays, or buy the plan yourself. Rendered inside a `DialogContent` by both the
 * first-run welcome screen and the upgrade prompt, so a pupil who is offered an
 * upgrade always sees the school route too.
 */
export function PlanChoice({
  role,
  title,
  description,
  footer,
  busy = false,
  onJoined,
  onCheckout,
}: {
  role: PlanChoiceRole
  title: string
  description: string
  /** Rendered under a divider. Receives the busy state so it can disable itself. */
  footer?: (busy: boolean) => ReactNode
  /** Set while the parent runs its own footer action. */
  busy?: boolean
  /** Runs after a code is redeemed, before the toast is shown. */
  onJoined?: () => Promise<void> | void
  /** Runs after Stripe accepts the session, before leaving the page. */
  onCheckout?: () => Promise<void> | void
}) {
  const router = useRouter()
  const copy = PLAN_CHOICE_COPY[role]
  const plan = PLANS[copy.pro.planId]
  const [step, setStep] = useState<"choose" | "code">("choose")
  const [pending, setPending] = useState<"code" | "pro" | null>(null)

  const isBusy = busy || pending !== null

  async function handleCode(formData: FormData) {
    setPending("code")
    try {
      if (role === "student") {
        const joined = await joinClass(formData)
        await onJoined?.()
        // The class alone decides whether this unlocked anything, so the
        // result is what speaks rather than a blanket success message.
        showClassJoinedToast(joined, { onSeePlans: () => router.push("/pricing") })
      } else {
        const result = await joinSchoolWithCode(formData)
        await onJoined?.()
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
      const { url } = await startCheckout(copy.pro.planId)
      await onCheckout?.()
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

  const CodeIcon = copy.code.icon
  const ProIcon = copy.pro.icon

  if (step === "code") {
    return (
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
          <Label htmlFor="plan-choice-code">{copy.code.label}</Label>
          <Input
            id="plan-choice-code"
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
              disabled={isBusy}
              onClick={() => setStep("choose")}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button type="submit" disabled={isBusy}>
              {pending === "code" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {copy.code.submit}
            </Button>
          </div>
        </form>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription className="text-pretty">{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          icon={CodeIcon}
          badge={copy.code.badge}
          heading={copy.code.heading}
          summary={copy.code.summary}
          features={copy.code.features}
          action={copy.code.action}
          disabled={isBusy}
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
          disabled={isBusy}
          loading={pending === "pro"}
          onAction={handlePro}
        />
      </div>

      {footer && (
        <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
          {footer(isBusy)}
        </div>
      )}
    </>
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
