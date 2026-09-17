"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { startCheckout } from "@/app/actions/billing"
import type { PlanId } from "@/lib/plans"

type Props = {
  planId: PlanId
  schoolId?: number
  children: React.ReactNode
  className?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
}

export function CheckoutButton({
  planId,
  schoolId,
  children,
  className,
  variant,
  size = "lg",
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const { url } = await startCheckout(planId, schoolId)
      // Stripe refuses to render inside an iframe, so break out when embedded.
      if (window.self !== window.top) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        window.location.href = url
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start checkout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={className}
      variant={variant}
      size={size}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
