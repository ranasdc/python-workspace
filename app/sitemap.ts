import type { MetadataRoute } from "next"

import { MARKETING_ROUTES } from "@/lib/seo/marketing"
import { SITE } from "@/lib/site"

/**
 * Generated from the marketing route registry, so a new public page is listed
 * here the moment it is registered rather than whenever someone remembers.
 *
 * Signed-in areas are deliberately absent: they are blocked in robots.ts and
 * have nothing to offer a search result.
 */
const UTILITY_ROUTES: MetadataRoute.Sitemap[number][] = [
  { url: `${SITE.url}/sign-up`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE.url}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    ...MARKETING_ROUTES.map((route) => ({
      // The homepage keeps its trailing slash; every other path already has one.
      url: route.path === "/" ? `${SITE.url}/` : `${SITE.url}${route.path}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...UTILITY_ROUTES.map((route) => ({ ...route, lastModified })),
  ]
}
