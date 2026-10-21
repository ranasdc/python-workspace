import { Sparkles, Tag } from "lucide-react"

import { cn } from "@/lib/utils"
import { SALE, discountPercent, plansOnSale } from "@/lib/plans"

export function SaleBanner({ className }: { className?: string }) {
  if (!SALE.active) return null

  // Named rather than implied. The sale no longer covers every plan — the
  // school tiers are sold at their plain prices — so saying "every plan" would
  // promise a discount that three of the cards below cannot honour. The list
  // comes from the catalogue, so a plan joining or leaving the sale changes this
  // sentence without anyone having to remember to edit it.
  const onSale = plansOnSale()
  if (onSale.length === 0) return null

  const maxDiscount = Math.max(...onSale.map(discountPercent))
  if (maxDiscount <= 0) return null

  const names = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(
    onSale.map((plan) => plan.name),
  )

  return (
    <aside
      aria-label={SALE.name}
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-violet-600 to-primary px-5 py-4 text-primary-foreground shadow-lg shadow-primary/20",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_18px,rgb(255_255_255/0.06)_18px_36px)]"
      />
      <div className="relative flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {SALE.name}
          </span>
          <p className="text-lg font-semibold text-balance">
            Save up to {maxDiscount}% on {names}
          </p>
        </div>
        {/* Carries the price lock above the fold; the full promise, with the
            renewal detail, sits in PriceLockPromise further down the page. */}
        <p className="flex items-center gap-1.5 text-sm opacity-90">
          <Tag className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Applied automatically at checkout, then locked in for {SALE.priceLockYears} years
        </p>
      </div>
    </aside>
  )
}
