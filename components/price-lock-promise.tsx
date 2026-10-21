import { CalendarCheck, Lock, RefreshCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { PLANS, SALE, discountPercent } from "@/lib/plans"

/**
 * The sale's price-lock promise: subscribe during the sale and renewals stay at
 * the sale price for `SALE.priceLockYears` years.
 *
 * Gated on a real discount existing, exactly like the sale banner. Once the
 * sale ends there is no sale price left to lock, so promising one would be
 * untrue — which is why this component decides for itself rather than trusting
 * a caller to remember to remove it.
 */
export function PriceLockPromise({ className }: { className?: string }) {
  if (!SALE.active) return null
  const maxDiscount = Math.max(...Object.values(PLANS).map(discountPercent))
  if (maxDiscount <= 0) return null

  const years = SALE.priceLockYears

  const promises = [
    {
      icon: RefreshCcw,
      title: "Renews at the sale price",
      body: `Every renewal for the next ${years} years is charged at the price you joined at — not the full list price.`,
    },
    {
      icon: Lock,
      title: "No mid-term price rises",
      body: `Your rate is fixed for ${years} years, even if our list prices go up in the meantime.`,
    },
    {
      icon: CalendarCheck,
      title: "Budget with confidence",
      body: `That is ${years} academic years of known cost — handy when next year's budget is signed off this year.`,
    },
  ]

  return (
    <section
      aria-labelledby="price-lock-promise"
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/5 px-6 py-8 sm:px-8",
        className,
      )}
    >
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Price promise
        </span>
        <h2
          id="price-lock-promise"
          className="mt-3 text-2xl font-semibold tracking-tight text-balance"
        >
          Join at today&apos;s price. Keep it for {years} years.
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          The sale price is not an introductory rate that quietly jumps at renewal. Subscribe
          while the sale is on and it stays your price for {years} full years — on every plan
          above.
        </p>
      </div>

      <ul className="mt-8 grid gap-6 sm:grid-cols-3">
        {promises.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <Icon className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
