import {
  Check,
  Download,
  Eye,
  MessageSquare,
  Smartphone,
  Sparkles,
  Terminal,
} from "lucide-react"

import { MarketingShell } from "@/components/marketing/marketing-chrome"
import {
  FaqSection,
  FeatureGrid,
  FinalCta,
  PageHero,
  RelatedPages,
  Section,
  StepList,
  type Faq,
  type Feature,
} from "@/components/marketing/marketing-ui"
import { PageStructuredData } from "@/components/structured-data"
import { IDE_ROUTES, marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = "/for-students"

export const metadata = marketingMetadata(PATH)

const steps = [
  {
    title: "Create a free account",
    desc: "Sign up with an email address and the workspace opens straight away. There is nothing to download and no card to enter.",
  },
  {
    title: "Join your class, or work solo",
    desc: "Got a join code from your teacher? Enter it once and your work appears in their dashboard. Learning on your own is fine too — no class needed.",
  },
  {
    title: "Pick an editor and press Run",
    desc: "Choose the Python IDE or the HTML editor, write some code and run it. Output appears underneath, and your file saves itself as you type.",
  },
]

const features: Feature[] = [
  {
    icon: Terminal,
    accent: "var(--chart-1)",
    title: "Run Python in the browser",
    desc: "Write Python, press Run and read the output in an interactive console. Programs that use input() prompt you there and wait for your answer.",
  },
  {
    icon: Eye,
    accent: "var(--chart-4)",
    title: "Build and preview web pages",
    desc: "Write HTML, CSS and JavaScript and watch the page render live beside your code, so you can see the effect of a change immediately.",
  },
  {
    icon: Check,
    accent: "var(--chart-2)",
    title: "Your work saves itself",
    desc: "Every keystroke is saved to your account. Start something in a lesson, carry on at home, and pick up exactly where you stopped.",
  },
  {
    icon: Sparkles,
    accent: "var(--primary)",
    title: "Help when you are stuck",
    desc: "When Python throws an error you can ask what it means in plain English. It explains the message and points at the line instead of writing the fix for you.",
  },
  {
    icon: MessageSquare,
    accent: "var(--chart-3)",
    title: "Feedback where you wrote the code",
    desc: "If you are in a class, your teacher's comments appear next to the file they are about, so the advice makes sense when you read it back.",
  },
  {
    icon: Smartphone,
    accent: "var(--chart-2)",
    title: "Any device with a browser",
    desc: "School Chromebook, home laptop or a tablet on the bus — the same workspace and the same files open everywhere you sign in.",
  },
]

const faqs: Faq[] = [
  {
    q: "Is MyCodePad free for students?",
    a: "Yes. The free plan gives you 1 folder and 2 files in each IDE, which is enough to learn and practise with. Student Pro removes the limit, and if your teacher or school is on a plan you get Pro access at no personal cost.",
  },
  {
    q: "Do I need to install Python or a code editor?",
    a: "No. Both the Python IDE and the HTML editor run inside your browser, so there is nothing to install — handy when the school device will not let you install anything anyway.",
  },
  {
    q: "Can I use it without a class code?",
    a: "Yes. You can create an account and start coding on your own. A join code only matters if your teacher wants your work to appear in their class dashboard.",
  },
  {
    q: "Will I lose my work if the tab closes?",
    a: "No. Files save to your account as you type rather than when you remember to press save, so a closed tab or a flat battery does not cost you the lesson.",
  },
  {
    q: "Can my teacher see everything I write?",
    a: "Teachers can see the work of students in the classes they run. If you are coding on your own without joining a class, your files are simply yours.",
  },
  {
    q: "Can I install it like a normal app?",
    a: "Yes. From a supported browser you can install MyCodePad to your desktop or home screen so it opens in its own window.",
  },
]

export default async function ForStudentsPage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} />

      <PageHero
        eyebrow="For Students"
        title="A free online coding workspace for students"
        lede={
          <>
            Write and run real code in your browser, keep every project in one place, and join your
            class with a single code. Python and HTML today, more editors on the way.
          </>
        }
        bullets={["Free to start", "Nothing to install", "Works on school devices"]}
        primary={{ href: "/sign-up", label: "Create a free account" }}
        secondary={{ href: IDE_ROUTES.python, label: "See the Python IDE" }}
      />

      <Section title="Getting started takes about a minute">
        <StepList steps={steps} />
      </Section>

      <Section
        title="What you get"
        lede="A workspace built for learning to code, rather than a professional tool with the hard parts left in."
        muted
      >
        <FeatureGrid features={features} />
      </Section>

      <FaqSection faqs={faqs} title="Student FAQs" />

      <RelatedPages paths={[IDE_ROUTES.python, IDE_ROUTES.html, "/pricing"]} />

      <FinalCta
        title="Start coding today"
        desc="Create a free account and write your first line of Python or HTML in the next few minutes."
      />
    </MarketingShell>
  )
}
