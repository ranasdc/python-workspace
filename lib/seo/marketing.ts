import type { Metadata, MetadataRoute } from "next"

import { SITE } from "@/lib/site"
import type { LanguageId } from "@/lib/ide/languages"

/**
 * Every public, indexable page on the site, described once.
 *
 * The sitemap, the marketing nav, the footer, the breadcrumb schema and each
 * page's own <title> are all generated from this table. A new IDE or landing
 * page is therefore added by appending one entry, rather than by editing five
 * files that then drift apart. Anything missing from this table is either
 * private — and blocked in robots.ts — or a utility route that should not rank.
 */
export type MarketingGroup = "ide" | "audience" | "platform" | "legal"

export type MarketingRoute = {
  path: string
  /**
   * The full <title>. Absolute rather than templated, because each one already
   * names the brand in the position that reads best for that page.
   */
  title: string
  /** Meta description. Kept under ~160 characters so Google shows all of it. */
  description: string
  /** Short label for navigation, footer columns and breadcrumbs. */
  label: string
  group: MarketingGroup
  priority: number
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>
}

/**
 * Where each IDE's marketing page lives.
 *
 * Typed as a total map over LanguageId so that adding a third IDE to the
 * language registry fails to compile until it has been given a page here. That
 * is deliberate: the one thing that must not happen as IDEs are added is a
 * homepage that advertises an editor with nowhere to send the search traffic.
 */
export const IDE_ROUTES: Record<LanguageId, string> = {
  python: "/python-ide",
  html: "/html-editor",
}

export const MARKETING_ROUTES: MarketingRoute[] = [
  {
    path: "/",
    title: SITE.title,
    description: SITE.description,
    label: "Home",
    group: "platform",
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    path: IDE_ROUTES.python,
    title: "Free Online Python IDE | MyCodePad",
    description:
      "Write, run and share Python code online for free. MyCodePad's Python IDE runs in your browser with an interactive console — no installation required.",
    label: "Online Python IDE",
    group: "ide",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: IDE_ROUTES.html,
    title: "Free Online HTML Editor | MyCodePad",
    description:
      "Create and preview HTML, CSS and JavaScript online for free. MyCodePad's HTML editor renders your page live as you type, with no setup and no build step.",
    label: "Online HTML Editor",
    group: "ide",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/features",
    title: "Online Coding Platform Features | MyCodePad",
    description:
      "Explore MyCodePad: multiple online IDEs, AI-assisted tasks, starter quizzes, class management, marking and feedback — all in one free coding platform.",
    label: "Features",
    group: "platform",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/for-students",
    title: "Free Online Coding Workspace for Students | MyCodePad",
    description:
      "A free online coding workspace for students. Write and run Python and HTML in your browser, join a class with one code, and keep every file autosaved.",
    label: "For Students",
    group: "audience",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/for-teachers",
    title: "Coding Workspace for Teachers | MyCodePad",
    description:
      "Create classes, set coding tasks and track student progress. MyCodePad gives teachers one dashboard to run, mark and give feedback on every student's code.",
    label: "For Teachers",
    group: "audience",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/for-schools",
    title: "Coding Platform for Schools | MyCodePad",
    description:
      "A safe, easy-to-manage online coding platform for schools. Give every student and teacher a browser-based Python and HTML workspace on one school plan.",
    label: "For Schools",
    group: "audience",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/pricing",
    title: "MyCodePad Plans & Pricing",
    description:
      "Compare MyCodePad plans: a free tier with both online IDEs, Student Pro, Teacher Pro and school plans that give every student and teacher Pro access.",
    label: "Pricing",
    group: "platform",
    priority: 0.9,
    changeFrequency: "weekly",
  },
  // The legal documents. Public and indexable on purpose: a school evaluating
  // the platform has to be able to read them before anyone signs anything, and
  // a signed-out visitor must reach them without an account.
  {
    path: "/privacy",
    title: "Privacy Policy | MyCodePad",
    description:
      "How MyCodePad collects, uses, shares and protects personal data for students, teachers and schools, and how to exercise your rights under UK data protection law.",
    label: "Privacy Policy",
    group: "legal",
    priority: 0.4,
    changeFrequency: "yearly",
  },
  {
    path: "/terms",
    title: "Terms of Service | MyCodePad",
    description:
      "The terms on which students, teachers, tutors and schools may use MyCodePad, including accounts, acceptable use, content ownership, subscriptions and cancellation.",
    label: "Terms of Service",
    group: "legal",
    priority: 0.4,
    changeFrequency: "yearly",
  },
  {
    path: "/data-processing-agreement",
    title: "School Data Processing Agreement | MyCodePad",
    description:
      "Draft Article 28 processor terms for schools using MyCodePad, covering processing instructions, security, subprocessors, breach notification, audits and deletion.",
    label: "School DPA",
    group: "legal",
    priority: 0.4,
    changeFrequency: "yearly",
  },
]

const BY_PATH = new Map(MARKETING_ROUTES.map((route) => [route.path, route]))

export function marketingRoute(path: string): MarketingRoute {
  const route = BY_PATH.get(path)
  // Thrown at build time rather than returning a default, so a typo in a page
  // file surfaces as a failed build instead of a page that silently inherits
  // the homepage's title and canonical URL.
  if (!route) throw new Error(`No marketing route registered for "${path}"`)
  return route
}

/**
 * The Next metadata for a registered page: title, description, canonical URL
 * and matching social cards, derived from the one entry above.
 */
export function marketingMetadata(path: string): Metadata {
  const { title, description } = marketingRoute(path)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_GB",
      url: path,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  }
}

export const routesInGroup = (group: MarketingGroup) =>
  MARKETING_ROUTES.filter((route) => route.group === group && route.path !== "/")

/** The IDE pages, in the order the language registry lists its editors. */
export const ideRoutes = () => routesInGroup("ide")
