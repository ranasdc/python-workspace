import {
  Building2,
  KeyRound,
  Laptop,
  Lock,
  ShieldCheck,
  Users,
  Wallet,
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

const PATH = "/for-schools"

export const metadata = marketingMetadata(PATH)

const steps = [
  {
    title: "Choose a school plan",
    desc: "Pick the plan that matches a single department, a whole school or a multi-academy trust. Everything is priced per organisation, not per seat negotiation.",
  },
  {
    title: "Share your invite codes",
    desc: "Staff and students join the school with a code. Seats and codes are managed from one school page, so there is no account provisioning project.",
  },
  {
    title: "Everyone gets Pro",
    desc: "Once someone joins the school, their account is covered. No student is asked for a card and no teacher is left on the free tier.",
  },
]

const features: Feature[] = [
  {
    icon: Users,
    accent: "var(--primary)",
    title: "Covers every student and teacher",
    desc: "A school plan lifts the whole department onto Pro at once, so nobody in your classes is blocked by a file limit mid-lesson.",
  },
  {
    icon: Laptop,
    accent: "var(--chart-2)",
    title: "Nothing to deploy",
    desc: "Both editors run in the browser. There is no MSI to package, no Chromebook policy to write and no Python version to maintain across a suite.",
  },
  {
    icon: KeyRound,
    accent: "var(--chart-3)",
    title: "Seats and invite codes in one place",
    desc: "Add staff, see how many seats are in use and reissue a code from a single school page, rather than through a support ticket.",
  },
  {
    icon: ShieldCheck,
    accent: "var(--chart-4)",
    title: "AI help stays a teacher decision",
    desc: "AI assistance is controlled per class by the teacher who runs it, so a department can set its own line between support and assessment.",
  },
  {
    icon: Lock,
    accent: "var(--chart-1)",
    title: "Student work stays behind sign-in",
    desc: "Classes, files and submissions sit behind an account and are visible to the teachers of those classes. Search engines are blocked from every signed-in page.",
  },
  {
    icon: Wallet,
    accent: "var(--chart-2)",
    title: "One predictable invoice",
    desc: "A single plan for the organisation rather than a drift of individual subscriptions appearing on different budget lines.",
  },
]

const faqs: Faq[] = [
  {
    q: "What does a school plan include?",
    a: "Pro access for every student and teacher who joins your school, which means unlimited files and folders in each IDE and the full set of class tools. Plans are sized for a single department, a whole school or a multi-academy trust.",
  },
  {
    q: "How are students and staff added?",
    a: "Through invite codes managed on your school page. A student or teacher joins the school with a code and their account is covered from that point on — there is no directory integration to commission first.",
  },
  {
    q: "Does anything need installing on school devices?",
    a: "No. Python runs in the browser tab and web pages are previewed locally in the browser, so a managed Chromebook or a locked-down desktop needs nothing more than a modern browser.",
  },
  {
    q: "Is student work visible to the public?",
    a: "No. Classes, files and submissions are behind sign-in and are visible to the teachers of the classes a student joins. Every signed-in area is blocked from search engine crawlers.",
  },
  {
    q: "Can a multi-academy trust cover several schools?",
    a: "Yes. The MAT plan exists for trusts running computing across more than one school, rather than buying a separate plan per site.",
  },
  {
    q: "Can we trial it before committing budget?",
    a: "Yes. A teacher can run a full class of up to 25 students on the free plan, so a department can test it with real lessons before any purchase order is raised.",
  },
]

export default async function ForSchoolsPage() {
  const sessionUser = await getSessionUser()

  return (
    <MarketingShell signedIn={Boolean(sessionUser)}>
      <PageStructuredData path={PATH} faqs={faqs} />

      <PageHero
        eyebrow="For Schools"
        title="A coding platform for schools"
        lede={
          <>
            Give every student and teacher in your department a browser-based coding workspace on
            one plan — with no software to deploy and no per-pupil licences to chase.
          </>
        }
        bullets={["Nothing to install", "Pro for everyone who joins", "One invoice"]}
        primary={{ href: "/pricing#school-plans", label: "See school plans" }}
        secondary={{ href: "/features", label: "See all features" }}
      />

      <Section title="How a school gets set up">
        <StepList steps={steps} />
      </Section>

      <Section
        title="Why departments choose it"
        lede="Built around the constraints of a school network: managed devices, mixed hardware, tight budgets and a timetable that does not wait for an install."
        muted
      >
        <FeatureGrid features={features} />
      </Section>

      <FaqSection faqs={faqs} title="School FAQs" />

      <RelatedPages paths={["/for-teachers", "/features", "/pricing"]} />

      <FinalCta
        title="Bring coding to the whole department"
        desc="Compare school and trust plans, or start with one free class to see how it runs in your rooms."
        primary={{ href: "/pricing#school-plans", label: "Compare school plans" }}
        secondary={{ href: "/sign-up", label: "Start with one class" }}
      />
    </MarketingShell>
  )
}
