"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { CheckoutButton } from "@/components/checkout-button"
import { PLANS, formatPrice } from "@/lib/plans"

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  limitType?: "file" | "folder"
}

export function SubscriptionModal({ open, onOpenChange, limitType }: SubscriptionModalProps) {
  const plan = PLANS.student_pro

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upgrade to {plan.name}</DialogTitle>
          <DialogDescription>
            {limitType === "file"
              ? "You've reached your file limit. Upgrade to create unlimited files and folders."
              : "You've reached your folder limit. Upgrade to create unlimited files and folders."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="rounded-lg border-2 border-primary bg-card p-6">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{formatPrice(plan.priceInPence)}</span>
              <span className="text-sm text-muted-foreground">/{plan.interval}</span>
            </div>
            <CheckoutButton planId={plan.id} className="mt-6 w-full">
              Upgrade to {plan.name}
            </CheckoutButton>
            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground text-pretty">
            Part of a school?{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              School plans give every student Pro
            </Link>{" "}
            at no cost to you.
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
