"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { openBillingPortal } from "@/app/actions/billing"

export function ManageBillingButton({
  schoolId,
  children = "Manage billing",
  variant,
}: {
  schoolId?: number
  children?: React.ReactNode
  variant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const { url } = await openBillingPortal(schoolId)
      // The portal refuses to render in an iframe, so break out when embedded.
      if (window.self !== window.top) window.open(url, "_blank", "noopener,noreferrer")
      else window.location.href = url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant={variant}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}
