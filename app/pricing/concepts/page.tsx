import { PricingConcepts } from "@/components/pricing-concepts"

export const metadata = {
  title: "Pricing concepts",
  robots: { index: false, follow: false },
}

export default function PricingConceptsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm font-medium text-primary">Design review</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">
          Making school plans easier to find
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          Six ways to show department buyers that school plans exist. These are mockups only.
          The live pricing page has not changed.
        </p>
      </header>
      <PricingConcepts />
    </main>
  )
}
