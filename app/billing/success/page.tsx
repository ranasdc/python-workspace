import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2, AlertCircle } from "lucide-react"

import { getSessionUser } from "@/lib/session"
import { reconcileCheckoutSession } from "@/app/actions/billing"
import { buttonVariants } from "@/components/ui/button"

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")

  const { session_id: sessionId } = await searchParams

  let ok = false
  let message = "We couldn't find that checkout session."

  if (sessionId) {
    try {
      // Reads the result straight from Stripe and writes the entitlement, so
      // access is granted immediately rather than waiting on webhook delivery.
      const result = await reconcileCheckoutSession(sessionId)
      ok = result.ok
      if (!ok) message = "Your payment is still processing. Check back in a moment."
    } catch (error) {
      message = error instanceof Error ? error.message : "Something went wrong."
    }
  }

  const home = sessionUser.role === "teacher" ? "/teacher" : "/student"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {ok ? (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            Your subscription is active. Unlimited files and folders are unlocked.
          </p>
        </>
      ) : (
        <>
          <AlertCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Not quite done</h1>
          <p className="mt-2 text-pretty text-muted-foreground">{message}</p>
        </>
      )}

      <Link href={home} className={buttonVariants({ size: "lg", className: "mt-8" })}>
        Back to your workspace
      </Link>
    </main>
  )
}
