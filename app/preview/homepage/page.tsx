import type { Metadata } from "next"
import { LandingPagePreview } from "@/components/landing-page-preview"

export const metadata: Metadata = {
  title: "Homepage preview",
  robots: { index: false, follow: false },
}

export default function HomepagePreviewPage() {
  return <LandingPagePreview />
}
