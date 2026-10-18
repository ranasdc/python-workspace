import {
  Check,
  ClipboardCheck,
  Code2,
  Download,
  Eye,
  FolderTree,
  Library,
  ListChecks,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Wand2,
} from "lucide-react"

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

const PATH = "/features"

export const metadata = marketingMetadata(PATH)

const editors: Feature[] = [
  {
    icon: Terminal,
    accent: "var(--chart-1)",
    title: "Online Python IDE",
    desc: "Write Python and run it in the browser, with everything you print appearing in an interactive console underneath — input() included.",
  },
  {
    icon: Eye,
    accent: "var(--chart-4)",
    title: "Online HTML editor",
    desc: "Build pages from .html, .css and .js files and watch them render live in a preview pane beside the code, with no build step.",
  },
  {
    icon: Play,
    accent: "var(--chart-2)",
    title: "Nothing to install",
    desc: "Both editors run in the browser tab. There is no download, no plugin and no admin approval needed on a managed school device.",
  },
  {
    icon: Check,
    accent: "var(--chart-2)",
    title: "Autosave on every keystroke",
    desc: "Work saves to the account as it is typed, so a closed tab, a flat battery or a change of room never costs a lesson's progress.",
  },
  {
    icon: FolderTree,
    accent: "var(--chart-3)",
    title: "Organised by class, student and file",
    desc: "Work is filed into a clean tree the moment it is written, so you always know who wrote what, in which class, and when it last changed.",
  },
  {
    icon: Code2,
    accent: "var(--primary)",
    title: "More editors on the way",
    desc: "The workspace is built around a registry of editors rather than a single language, so new IDEs arrive without changing how anything else works.",
  },
]

const teaching: Feature[] = [
  {
    icon: Users,
    accent: "var(--primary)",
    title: "Classes and join codes",
    desc: "Create a class, share one code, and students are in. No per-pupil email invitations to chase and no seating plan to rebuild each year.",
  },
  {
    icon: ClipboardCheck,
    accent: "var(--chart-2)",
    title: "Set tasks and mark submissions",
    desc: "Assign work to a class, then open any student's file, run it yourself and mark it from the same dashboard.",
  },
  {
    icon: MessageSquare,
    accent: "var(--chart-3)",
    title: "Written feedback in context",
    desc: "Leave feedback against the file it belongs to, so a student reads the comment next to the code that prompted it.",
  },
  {
    icon: ListChecks,
    accent: "var(--chart-4)",
    title: "Lesson starter quizzes",
    desc: "Short, mixed-format starter quizzes pitched at UK secondary computing, ready to run as a warm-up at the start of a lesson.",
  },
  {
    icon: Library,
    accent: "var(--chart-1)",
    title: "A reusable task library",
    desc: "Keep the tasks and starters that worked, and set them again with another class instead of writing them from scratch.",
  },
  {
    icon: ShieldCheck,
    accent: "var(--chart-2)",
    title: "Controls that stay with the teacher",
    desc: "AI help can be switched on or off per class, so the level of support matches the lesson rather than the platform's defaults.",
  },
]

const assisted: Feature[] = [
  {
    icon: Wand2,
    accent: "var(--primary)",
    title: "AI task generation",
    desc: "Describe a topic, year group and learning objective and get a ready-to-assign task draft in seconds — then edit anything before it reaches students.",
  },
  {
    icon: Sparkles,
    accent: "var(--primary)",
    title: "Plain-English error help",
    desc: "When a student's Python raises an error, they can ask what the message means and where to look. It explains and points, rather than handing over the answer.",
  },
  {
    icon: Download,
    accent: "var(--chart-3)",
    title: "Install it like an app",
    desc: "MyCodePad can be installed to a desktop or home screen from the browser, so it opens in its own window alongside everything else a student uses.",
  },
]

const faqs: Faq[] = [
  {
    q: "Is MyCodePad free to use?",
    a: "Yes, there is a genuinely free plan. Students get 1 folder and 2 files in each IDE, and teachers get 1 class with up to 25 students. Paid plans lift those limits, and school plans give every student and teacher Pro access at no personal cost.",
  },
  {
    q: "Which languages can I write in today?",
    a: "Python, and HTML with CSS and JavaScript. Those are the two editors that ship right now. The workspace is built around a registry of editors so more can be added, but nothing else is available yet.",
  },
  {
    q: "Do students need to install software?",
    a: "No. Both editors run in the browser, so a managed Chromebook, school laptop or home computer with a modern browser is all that is required.",
  },
  {
    q: "How do students join a class?",
    a: "The teacher creates the class and shares a single join code. A student enters that code once and their work appears in the teacher's dashboard from then on.",
  },
  {
    q: "Can teachers turn the AI features off?",
    a: "Yes. AI help is controlled per class, so a teacher can switch it off for an assessment and back on for a practice lesson.",
  },
  {
    q: "Can a school cover everyone on one plan?",
    a: "Yes. School and multi-academy trust plans give every student and teacher in the department Pro access, so nobody is asked to pay individually.",
  },
]

export default async function FeaturesPage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} />

      <PageHero
        eyebrow="Features"
        title="Everything in the MyCodePad coding platform"
        lede={
          <>
            Multiple online IDEs, AI-assisted task setting, starter quizzes, class management,
            marking and feedback — one free coding platform rather than a collection of tools.
          </>
        }
        bullets={["Multiple IDEs", "Built for classrooms", "Free to start"]}
        secondary={{ href: "/pricing", label: "Compare plans" }}
      />

      <Section
        id="editors"
        title="Editors and running code"
        lede="The part students actually touch: a place to write code, a button that runs it, and work that is still there tomorrow."
      >
        <FeatureGrid features={editors} />
      </Section>

      <Section
        id="teaching"
        title="Teaching and class management"
        lede="Everything a teacher needs between setting a task and giving it back, without a spreadsheet or a shared drive in sight."
        muted
      >
        <FeatureGrid features={teaching} />
      </Section>

      <Section
        id="ai"
        title="AI assistance and access"
        lede="Help where it saves real time, under the teacher's control rather than switched on by default."
      >
        <FeatureGrid features={assisted} />
      </Section>

      <FaqSection faqs={faqs} title="Platform FAQs" />

      <RelatedPages
        paths={[IDE_ROUTES.python, IDE_ROUTES.html, "/for-students", "/for-teachers", "/for-schools", "/pricing"]}
        title="Explore MyCodePad"
      />

      <FinalCta
        title="Try the whole workspace"
        desc="Create a free account and open both editors in seconds. No installs, no card required."
      />
    </MarketingShell>
  )
}
