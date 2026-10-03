import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${SITE.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/pricing`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/sign-up`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/sign-in`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ]
}
