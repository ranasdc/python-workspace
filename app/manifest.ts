import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Matches the implicit id of the previous manifest so existing installs carry over.
    id: "/",
    name: "MyCodePad",
    short_name: "MyCodePad",
    description: SITE.tagline,
    // /dashboard routes each role to its workspace, or to sign-in when signed out.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: SITE.themeColor,
    theme_color: SITE.themeColor,
    lang: "en-GB",
    dir: "ltr",
    categories: ["education", "productivity", "developer"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/pwa-icon/192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/pwa-icon/512", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/pwa-icon/maskable-512", type: "image/png", sizes: "512x512", purpose: "maskable" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  }
}
