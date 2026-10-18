import type { ReactNode } from "react"
import Link from "next/link"

import { Logo, LogoWordmark } from "@/components/logo"
import { buttonVariants } from "@/components/ui/button"
import { IDE_ROUTES, marketingRoute, routesInGroup } from "@/lib/seo/marketing"

/**
 * Header and footer for the public marketing pages.
 *
 * Deliberately server-rendered and free of scroll state: these are the pages
 * search engines read, so every link and every word is in the first HTML
 * response rather than appearing after hydration.
 */

const HEADER_LINKS = [
  marketingRoute(IDE_ROUTES.python),
  marketingRoute(IDE_ROUTES.html),
  marketingRoute("/features"),
  marketingRoute("/pricing"),
]

function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" aria-label="MyCodePad home">
          <Logo iconClassName="h-9 w-9" textClassName="text-lg" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 text-sm lg:flex">
          {HEADER_LINKS.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants({})}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{heading}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The same footer on every public page.
 *
 * This is the site's main internal-linking surface: it is what tells a crawler
 * that the IDE and audience pages are top-level destinations rather than
 * orphans, which is the groundwork for sitelinks under the homepage result.
 */
export function MarketingFooter() {
  const ides = routesInGroup("ide")
  const audiences = routesInGroup("audience")

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo iconClassName="h-8 w-8" textClassName="text-base" />
            <p className="mt-3 text-pretty text-sm text-muted-foreground">
              A free online coding platform with multiple IDEs. Write, run and practise Python,
              HTML and more without leaving the browser.
            </p>
          </div>

          <FooterColumn
            heading="Coding editors"
            links={[
              ...ides.map((route) => ({ label: route.label, href: route.path })),
              { label: "Features", href: "/features" },
            ]}
          />
          <FooterColumn
            heading="Who it's for"
            links={audiences.map((route) => ({ label: route.label, href: route.path }))}
          />
          <FooterColumn
            heading="Get started"
            links={[
              { label: "Pricing", href: "/pricing" },
              { label: "Create account", href: "/sign-up" },
              { label: "Sign in", href: "/sign-in" },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} <LogoWordmark className="text-sm" />. All rights reserved.
          </span>
          <span>Made for classrooms in the UK and beyond.</span>
        </div>
      </div>
    </footer>
  )
}

export function MarketingShell({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
