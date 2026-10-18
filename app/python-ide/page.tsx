import { Check, FolderTree, GraduationCap, Play, Sparkles, Terminal, X } from "lucide-react"

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

const PATH = IDE_ROUTES.python
const PYTHON = "var(--chart-1)"

export const metadata = marketingMetadata(PATH)

const features: Feature[] = [
  {
    icon: Play,
    accent: PYTHON,
    title: "Run Python in the browser",
    desc: "Press Run and your code executes in the browser tab itself. There is no queue, no container to wake up and no setup step between writing a line and seeing what it does.",
  },
  {
    icon: Terminal,
    accent: PYTHON,
    title: "An interactive console",
    desc: "Anything you print appears in a console under the editor, and input() prompts you there too — so programs that ask the user a question behave exactly as they should.",
  },
  {
    icon: Check,
    accent: "var(--chart-2)",
    title: "Autosave on every keystroke",
    desc: "Your file saves to your account as you type. Close the tab, open it on another device and the code is where you left it.",
  },
  {
    icon: FolderTree,
    accent: "var(--chart-3)",
    title: "Real files and folders",
    desc: "Name your files, group them into folders and keep a project together, instead of losing everything in one scratch buffer.",
  },
  {
    icon: Sparkles,
    accent: "var(--primary)",
    title: "Plain-English error help",
    desc: "When Python raises an error, ask what it actually means and where to look. It explains the message and points at the line rather than handing over the finished answer.",
  },
  {
    icon: GraduationCap,
    accent: "var(--chart-4)",
    title: "Works as classwork",
    desc: "Teachers can set Python tasks, open your file, run it themselves and leave written feedback in the same place you wrote the code.",
  },
]

const faqs: Faq[] = [
  {
    q: "Is the online Python IDE free?",
    a: "Yes. The Python IDE is part of the free plan, which gives you 1 folder and 2 files in each IDE. Student Pro lifts that to unlimited files and folders, and students in a class covered by a teacher or school plan get Pro at no personal cost.",
  },
  {
    q: "Do I need to install Python?",
    a: "No. Python runs inside your browser tab, so there is nothing to download, install or keep up to date. A modern browser is the only requirement.",
  },
  {
    q: "Can I install packages like NumPy or pandas?",
    a: "Not currently. Code runs against the Python language and its standard library, with no third-party package installs and no network access from your program. That keeps the IDE instant to start and safe on managed school devices.",
  },
  {
    q: "Does input() work in the console?",
    a: "Yes. Calling input() pauses your program and prompts you in the console beneath the editor, so interactive programs run normally rather than erroring out.",
  },
  {
    q: "Will it run on a school Chromebook or tablet?",
    a: "Yes. Everything happens in the browser, so any managed Chromebook, laptop or tablet with a modern browser can open the IDE. No administrator install and no plugins are needed.",
  },
  {
    q: "Can teachers set and mark Python tasks?",
    a: "Yes. A teacher creates a class, shares a join code and sets tasks, then runs and marks each student's Python file from a single dashboard. AI error help can be switched on or off per class.",
  },
]

const included = [
  "The Python language and its standard library",
  "An interactive console, including input()",
  "Named files and folders that autosave",
  "Error explanations in plain English",
]

const notIncluded = [
  "Third-party packages installed with pip",
  "Network requests from your program",
  "Reading or writing files on your computer",
]

export default async function PythonIdePage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} softwareName="MyCodePad Online Python IDE" />

      <PageHero
        eyebrow="Online Python IDE"
        title="Free online Python IDE"
        lede={
          <>
            Write, run and share Python code online for free. Your program runs in the browser, so
            there is nothing to install and nothing to configure — open a file and press Run.
          </>
        }
        bullets={["No installation", "Interactive console", "Autosaves as you type"]}
        primary={{ href: "/sign-up", label: "Start coding in Python" }}
        secondary={{ href: "/features", label: "See all features" }}
      />

      <Section
        title="What you can do in the Python IDE"
        lede="One of several editors in the MyCodePad workspace, built so that writing Python is the only thing you have to think about."
      >
        <FeatureGrid features={features} />
      </Section>

      <Section
        title="What runs here, and what doesn't"
        lede="Python executes in your browser rather than on a server. That is what makes it instant and safe to use on school devices — and it does come with limits worth knowing up front."
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

      <FaqSection faqs={faqs} title="Online Python IDE FAQs" />

      <RelatedPages paths={[IDE_ROUTES.html, "/features", "/for-students"]} />

      <FinalCta
        title="Write your first line of Python"
        desc="Create a free account and the editor opens in seconds. No installs, no setup."
      />
    </MarketingShell>
  )
}
