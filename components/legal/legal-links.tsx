import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import { LEGAL_LINKS } from "@/lib/legal"
import { cn } from "@/lib/utils"

/**
 * Routes into the legal documents from inside the signed-in app.
 *
 * The public footer carries them for visitors, but somebody already signed in
 * never sees that footer — and the account, billing and school pages are
 * exactly where a user goes looking for them. Both components work signed out
 * as well, because the documents themselves are public.
 */

export function LegalLinkRow({
  label,
  only,
  className,
}: {
  /** Optional lead-in, e.g. "Your data:". */
  label?: string
  /** Narrow the row to specific documents. Defaults to all three. */
  only?: string[]
  className?: string
}) {
  const links = only ? LEGAL_LINKS.filter((link) => only.includes(link.href)) : LEGAL_LINKS

  return (
    <nav
      aria-label="Legal information"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      {label && <span>{label}</span>}
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * A short notice at the point where data is actually collected.
 *
 * Deliberately not a consent checkbox. Nothing on this platform relies on
 * consent as its lawful basis, and a tick box that does not record a decision
 * is worse than no tick box: it implies a choice the user never had.
 */
export function PrivacyNotice({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground",
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-pretty">{children}</span>
    </p>
  )
}
