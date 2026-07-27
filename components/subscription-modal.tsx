"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  limitType?: "file" | "folder"
}

export function SubscriptionModal({ open, onOpenChange, limitType }: SubscriptionModalProps) {
  // Calculate yearly discount: £30/year vs £3.99 × 12 = £47.88
  const monthlyPrice = 3.99
  const yearlyPrice = 30
  const monthlyAnnual = monthlyPrice * 12
  const discountPercent = Math.round(((monthlyAnnual - yearlyPrice) / monthlyAnnual) * 100)

  const features = [
    "Unlimited files and folders",
    "AI assisted learning",
    "Everyday coding exercises",
    "Roadmap to learn Python",
    "Priority support",
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>
            {limitType === "file"
              ? "You&apos;ve reached your file limit. Upgrade to create unlimited files and folders."
              : "You&apos;ve reached your folder limit. Upgrade to create unlimited files and folders."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6 md:grid-cols-2">
          {/* Monthly Plan */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Monthly</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">£{monthlyPrice}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <Button className="mt-6 w-full" size="lg">
              Subscribe Monthly
            </Button>
            <div className="mt-6 space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Yearly Plan */}
          <div className={cn("relative rounded-lg border-2 border-primary bg-card p-6")}>
            <div className="absolute -top-3 left-6 inline-block bg-background px-2">
              <span className="text-xs font-semibold text-primary">
                Save {discountPercent}%
              </span>
            </div>
            <h3 className="text-lg font-semibold">Yearly</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">£{yearlyPrice}</span>
              <span className="text-sm text-muted-foreground">/year</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Only £{(yearlyPrice / 12).toFixed(2)}/month
            </div>
            <Button className="mt-6 w-full" size="lg" variant="default">
              Subscribe Yearly
            </Button>
            <div className="mt-6 space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
