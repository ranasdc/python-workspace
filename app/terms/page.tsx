import {
  Bullets,
  Callout,
  H3,
  InfoTable,
  Lead,
  LegalDocumentPage,
  Numbered,
  P,
  Tbc,
  type LegalSection,
} from "@/components/legal/legal-ui"
import { LEGAL_DOCUMENTS } from "@/lib/legal"
import {
  FREE_ALLOWANCE,
  PLANS,
  SALE,
  formatPrice,
  intervalLabel,
  intervalsFor,
  isOnSale,
  priceFor,
  TEACHER_FREE_LIMITS,
} from "@/lib/plans"
import { marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = "/terms"

export const metadata = marketingMetadata(PATH)

/**
 * The Terms of Service.
 *
 * Prices, intervals and seat allowances are rendered from lib/plans.ts rather
 * than typed out, because that module is what Checkout actually charges from.
 * A price change therefore updates the Terms in the same commit, which is the
 * only way these two can be guaranteed not to contradict each other.
 */

const PLAN_ORDER = [
  PLANS.student_pro,
  PLANS.teacher_pro,
  PLANS.school_small,
  PLANS.school_medium,
  PLANS.school_large,
]

function priceCell(plan: (typeof PLAN_ORDER)[number]) {
  return intervalsFor(plan)
    .map((interval) => `${formatPrice(priceFor(plan, interval) ?? 0)} ${intervalLabel(interval)}`)
    .join(", or ")
}

function seatCell(plan: (typeof PLAN_ORDER)[number]) {
  const parts: string[] = []
  if (plan.teacherSeatLimit) parts.push(`${plan.teacherSeatLimit} teacher seats`)
  if (plan.studentSeatLimit)
    parts.push(`${plan.studentSeatLimit.toLocaleString("en-GB")} student seats`)
  if (parts.length === 0) return "Covers the one account that buys it"
  return parts.join(", ")
}

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are and how to contact us",
    body: (
      <>
        <Lead>
          MyCodePad is operated by <Tbc id="operatorLegalName" />, a <Tbc id="operatorLegalForm" />{" "}
          with company number <Tbc id="companyNumber" />, whose address is{" "}
          <Tbc id="registeredAddress" />.
        </Lead>
        <P>
          For questions about the service or your subscription, contact <Tbc id="supportEmail" />.
          For anything concerning personal data, contact <Tbc id="privacyEmail" />. To report a
          security issue, contact <Tbc id="securityEmail" />.
        </P>
      </>
    ),
  },
  {
    id: "acceptance",
    title: "These terms, and what they are not",
    body: (
      <>
        <Lead>
          By creating an account or using MyCodePad you agree to these terms. If you do not agree
          to them, do not use the service.
        </Lead>
        <P>
          Where a school has a separate written agreement with us, that agreement takes precedence
          over these terms for that school and the accounts it covers.
        </P>
        <Callout title="Accepting these terms is not a consent to data processing">
          These terms are a contract about using the service. They are not, and must not be
          treated as, your consent to any processing of personal data. How we handle personal data
          is set out in the{" "}
          <a href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </a>
          , and where consent is the right lawful basis for something we will ask for it
          separately and specifically.
        </Callout>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and registering an account",
    body: (
      <>
        <Lead>
          Registering requires a name, an email address, a password and a choice of role —
          student or teacher. One person, one account.
        </Lead>
        <P>
          The minimum age to register an individual account yourself is <Tbc id="minimumAge" />.
          Where a school or a teacher provides access to pupils, the school or teacher is
          responsible for ensuring they have whatever authority they need to do so, including any
          parental notification their own policies require.
        </P>
        <P>
          You must give accurate registration details and keep them up to date. The role you pick
          at sign-up is limited to student or teacher; the school administrator role is only ever
          granted by creating a school or being promoted within one, and cannot be requested.
        </P>
        <P>
          Email addresses are not currently verified, so an account can exist against an address
          you do not control. Do not treat an account as proof of identity.
        </P>
      </>
    ),
  },
  {
    id: "responsibilities",
    title: "Responsibilities of students, teachers, tutors and school administrators",
    body: (
      <>
        <Lead>
          Different roles see different things, so they carry different obligations.
        </Lead>
        <H3>Students</H3>
        <Bullets
          items={[
            "Use the platform for your own learning, and do not try to reach anybody else's account, class or work.",
            "Do not share your password, and do not sign in as somebody else.",
            "Remember that publishing a file as a public link makes it readable by anyone who has the link.",
          ]}
        />
        <H3>Teachers and tutors</H3>
        <Bullets
          items={[
            "You can see, mark, comment on and directly edit the work of pupils in your own classes. Use that access for teaching and nothing else.",
            "A correction you make to a pupil's code is recorded against your name, and their previous version is kept.",
            "Class join codes are bearer credentials: anyone holding a live code can join that class. Share them only with the pupils you intend to teach, and deactivate or reissue a code when it has served its purpose.",
            "You are responsible for the content of the tasks and material you create and distribute.",
            "Where you provide access to children, you are responsible for complying with your own school's safeguarding and data protection policies.",
          ]}
        />
        <H3>School administrators</H3>
        <Bullets
          items={[
            "You manage staff and pupil membership, invite codes and seat usage for your school, and you can see the school's classes and members.",
            "You are responsible for issuing invite codes appropriately, and for removing members who should no longer have access.",
            "Removing a member marks their membership as removed. It does not delete their account or their work — see section 17.",
            "Where your school is the controller for pupil data, the School Data Processing Agreement applies to our processing on your instructions.",
          ]}
        />
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <Lead>
          MyCodePad is a learning platform used by children. Use it accordingly.
        </Lead>
        <P>You must not:</P>
        <Bullets
          items={[
            "Attempt to access any account, class, school, file or task you have not been given access to, or test the platform's access controls without our written permission.",
            "Upload, write or distribute content that is unlawful, abusive, harassing, discriminatory, sexually explicit, or harmful to children.",
            "Use the platform to bully, intimidate or impersonate anybody.",
            "Attempt to guess, brute-force, harvest or redistribute class join codes or school invite codes.",
            "Interfere with the service, overload it, or use automated means to scrape it or to drive the AI features beyond ordinary use.",
            "Reverse engineer, resell, sublicense or white-label the platform.",
            "Use another person's credentials, or let somebody else use yours.",
            "Circumvent plan limits, seat allowances or payment.",
          ]}
        />
        <P>
          If you find a security vulnerability, please report it to <Tbc id="securityEmail" />{" "}
          rather than exploiting it or publishing it.
        </P>
      </>
    ),
  },
  {
    id: "code-execution",
    title: "Running code in the browser-based editors",
    body: (
      <>
        <Lead>
          Python runs inside your own browser in a sandboxed worker, and HTML previews render in a
          sandboxed frame that cannot reach the rest of the page or your session. Your code is not
          executed on our servers.
        </Lead>
        <P>
          Because your code runs on your own device, you are responsible for what it does there.
          Do not write or run code intended to attack a system, mine cryptocurrency, exhaust a
          device&apos;s resources, or exploit the browser or the sandbox.
        </P>
        <P>
          The Python runtime is downloaded from a public third-party CDN. If that CDN is
          unavailable, the Python editor will not start; this is outside our control.
        </P>
        <P>
          The editors are provided for learning and are not represented as a production
          development or hosting environment. Do not rely on them to run anything that matters.
        </P>
      </>
    ),
  },
  {
    id: "account-security",
    title: "Account security and credential sharing",
    body: (
      <>
        <Lead>
          You are responsible for keeping your password secret and for activity carried out
          through your account.
        </Lead>
        <P>
          Passwords must be at least eight characters. Changing your password requires your
          current one, and signs out every other device. Resetting a forgotten password through
          the emailed link also signs out every existing session, because a forgotten password may
          be a compromised one. Reset links expire one hour after they are issued.
        </P>
        <P>
          Shared accounts are not permitted, including shared class or form accounts: marking,
          feedback and attribution are meaningless if more than one person is behind a login. Tell
          us at <Tbc id="securityEmail" /> if you believe an account has been compromised.
        </P>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content, and the permission we need to host it",
    body: (
      <>
        <Lead>
          You own the code, projects and files you create. Using MyCodePad does not transfer any
          ownership of them to us.
        </Lead>
        <P>
          To provide the service we need your permission to do specific things with that content,
          and nothing more. You therefore grant us a non-exclusive, royalty-free, worldwide
          licence, for as long as your content is on the platform, to host, store, back up,
          reproduce and display it, and to transmit it, solely in order to:
        </P>
        <Numbered
          items={[
            "show your work back to you in the editor and keep it saved between sessions;",
            "show it to the teacher who owns the class it belongs to, and to administrators of your school;",
            "display it on a public page where you have chosen to publish it as a link;",
            "send the file contents and error text to our AI provider when you ask for error help, as described in the Privacy Policy;",
            "operate, secure and back up the platform.",
          ]}
        />
        <P>
          The licence ends for a given file when you delete it, and for a published page when you
          revoke its link, subject to copies that remain in backups until those expire. We do not
          use your content to advertise, and we do not license it to anybody else.
        </P>
        <P>
          You confirm that you have the right to the content you put on the platform, and that it
          does not infringe anybody else&apos;s rights.
        </P>
        <Callout tone="warning" title="AI training is a separate question">
          Whether our AI provider retains or trains on prompts has to be confirmed with that
          provider in writing. Until it is, this clause does not purport to grant any rights for
          model training, and none should be inferred from it.
        </Callout>
      </>
    ),
  },
  {
    id: "teaching-content",
    title: "Teacher material, assignments and student submissions",
    body: (
      <>
        <Lead>
          A teacher owns the tasks, library files and starter quizzes they create. A pupil owns
          the work they produce in response.
        </Lead>
        <P>
          When a teacher distributes a library file, each pupil receives their own copy. The
          task attached to the original remains the teacher&apos;s, and every copy reads it live,
          so editing the task reaches every pupil who has it. Worked solutions attached to a task
          are teacher-only and are never sent to a pupil.
        </P>
        <P>
          A teacher may mark, comment on and directly edit a pupil&apos;s file. Any direct edit is
          attributed to that teacher by name and the pupil&apos;s own previous version is
          preserved, so a correction can always be traced and never destroys the pupil&apos;s work.
        </P>
        <P>
          Where a teacher works for a school, the school&apos;s own policies may determine who
          owns material produced in the course of employment. That is a matter between the teacher
          and their school, and nothing in these terms affects it.
        </P>
      </>
    ),
  },
  {
    id: "plans",
    title: "Free features, Pro plans and school subscriptions",
    body: (
      <>
        <Lead>
          MyCodePad has a genuinely usable free tier. Paid plans lift its limits and add teaching
          features.
        </Lead>
        <H3>The free tier</H3>
        <Bullets
          items={[
            `Students: ${FREE_ALLOWANCE.student}.`,
            `Teachers: ${FREE_ALLOWANCE.teacher}, plus ${TEACHER_FREE_LIMITS.maxLibraryFiles} library files and ${TEACHER_FREE_LIMITS.maxLibraryFolders} library folders.`,
            "Both browser editors are available on the free tier.",
          ]}
        />
        <H3>Paid plans</H3>
        <InfoTable
          caption="Current plans, prices and seat allowances"
          headers={["Plan", "Price", "Seats included"]}
          rows={PLAN_ORDER.map((plan) => [plan.name, priceCell(plan), seatCell(plan)])}
        />
        <P>
          Student Pro and Teacher Pro are sold monthly only. School plans are sold either monthly
          or yearly; the yearly price is the one quoted by default.
        </P>
        <P>
          A school plan covers every teacher and pupil who is an active member of that school, up
          to the seat allowances above. Teacher Pro bought by an individual teacher covers up to{" "}
          {`${PLANS.teacher_pro.studentSeatLimit?.toLocaleString("en-GB")} distinct pupils`}{" "}
          counted across all of that teacher&apos;s classes — not per class — and every pupil
          they teach is lifted onto Pro at no extra cost.
        </P>
        {SALE.active && (
          <>
            <H3>Launch sale and the price-lock promise</H3>
            <P>
              The {SALE.name} is currently running. The plans discounted under it are those shown
              above with a reduced price:{" "}
              {PLAN_ORDER.filter(isOnSale)
                .map((plan) => plan.name)
                .join(" and ")}
              . If you subscribe to a discounted plan while the sale runs, we will keep you on
              that price for {SALE.priceLockYears} years from the day you subscribe, counted from
              your own start date rather than from a fixed calendar date. School plans are not
              discounted: their prices above are current prices, not reduced ones.
            </P>
          </>
        )}
      </>
    ),
  },
  {
    id: "prices-and-vat",
    title: "Prices, billing intervals and VAT",
    body: (
      <>
        <Lead>
          All prices are in pounds sterling and are charged by Stripe, our payment processor. We
          never see or store your card details.
        </Lead>
        <P>
          Prices are the amounts shown in the table above, which are the amounts our checkout
          actually charges — they are generated from the same configuration.
        </P>
        <Callout tone="warning" title="VAT treatment is not yet settled">
          Our VAT position is <Tbc id="vatPosition" />. Our checkout is currently configured with
          plain sterling amounts and no automatic tax calculation, so until the position above is
          confirmed the listed prices should not be read as either VAT-inclusive or
          VAT-exclusive. This must be resolved before these terms are published, and especially
          before any invoice is issued to a school.
        </Callout>
        <P>
          We may change prices for future billing periods. Where you are covered by the price-lock
          promise described above, we will honour it. We will tell existing subscribers before a
          price change takes effect, and you can cancel before it does.
        </P>
      </>
    ),
  },
  {
    id: "renewal-and-cancellation",
    title: "Renewal, cancellation, failed payments and plan changes",
    body: (
      <>
        <Lead>
          Subscriptions renew automatically at the end of each billing period until they are
          cancelled.
        </Lead>
        <H3>Cancelling</H3>
        <P>
          You cancel through the Stripe billing portal, reached from the Manage billing button on
          your billing page. Cancelling schedules the subscription to end at the end of the period
          you have already paid for: you keep your paid features until then, and you are not
          charged again. You can resume a scheduled cancellation from the same portal before it
          takes effect.
        </P>
        <P>
          Cancelling does not delete your account. When the period ends the account returns to the
          free tier with your work intact, though free-tier limits apply from that point. Closing
          an account is a separate request — see{" "}
          <a href="#after-closure" className="text-foreground underline underline-offset-4">
            section 17
          </a>
          .
        </P>
        <Callout tone="warning" title="Statutory cancellation rights and refunds">
          Your statutory position under the Consumer Contracts Regulations is{" "}
          <Tbc id="consumerCancellation" />, and our refund policy beyond statutory rights is{" "}
          <Tbc id="refundPolicy" />. There is no refund logic in our billing system today, so no
          discretionary refund right should be inferred from these terms until this is decided.
          These clauses require specialist review: a business cannot contract out of a
          consumer&apos;s statutory rights.
        </Callout>
        <H3>Failed payments</H3>
        <P>
          If a payment fails, Stripe retries it according to its standard schedule and the
          subscription status changes accordingly. Access to paid features follows the
          subscription status: once it is no longer active or trialing, the account returns to the
          free tier. You can update your payment method at any time in the billing portal.
        </P>
        <H3>Upgrading and changing plan</H3>
        <P>
          You can change plan from the upgrade page or the billing portal. Where a change is made
          mid-period, Stripe calculates any proration. A school changing tier changes its seat
          allowances with immediate effect.
        </P>
      </>
    ),
  },
  {
    id: "seats",
    title: "Seats and school subscription administration",
    body: (
      <>
        <Lead>
          Each school tier includes a fixed number of teacher and pupil seats, stored against that
          school so they can be adjusted independently of the tier defaults.
        </Lead>
        <P>
          A seat is occupied by an active member of the school. When the allowance is reached,
          further joins are refused until a seat is freed or the school moves to a larger tier.
          Pupils taught by a school&apos;s teachers count against the school&apos;s pupil seats
          rather than against any individual Teacher Pro allowance, so the same pupil is never
          charged to two allowances.
        </P>
        <P>
          School administrators are responsible for keeping membership accurate. If a school
          plan lapses, administrators keep their role but the school&apos;s members return to the
          free tier until the plan is active again.
        </P>
      </>
    ),
  },
  {
    id: "sponsored-access",
    title: "School-sponsored access and individual subscriptions",
    body: (
      <>
        <Lead>
          Paid access can reach you in three ways: you buy it, your teacher&apos;s Teacher Pro
          covers you, or your school&apos;s plan covers you.
        </Lead>
        <P>
          Where somebody else pays, you have no card on file, no renewal of your own and nothing
          to cancel — and we will not offer you billing controls that would do nothing. If that
          cover ends, because the teacher or school stops paying or you leave the class or school,
          your account returns to the free tier.
        </P>
        <P>
          An individual subscription you bought yourself is yours and continues regardless of any
          school arrangement. If you are already covered by a school, buying an individual plan
          will not add anything; check your account page before subscribing.
        </P>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    body: (
      <>
        <Lead>
          We may suspend or terminate access where these terms are breached, where there is a
          credible risk to other users — particularly to children — or where we are required to by
          law.
        </Lead>
        <P>
          Where it is reasonable to do so we will tell you first and give you an opportunity to
          put things right. Where the risk is serious, we may act immediately and explain
          afterwards. A school may remove any of its own members at any time.
        </P>
        <P>
          You may stop using MyCodePad at any time. To have an account closed, contact{" "}
          <Tbc id="privacyEmail" />.
        </P>
      </>
    ),
  },
  {
    id: "after-closure",
    title: "Export, retention and deletion after an account closes",
    body: (
      <>
        <Lead>
          You can download your files from inside either editor at any time, individually or as a
          zip archive, and you should do so before asking for an account to be closed.
        </Lead>
        <P>
          After closure, data is retained for <Tbc id="retentionAfterAccountClosure" />, except
          for billing and tax records, which we keep for{" "}
          <Tbc id="retentionBillingRecords" />, and anything else the law requires us to retain.
          Backups are retained for <Tbc id="retentionBackups" />.
        </P>
        <Callout tone="warning" title="Current limitations, stated plainly">
          There is no self-service account deletion in the product today and no single export of
          your full account data. Closure and erasure requests are handled manually. Being removed
          from a school marks the membership as removed and leaves the account and its work in
          place. We are not going to describe these as finished features while they are not.
        </Callout>
        <P>
          Where a school is the controller for pupil work, deletion at the end of a school
          contract is governed by the{" "}
          <a
            href="/data-processing-agreement"
            className="text-foreground underline underline-offset-4"
          >
            School Data Processing Agreement
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: "availability",
    title: "Service availability, maintenance and support",
    body: (
      <>
        <Lead>
          MyCodePad is provided on an as-available basis. We do not offer a guaranteed level of
          uptime, and nothing in these terms should be read as a service level agreement.
        </Lead>
        <P>
          We may carry out maintenance, change or withdraw features, and will try to give notice
          of anything significant. Parts of the service depend on third parties — see the next
          section — and can be affected by their outages.
        </P>
        <P>
          Several plans describe &ldquo;priority support&rdquo;. What that means in practice is{" "}
          <Tbc id="supportResponseTarget" />. Support is provided by email at{" "}
          <Tbc id="supportEmail" />.
        </P>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services we depend on",
    body: (
      <>
        <Lead>
          Providing MyCodePad requires other companies, and their terms govern their own services.
        </Lead>
        <Bullets
          items={[
            "Vercel hosts the application.",
            "Neon provides the database.",
            "Stripe processes payments and manages subscriptions and the billing portal.",
            "Resend delivers transactional email.",
            "Vercel's AI Gateway, currently routing to OpenAI, powers the AI help and generation features.",
            "jsDelivr serves the Pyodide runtime that executes Python in your browser.",
          ]}
        />
        <P>
          What each of these receives is set out in the{" "}
          <a href="/privacy#providers" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </a>
          . We are not responsible for a third party&apos;s own service or its availability, but
          we remain responsible for choosing providers and for the instructions we give them.
        </P>
      </>
    ),
  },
  {
    id: "our-ip",
    title: "Our intellectual property",
    body: (
      <>
        <Lead>
          The MyCodePad platform, its name, logo, interface, editors, curriculum material and
          supporting code belong to us or our licensors.
        </Lead>
        <P>
          You may use them to use the service as these terms allow. You may not copy, adapt,
          redistribute, resell or create a competing service from them, and you may not remove or
          obscure any proprietary notice.
        </P>
        <P>
          Starter templates, example projects and generated tasks are provided for teaching use
          within the platform.
        </P>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and limitation of liability",
    body: (
      <>
        <Callout tone="warning" title="This section needs specialist review before publication">
          Liability clauses are the part of a contract most likely to be unenforceable if drafted
          loosely, and the limits that may lawfully be imposed on a consumer differ from those
          that may be agreed with a school. The wording below is a starting point for an adviser,
          not finished drafting, and the financial cap in particular has been left unquantified on
          purpose.
        </Callout>
        <P>
          To the extent the law allows, MyCodePad is provided without warranties of any kind,
          express or implied, including implied warranties of merchantability, fitness for a
          particular purpose and non-infringement. We do not warrant that the service will be
          uninterrupted or error-free, that AI-generated hints, tasks or quiz questions will be
          accurate or pedagogically appropriate, or that code written on the platform will be
          correct or secure.
        </P>
        <P>
          Nothing in these terms excludes or limits liability for death or personal injury caused
          by negligence, for fraud or fraudulent misrepresentation, or for anything else that
          cannot lawfully be excluded or limited. If you are a consumer, your statutory rights
          under the Consumer Rights Act 2015 are unaffected.
        </P>
        <P>
          Subject to the paragraph above, and to the extent the law allows, we are not liable for
          loss of profit, loss of business, loss of goodwill, or indirect or consequential loss,
          and our total liability arising out of or in connection with these terms is limited to
          an amount to be determined on legal advice, by reference to the fees paid in a defined
          preceding period.
        </P>
        <P>
          You remain responsible for keeping your own copies of work that matters to you. Export
          is available from inside the editors at any time.
        </P>
      </>
    ),
  },
  {
    id: "complaints",
    title: "Complaints and disputes",
    body: (
      <>
        <Lead>
          If something has gone wrong, tell us first at <Tbc id="supportEmail" />. Our complaints
          process is <Tbc id="complaintsProcess" />.
        </Lead>
        <P>
          Complaints about how we have handled personal data can also be taken to the Information
          Commissioner&apos;s Office, as explained in the{" "}
          <a href="/privacy#complaints" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law and jurisdiction",
    body: (
      <>
        <Lead>
          These terms are governed by <Tbc id="governingLaw" />.
        </Lead>
        <Callout tone="warning" title="Subject to verification">
          A jurisdiction clause cannot deprive a UK consumer of the protection of the law where
          they live, and the right clause depends on where the operator is established and who the
          customer is. This must be settled on legal advice rather than asserted.
        </Callout>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <>
        <Lead>
          This is version {LEGAL_DOCUMENTS.terms.version}. It has no effective date because it has
          not yet been reviewed or published.
        </Lead>
        <P>
          When we change these terms we will update the version and effective date at the top of
          this page. For a material change — to prices, to what a plan includes, to cancellation,
          or to liability — we will notify account holders by email in advance where we can, and
          notify schools through their administrator. Continuing to use the service after a change
          takes effect means you accept the revised terms; if you do not, you can cancel.
        </P>
        <P>
          Previous versions are available on request from <Tbc id="supportEmail" />.
        </P>
      </>
    ),
  },
]

export default async function TermsPage() {
  const sessionUser = await getSessionUser()

  return (
    <LegalDocumentPage
      meta={LEGAL_DOCUMENTS.terms}
      signedIn={Boolean(sessionUser)}
      sections={sections}
      intro={
        <>
          <Lead>
            These terms set out what you can expect from MyCodePad and what we expect from you.
            They apply to students, teachers, tutors and schools, and to the free tier as well as
            to paid plans.
          </Lead>
          <P>
            Prices, billing intervals and seat allowances on this page are generated from the same
            configuration our checkout charges from, so they cannot drift apart from what you are
            actually billed. Clauses that need a lawyer rather than an engineer are flagged where
            they appear.
          </P>
        </>
      }
    />
  )
}
