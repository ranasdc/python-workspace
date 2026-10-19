import Link from "next/link"
import { Unlink } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { SITE } from "@/lib/site"

/**
 * Shown for a token that is unknown, has been revoked, or whose file has since
 * been deleted. The three are deliberately indistinguishable: saying "this link
 * was turned off" would confirm that a particular link once existed.
 */
export default function ShareNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <Logo iconClassName="h-10 w-10" textClassName="text-lg" />

      <div className="flex max-w-md flex-col items-center gap-2">
        <Unlink className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
          This link isn&apos;t available
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          The link may have been turned off by whoever shared it, or the file may have been
          deleted. Ask them for a new one.
        </p>
      </div>

      <Button render={<Link href="/" />} nativeButton={false}>
        Go to {SITE.name}
      </Button>
    </div>
  )
}
