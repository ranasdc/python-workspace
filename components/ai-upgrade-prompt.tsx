"use client"

import { useState } from "react"

import { SubscriptionModal } from "@/components/subscription-modal"

/**
 * The entitlement code the AI endpoints return when the account is simply not
 * entitled to the feature — as opposed to `ai_limit`, which means an entitled
 * account has used up this month's allowance and has nothing to upgrade.
 */
export const AI_NOT_AVAILABLE = "ai_not_available"

/**
 * Turns a refused AI request into the upgrade prompt.
 *
 * The AI buttons stay visible and enabled for a free teacher on purpose, so
 * they can see what the product offers. The server refuses the request and
 * this is what the refusal becomes: the same upgrade experience shown at
 * onboarding, rather than a dead end or an error message.
 */
export function useAiUpgradePrompt() {
  const [open, setOpen] = useState(false)

  /**
   * Call with the parsed error payload from an AI endpoint. Returns true when
   * it was an entitlement block and the prompt has been opened, so the caller
   * knows not to surface an error of its own as well.
   */
  function handleRefusal(payload: { code?: string } | null | undefined): boolean {
    if (payload?.code !== AI_NOT_AVAILABLE) return false
    setOpen(true)
    return true
  }

  return { open, setOpen, handleRefusal }
}

export function AiUpgradePrompt({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <SubscriptionModal
      open={open}
      onOpenChange={onOpenChange}
      role="teacher"
      title="Unlock AI-powered teaching tools"
      description="AI task generation, starters and the other AI teaching tools are part of Teacher Pro. Join your school with a teacher code, or upgrade on your own."
    />
  )
}
