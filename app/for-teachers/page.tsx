import {
  ClipboardCheck,
  Library,
  ListChecks,
  MessageSquare,
  Play,
  ShieldCheck,
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
  StepList,
  type Faq,
  type Feature,
} from "@/components/marketing/marketing-ui"
import { PageStructuredData } from "@/components/structured-data"
import { marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = "/for-teachers"

export const metadata = marketingMetadata(PATH)

const steps = [
  {
    title: "Create a class",
    desc: "One click gives you a class with its own join code. No importing spreadsheets, no setting up individual student accounts first.",
  },
  {
    title: "Share the join code",
    desc: "Read the code out, put it on the board, and students are in. Their files start appearing in your dashboard as they work.",
  },
  {
    title: "Set tasks, then mark them",
    desc: "Assign work to the class, open any submission, run it yourself and leave feedback — all without changing screens.",
  },
]

const features: Feature[] = [
  {
    icon: Users,
    accent: "var(--primary)",
    title: "Classes without the admin",
    desc: "A class is a name and a join code. There are no invitations to chase, no logins to issue and nothing to rebuild when the timetable changes.",
  },
  {
    icon: Play,
    accent: "var(--chart-2)",
    title: "Run any student's code",
    desc: "Open a submission and run it exactly as the student did — Python in the console, a web page in the preview — so you mark what actually happens.",
  },
  {
    icon: Wand2,
    accent: "var(--primary)",
    title: "AI task generation",
    desc: "Describe a topic, year group and learning objective and get a task draft in seconds. Edit anything you like before it reaches the class.",
  },
  {
    icon: ClipboardCheck,
    accent: "var(--chart-3)",
    title: "Marking in one place",
    desc: "See who has submitted, who has not, and what changed since you last looked, without opening a shared drive or a separate gradebook.",
  },
  {
    icon: MessageSquare,
    accent: "var(--chart-4)",
    title: "Feedback next to the code",
    desc: "Written feedback sits with the file it refers to, so a student rereading it later still has the context that prompted the comment.",
  },
  {
    icon: ListChecks,
    accent: "var(--chart-1)",
    title: "Lesson starter quizzes",
    desc: "Short mixed-format starters pitched at UK secondary computing, ready to run as a warm-up while the class settles.",
  },
  {
    icon: Library,
    accent: "var(--chart-2)",
    title: "Reuse what worked",
    desc: "Keep good tasks and starters in a library and set them again next year instead of rewriting them from memory.",
  },
  {
    icon: ShieldCheck,
    accent: "var(--chart-3)",
    title: "AI help under your control",
    desc: "Switch AI help off for an assessment and back on for a practice lesson. The setting belongs to the class, not to the platform.",
  },
]

const faqs: Faq[] = [
  {
    q: "Is there a free plan for teachers?",
    a: "Yes. The free plan gives you 1 class with up to 25 students, which is enough to run a real group. Teacher Pro adds more classes and gives every student you teach Pro access, free.",
  },
  {
    q: "Do my students need school email addresses?",
    a: "They need an account and your join code. There is no directory sync to arrange and no per-pupil invitation list to maintain.",
  },
  {
    q: "What do I have to install on school machines?",
    a: "Nothing. Both editors run in the browser, so there is no software request, no admin approval and no version to keep updated across a suite of machines.",
  },
  {
    q: "Can I see a student's work as they do it?",
    a: "Files save as students type, so your dashboard reflects their current work rather than a snapshot from whenever they last remembered to submit.",
  },
  {
    q: "Can I stop students using AI help during an assessment?",
    a: "Yes. AI help is a per-class setting you control, so you can turn it off for a test and turn it back on for practice.",
  },
  {
    q: "Does it cover both Python and web development?",
    a: "Yes. You can set Python tasks and HTML, CSS and JavaScript tasks from the same class, and mark both from the same dashboard.",
  },
]

export default async function ForTeachersPage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} />

      <PageHero
        eyebrow="For Teachers"
        title="A coding workspace built for teaching"
        lede={
          <>
            Create classes, set coding tasks and track progress from one dashboard. Run and mark
            every student&apos;s Python or web page without installing a thing.
          </>
        }
        bullets={["One join code per class", "Run and mark in place", "Free plan for one class"]}
        primary={{ href: "/sign-up", label: "Set up your first class" }}
        secondary={{ href: "/features", label: "See all features" }}
      />

      <Section title="From empty class to marked work">
        <StepList steps={steps} />
      </Section>

      <Section
        title="What you get as a teacher"
        lede="The jobs that eat a free period — chasing submissions, running code to see why it failed, writing the same task again — handled in one place."
        muted
      >
        <FeatureGrid features={features} />
      </Section>

      <FaqSection faqs={faqs} title="Teacher FAQs" />

      <RelatedPages paths={["/for-schools", "/features", "/pricing"]} />

      <FinalCta
        title="Try it with one class"
        desc="The free plan covers a class of up to 25 students, so you can run a real lesson before deciding anything."
      />
    </MarketingShell>
  )
}
