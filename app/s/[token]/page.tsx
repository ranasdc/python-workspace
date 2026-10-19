import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Globe } from "lucide-react"

import { PublicShareView } from "@/components/ide/public-share-view"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { getLanguage } from "@/lib/ide/languages"
import { loadPublicShare } from "@/lib/shares"
import { SITE } from "@/lib/site"

/**
 * The public face of a share link.
 *
 * Deliberately has no session check of any kind: the token in the path is the
 * credential, and anyone holding it is meant to get in. What keeps that safe is
 * on the other side — `loadPublicShare` reads only the file's name and content,
 * never its owner, and never a teacher's attached task or model solution.
 *
 * Rendered dynamically rather than cached: a revoked link has to stop working
 * immediately, and a stale cached copy would keep serving withdrawn work.
 */
export const dynamic = "force-dynamic"

// Metadata and the page both need the share, and a DB read is not deduped the
// way `fetch` is, so the two passes share one lookup.
const getShare = cache(loadPublicShare)

type PageProps = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const share = await getShare(token)

  // Unlisted, not advertised: the link works for anyone it is given to, but it
  // has no business turning up in a search result for a pupil's name or a
  // school's. Reinforced by the Disallow in app/robots.ts.
  const robots = { index: false, follow: false }

  if (!share) return { title: `Link not found · ${SITE.name}`, robots }

  return {
    title: `${share.fileName} · Shared on ${SITE.name}`,
    description: `A read-only copy of ${share.fileName}, shared from ${SITE.name}.`,
    robots,
  }
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params
  const share = await getShare(token)

  // An unknown token, a revoked one and a since-deleted file all land here. They
  // are not told apart on purpose: distinguishing them would reveal whether a
  // link ever existed.
  if (!share) notFound()

  const language = getLanguage(share.language)
  // Formatted on the server so the markup cannot disagree with the client's
  // locale and break hydration.
  const updated = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(share.updatedAt)

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            aria-label={`${SITE.name} home`}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo iconClassName="h-8 w-8" textClassName="text-base" />
          </Link>
          <Button size="sm" render={<Link href="/" />} nativeButton={false}>
            Try {SITE.name}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {share.fileName}
            </h1>
            <span
              className="rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{ color: language.accent, borderColor: language.accent }}
            >
              {language.label}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Shared publicly — anyone with this link can view it.</span>
            <span aria-hidden="true">·</span>
            <span>Read-only</span>
            <span aria-hidden="true">·</span>
            <span>
              Updated <time dateTime={share.updatedAt.toISOString()}>{updated}</time>
            </span>
          </p>
        </div>

        <PublicShareView
          fileName={share.fileName}
          language={share.language}
          bundle={share.bundle}
        />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-1 px-4 py-5 sm:px-6">
          <p className="text-sm font-medium text-foreground">
            Want to write and run your own code?
          </p>
          <p className="text-sm text-muted-foreground text-pretty">
            {SITE.name} is a free online editor for Python, HTML and more.{" "}
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              Open it here
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  )
}
