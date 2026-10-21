"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeSchoolTier, startSchoolUpgrade } from "@/app/actions/upgrades"
import type { PlanId } from "@/lib/plans"

type Props = {
  planId: PlanId
  planName: string
  /** Which mechanic applies: a new subscription, or a tier change on an existing one. */
  scope: "individual" | "school"
  schoolId: number | null
  /** True when the teacher has no school yet and must name one. */
  needsSchool: boolean
}

/**
 * The one control that commits money.
 *
 * It names a plan and nothing else — no price, no seat count, no school id for
 * the school path beyond the one the server re-checks against the caller's own
 * membership. Everything that decides what is charged is resolved again on the
 * server from the caller's verified position.
 */
export function ConfirmUpgrade({ planId, planName, scope, schoolId, needsSchool }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [schoolName, setSchoolName] = useState("")

  async function handleConfirm() {
    // Guards the double click that fires before the first request has returned.
    if (busy) return
    setBusy(true)

    try {
      if (scope === "individual") {
        const { url } = await startSchoolUpgrade(planId, schoolName)
        // Stripe refuses to render inside an iframe, so break out when embedded.
        if (window.self !== window.top) {
          window.open(url, "_blank", "noopener,noreferrer")
          // The tab that opened Stripe is left on a dead confirmation screen
          // otherwise, with no way back to a verified state.
          setBusy(false)
        } else {
          window.location.href = url
        }
        return
      }

      if (!schoolId) throw new Error("No school to upgrade")
      const result = await changeSchoolTier(planId, schoolId)

      if (result.alreadyApplied) {
        toast.success(`Your school is already on ${planName}.`)
      } else if (result.ok) {
        toast.success(`Your school is now on ${result.planName}.`)
      } else {
        // Stripe accepted the change but the subscription is not active — a
        // declined proration invoice, most likely. Saying "upgraded" here
        // would be a lie the seat limits would then contradict.
        toast.error(
          `The plan change was submitted but payment is ${result.status}. Check your billing details.`,
        )
      }

      router.push("/school")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the upgrade")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {needsSchool && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="schoolName">Your school&apos;s name</Label>
          <Input
            id="schoolName"
            name="schoolName"
            value={schoolName}
            onChange={(event) => setSchoolName(event.target.value)}
            placeholder="Northgate High School"
            autoComplete="organization"
            required
          />
          <p className="text-xs text-muted-foreground text-pretty">
            This creates your school and makes you its administrator, so the plan has
            somewhere to attach. You can rename it later.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleConfirm} disabled={busy} size="lg">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {scope === "individual" ? "Continue to secure payment" : `Confirm upgrade`}
        </Button>
      </div>
    </div>
  )
}
