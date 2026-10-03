import { PLANS } from "@/lib/plans"
import { SITE } from "@/lib/site"

function buildStructuredData() {
  const offers = [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
    },
    ...Object.values(PLANS).map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.blurb,
      price: (plan.priceInPence / 100).toFixed(2),
      priceCurrency: "GBP",
      url: `${SITE.url}/pricing`,
    })),
  ]

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/icon.svg`,
        slogan: SITE.tagline,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        name: SITE.name,
        url: SITE.url,
        inLanguage: "en-GB",
        publisher: { "@id": `${SITE.url}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web browser",
        audience: { "@type": "EducationalAudience", educationalRole: ["student", "teacher"] },
        publisher: { "@id": `${SITE.url}/#organization` },
        offers,
      },
    ],
  }
}

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped for "<" so it can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData()).replace(/</g, "\\u003c") }}
    />
  )
}
