import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

// "/s" holds public share links. They are openable by anyone who has the link,
// but unlisted on purpose: a pupil sharing homework with a friend has not asked
// for it to be indexed against their name. The pages also send `noindex`, which
// is the half that actually binds a crawler that ignores this file.
const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/account",
  "/billing",
  "/school",
  "/student",
  "/teacher",
  "/s/",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
