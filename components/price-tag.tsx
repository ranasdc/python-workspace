import { cn } from "@/lib/utils"
import {
  type BillingInterval,
  discountPercent,
  formatPrice,
  isOnSale,
  priceFor,
  type Plan,
} from "@/lib/plans"

export function PriceTag({
  plan,
  size = "lg",
  prefix,
  inverted = false,
  interval,
  className,
}: {
  plan: Plan
  size?: "md" | "lg"
  /** Leading word such as "from". */
  prefix?: string
  /** For use on dark-on-light cards where muted text should follow the card's foreground. */
  inverted?: boolean
  /** Which interval to quote. Defaults to the interval the plan is sold on. */
  interval?: BillingInterval
  className?: string
}) {
  const shown = interval ?? plan.interval
  const priceInPence = priceFor(plan, shown) ?? plan.priceInPence
  // A verified list price is only evidence for the interval it was quoted on,
  // so an alternative interval is shown at its plain price with no claim of a
  // discount attached to it.
  const onSale = isOnSale(plan) && shown === plan.interval
  const original =
    plan.originalPriceInPence === undefined ? null : formatPrice(plan.originalPriceInPence)

  const muted = inverted ? "opacity-70" : "text-muted-foreground"
  const price = formatPrice(priceInPence)

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {onSale && original && (
        <div className="flex items-center gap-2">
          <span className={cn("text-sm line-through decoration-2", muted)} aria-hidden="true">
            {original}
          </span>
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
            {discountPercent(plan)}% off
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-1">
        {prefix && <span className={cn("text-sm", muted)}>{prefix}</span>}
        <span className={cn("font-bold", size === "lg" ? "text-4xl" : "text-3xl")}>
          <span className="sr-only">
            {onSale && original ? `Sale price ${price}, was ${original}` : price}
          </span>
          <span aria-hidden="true">{price}</span>
        </span>
        <span className={cn("text-sm", muted)}>/{shown}</span>
      </div>
    </div>
  )
}
