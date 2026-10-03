import { cn } from "@/lib/utils"
import { discountPercent, formatPrice, isOnSale, type Plan } from "@/lib/plans"

export function PriceTag({
  plan,
  size = "lg",
  prefix,
  inverted = false,
  className,
}: {
  plan: Plan
  size?: "md" | "lg"
  /** Leading word such as "from". */
  prefix?: string
  /** For use on dark-on-light cards where muted text should follow the card's foreground. */
  inverted?: boolean
  className?: string
}) {
  const onSale = isOnSale(plan)
  const muted = inverted ? "opacity-70" : "text-muted-foreground"
  const sale = formatPrice(plan.priceInPence)
  const original = formatPrice(plan.originalPriceInPence)

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {onSale && (
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
          <span className="sr-only">{onSale ? `Sale price ${sale}, was ${original}` : sale}</span>
          <span aria-hidden="true">{sale}</span>
        </span>
        <span className={cn("text-sm", muted)}>/{plan.interval}</span>
      </div>
    </div>
  )
}
