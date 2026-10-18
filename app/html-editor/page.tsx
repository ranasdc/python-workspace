import { Braces, Check, Eye, FileCode2, FolderTree, GraduationCap, X } from "lucide-react"

import { MarketingShell } from "@/components/marketing/marketing-chrome"
import {
  FaqSection,
  FeatureGrid,
  FinalCta,
  PageHero,
  RelatedPages,
  Section,
  type Faq,
  type Feature,
} from "@/components/marketing/marketing-ui"
import { PageStructuredData } from "@/components/structured-data"
import { IDE_ROUTES, marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = IDE_ROUTES.html
const HTML_ACCENT = "var(--chart-4)"

export const metadata = marketingMetadata(PATH)

const features: Feature[] = [
  {
    icon: Eye,
    accent: HTML_ACCENT,
    title: "Live preview as you type",
    desc: "Your page renders in a preview pane beside the editor. Change a heading or a colour and the result appears straight away — there is no build step to wait for.",
  },
  {
    icon: FileCode2,
    accent: HTML_ACCENT,
    title: "HTML, CSS and JavaScript",
    desc: "Work in .html, .css and .js files the way you would in a real project, rather than in one giant file with everything crammed together.",
  },
  {
    icon: Braces,
    accent: "var(--chart-2)",
    title: "Linked stylesheets and scripts",
    desc: "A stylesheet or script sitting next to your page loads exactly as it would on the web, so learning how files link together is part of the lesson.",
  },
  {
    icon: Check,
    accent: "var(--chart-2)",
    title: "Autosave on every keystroke",
    desc: "Every change is saved to your account as you make it. Pick the project back up on a different device and nothing is missing.",
  },
  {
    icon: FolderTree,
    accent: "var(--chart-3)",
    title: "Projects, not snippets",
    desc: "Group a page with its styles and scripts in a folder so a multi-file site stays organised from the first lesson onwards.",
  },
  {
    icon: GraduationCap,
    accent: "var(--primary)",
    title: "Works as classwork",
    desc: "Teachers can set web tasks, open the finished page, preview it themselves and leave written feedback next to the markup.",
  },
]

const faqs: Faq[] = [
  {
    q: "Is the online HTML editor free?",
    a: "Yes. The HTML editor is included in the free plan, which gives you 1 folder and 2 files in each IDE. Student Pro removes that limit, and students covered by a teacher or school plan get Pro at no personal cost.",
  },
  {
    q: "Can I write CSS and JavaScript too?",
    a: "Yes. The HTML editor accepts .html, .css and .js files. Link a stylesheet or a script from your page and it loads from the sibling file in the same folder, just as it would on a real website.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. The editor and the preview both run in your browser, so there is nothing to download and no local web server to start. Open the page and begin typing.",
  },
  {
    q: "Can I use a framework or a CDN link?",
    a: "Not currently. Pages render without network access, so external CDN links, frameworks and remote fonts will not load. Everything your page uses needs to live in your own files.",
  },
  {
    q: "Can I see my page on a phone-sized screen?",
    a: "You can open MyCodePad on a phone or tablet browser and edit there directly. The preview pane itself renders your page at the size of the pane, so responsive CSS behaves as you would expect as the layout narrows.",
  },
  {
    q: "Is it suitable for teaching web development?",
    a: "Yes. Teachers set web tasks, students build the page in class, and the teacher previews and marks the result from one dashboard — with no installs on school machines.",
  },
]

const included = [
  "HTML, CSS and JavaScript files",
  "A live preview that updates as you type",
  "Stylesheets and scripts linked from sibling files",
  "Named folders so a project stays together",
]

const notIncluded = [
  "CDN links, remote fonts and external frameworks",
  "Build tools such as bundlers or preprocessors",
  "Server-side code or a database",
]

export default async function HtmlEditorPage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} softwareName="MyCodePad Online HTML Editor" />

      <PageHero
        eyebrow="Online HTML Editor"
        title="Free online HTML editor"
        lede={
          <>
            Create and preview web pages online for free. Edit HTML, CSS and JavaScript, watch the
            page render live beside your code, and keep every file saved to your account.
          </>
        }
        bullets={["Live preview", "HTML, CSS & JS files", "No build step"]}
        primary={{ href: "/sign-up", label: "Start building a page" }}
        secondary={{ href: "/features", label: "See all features" }}
      />

      <Section
        title="What you can do in the HTML editor"
        lede="One of several editors in the MyCodePad workspace, set up so a page, its styles and its scripts behave the way they do on the real web."
      >
        <FeatureGrid features={features} />
      </Section>

      <Section
        title="What renders here, and what doesn't"
        lede="Pages are rendered locally in your browser rather than published to a server. That makes the preview instant and safe on managed school devices, with a few limits worth knowing up front."
        muted
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/60 p-6">
            <h3 className="text-base font-semibold">Included</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-chart-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-6">
            <h3 className="text-base font-semibold">Not available</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {notIncluded.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <FaqSection faqs={faqs} title="Online HTML editor FAQs" />

      <RelatedPages paths={[IDE_ROUTES.python, "/features", "/for-teachers"]} />

      <FinalCta
        title="Build your first page"
        desc="Create a free account and the editor and preview open together in seconds."
      />
    </MarketingShell>
  )
}
