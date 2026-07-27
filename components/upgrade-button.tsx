"use client"

import { Button } from "@/components/ui/button"
import { Zap } from "lucide-react"

interface UpgradeButtonProps {
  onClick?: () => void
  compact?: boolean
}

export function UpgradeButton({ onClick, compact = false }: UpgradeButtonProps) {
  if (compact) {
    return (
      <Button
        size="sm"
        className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        onClick={onClick}
      >
        <Zap className="h-4 w-4" />
        Upgrade
      </Button>
    )
  }

  return (
    <Button
      className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
      onClick={onClick}
    >
      <Zap className="h-5 w-5" />
      Upgrade to Premium
    </Button>
  )
}
