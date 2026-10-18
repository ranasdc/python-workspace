import { PLANS } from "@/lib/plans"
import { SITE } from "@/lib/site"
import { marketingRoute } from "@/lib/seo/marketing"

/**
 * Every claim in this file has to be true of the product as it ships today.
 * Structured data is the one place where an aspirational feature list becomes
 * a machine-readable assertion, so the feature list below is drawn from what
 * the app actually does rather than from what the marketing copy hopes for.
 */
const FEATURE_LIST = [
  "Online Python IDE with an interactive console",
  "Online HTML editor with live preview for HTML, CSS and JavaScript",
  "Autosave on every keystroke",
  "Files organised by class, student and folder",
  "AI-assisted task generation for teachers",
  "AI explanations for code errors",
  "Lesson starter quizzes",
  "Class join codes, marking and written feedback",
]

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped for "<" so it can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}

const ORGANIZATION_ID = `${SITE.url}/#organization`
const WEBSITE_ID = `${SITE.url}/#website`

function buildStructuredData() {
  const offers = [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
      url: `${SITE.url}/pricing`,
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
        "@id": ORGANIZATION_ID,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/icon.svg`,
        slogan: SITE.tagline,
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE.name,
        alternateName: "My Code Pad",
        url: SITE.url,
        description: SITE.description,
        inLanguage: "en-GB",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.longDescription,
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "Online IDE",
        operatingSystem: "Any modern web browser",
        browserRequirements: "Requires JavaScript. No installation or plugins needed.",
        isAccessibleForFree: true,
        featureList: FEATURE_LIST,
        audience: {
          "@type": "EducationalAudience",
          educationalRole: ["student", "teacher"],
        },
        publisher: { "@id": ORGANIZATION_ID },
        offers,
      },
    ],
  }
}

/** Site-wide identity and product schema. Rendered on the homepage only. */
export function StructuredData() {
  return <JsonLd data={buildStructuredData()} />
}

export type Faq = { q: string; a: string }

/**
 * Per-page schema for a registered marketing route: the page itself, its
 * breadcrumb trail back to the homepage, and its FAQ when it has one.
 *
 * Takes a path rather than free text so the name and description can only ever
 * be the ones in the route registry — the same strings used for the <title>
 * and the canonical URL.
 */
export function PageStructuredData({
  path,
  faqs,
  softwareName,
}: {
  path: string
  faqs?: Faq[]
  /** Set on an IDE page to describe that editor as an application in its own right. */
  softwareName?: string
}) {
  const route = marketingRoute(path)
  const url = `${SITE.url}${path}`

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: route.title,
      description: route.description,
      inLanguage: "en-GB",
      isPartOf: { "@id": WEBSITE_ID },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: route.label, item: url },
      ],
    },
  ]

  if (softwareName) {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${url}#app`,
      name: softwareName,
      url,
      description: route.description,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "Online IDE",
      operatingSystem: "Any modern web browser",
      browserRequirements: "Requires JavaScript. No installation or plugins needed.",
      isAccessibleForFree: true,
      publisher: { "@id": ORGANIZATION_ID },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
        url: `${SITE.url}/pricing`,
      },
    })
  }

  if (faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    })
  }

  return <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />
}
