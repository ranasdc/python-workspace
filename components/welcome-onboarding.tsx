"use client"

import { useState, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  GraduationCap,
  Laptop,
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
import { completeOnboarding } from "@/app/actions/onboarding"
import { joinClass } from "@/app/actions/classes"
import { joinSchoolWithCode } from "@/app/actions/schools"
import { startCheckout } from "@/app/actions/billing"
import { PLANS, formatPrice } from "@/lib/plans"

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
    stepTitle: string
    stepDescription: string
    label: string
    placeholder: string
    submit: string
  }
  /** The option that continues without a school. */
  solo: {
    icon: ComponentType<{ className?: string }>
    badge: string
    heading: string
    summary: string
  }
}

const COPY: Record<Role, Copy> = {
  student: {
    title: "Welcome to MyCodePad",
    description: "How would you like to start? You can change this at any time.",
    code: {
      icon: GraduationCap,
      badge: "Free through your school",
      heading: "Join your class",
      summary:
        "Use the class code from your teacher. Your school covers everything, so you get unlimited files and AI help at no cost.",
      stepTitle: "Join your class",
      stepDescription:
        "Enter the class code your teacher gave you. If your school has a plan, full access is unlocked straight away.",
      label: "Class code",
      placeholder: "ABC123",
      submit: "Join class",
    },
    solo: {
      icon: Laptop,
      badge: "Free",
      heading: "Learn on your own",
      summary:
        "Start coding right now. The free plan gives you 1 folder and 2 files in each IDE, and you can upgrade whenever you like.",
    },
  },
  teacher: {
    title: "Welcome to MyCodePad",
    description:
      "Choose how you'll teach with MyCodePad. You can change this at any time.",
    code: {
      icon: School,
      badge: "Paid by your school",
      heading: "Join your school",
      summary:
        "Use the teacher code from your school administrator. Every Teacher Pro feature is included at no personal cost.",
      stepTitle: "Join your school",
      stepDescription:
        "Enter the teacher code from your school administrator. Your classes and students are covered by the school plan.",
      label: "Teacher code",
      placeholder: "ABCD2345EFGH",
      submit: "Join school",
    },
    solo: {
      icon: Sparkles,
      badge: `${formatPrice(PLANS.teacher_pro.priceInPence)} a month`,
      heading: "Upgrade to Teacher Pro",
      summary:
        "Unlimited classes and students, a reusable lesson library, marking tools and AI assisted learning for your class.",
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
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<"choose" | "code">("choose")
  const [pending, setPending] = useState<"code" | "solo" | "later" | null>(null)

  const busy = pending !== null

  async function finish(choice: Parameters<typeof completeOnboarding>[0]) {
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

  async function handleSolo() {
    setPending("solo")
    try {
      if (role === "student") {
        await finish("individual")
        toast.success("You're all set. Start coding whenever you're ready.")
        return
      }
      // Record the choice only once Stripe has accepted it, so a failed
      // checkout leaves the teacher able to choose again next time.
      const { url } = await startCheckout("teacher_pro")
      await finish("teacher_pro")
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

  async function handleLater() {
    setPending("later")
    try {
      await finish("later")
    } catch {
      // Closing is more important than recording the deferral.
      setOpen(false)
    } finally {
      setPending(null)
    }
  }

  const CodeIcon = copy.code.icon
  const SoloIcon = copy.solo.icon

  return (
    // Held open deliberately: the choice is made with the buttons below, not by
    // clicking away, so nobody lands in the app without seeing their options.
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
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
                disabled={busy}
                onClick={() => setStep("code")}
              />
              <OptionCard
                icon={SoloIcon}
                badge={copy.solo.badge}
                heading={copy.solo.heading}
                summary={copy.solo.summary}
                disabled={busy}
                loading={pending === "solo"}
                onClick={handleSolo}
              />
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleLater}
                className="text-muted-foreground"
              >
                {pending === "later" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                I&apos;ll decide later
              </Button>
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
                  {pending === "code" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  onClick,
  disabled,
  loading,
}: {
  icon: ComponentType<{ className?: string }>
  badge: string
  heading: string
  summary: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex h-full flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {badge}
        </span>
      </div>
      <span className="font-medium">{heading}</span>
      <span className="text-sm text-muted-foreground text-pretty">{summary}</span>
    </button>
  )
}
