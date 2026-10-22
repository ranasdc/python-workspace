import {
  Bullets,
  Callout,
  ContactBlock,
  H3,
  InfoTable,
  Lead,
  LegalDocumentPage,
  Numbered,
  P,
  Tbc,
  type LegalSection,
} from "@/components/legal/legal-ui"
import {
  BROWSER_STORAGE,
  DATA_CATEGORIES,
  LEGAL_DOCUMENTS,
  SECURITY_MEASURES,
  SUBPROCESSORS,
} from "@/lib/legal"
import { marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = "/privacy"

export const metadata = marketingMetadata(PATH)

/**
 * The Privacy Policy.
 *
 * Every factual statement here was verified against the code — the tables in
 * lib/db/schema.ts, the providers called from lib/, the storage keys set by the
 * client components. Anything that could not be verified from the code is a
 * marker rather than a sentence, because a privacy policy that guesses is worse
 * than one that admits a gap.
 */

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who operates MyCodePad and how to contact us",
    body: (
      <>
        <Lead>
          MyCodePad is an online coding platform for students, teachers, tutors and schools. It
          is operated by <Tbc id="operatorLegalName" />, a <Tbc id="operatorLegalForm" />{" "}
          registered in England and Wales under company number <Tbc id="companyNumber" />.
        </Lead>
        <P>
          For the personal data described in this policy, the operator is the controller except
          where a school is the controller — see{" "}
          <a href="#controller-roles" className="text-foreground underline underline-offset-4">
            section 2
          </a>
          .
        </P>
        <ContactBlock />
        <P>
          Our registration with the Information Commissioner&apos;s Office is{" "}
          <Tbc id="icoRegistration" />. Where the operator is established outside the UK, our
          Article 27 representative is <Tbc id="ukRepresentative" />.
        </P>
      </>
    ),
  },
  {
    id: "controller-roles",
    title: "What this policy covers, and who is the controller",
    body: (
      <>
        <Lead>
          This policy covers the MyCodePad website, the browser-based Python IDE and HTML editor,
          accounts, classes, assignments, saved work, school administration and paid
          subscriptions.
        </Lead>
        <P>
          Who is legally responsible for a given piece of processing depends on who decided it
          should happen, and that is not the same answer for every feature. Two situations arise.
        </P>
        <Numbered
          items={[
            <>
              <strong className="text-foreground">MyCodePad is the controller.</strong> For
              running and securing the platform itself — creating accounts, authenticating
              sign-ins, taking payments for individual subscriptions, sending service emails and
              protecting the service from abuse — the operator decides why and how the data is
              processed.
            </>,
            <>
              <strong className="text-foreground">A school is the controller.</strong> Where a
              school uses MyCodePad for its pupils, the school decides that its pupils will use
              the platform, which classes exist, what work is set and who may see it. For that
              processing MyCodePad acts as a processor on the school&apos;s instructions, and the
              terms in our{" "}
              <a
                href="/data-processing-agreement"
                className="text-foreground underline underline-offset-4"
              >
                School Data Processing Agreement
              </a>{" "}
              apply. Pupils and parents should also read their school&apos;s own privacy notice.
            </>,
          ]}
        />
        <Callout tone="warning" title="This allocation needs legal confirmation">
          The split above reflects how the product works, but controller and processor roles are
          determined by the facts of each processing activity, not by what a policy asserts.
          Where a teacher signs up independently rather than through a school, the position is
          different again. This allocation requires specialist review before it is relied upon in
          a school contract.
        </Callout>
      </>
    ),
  },
  {
    id: "registration-data",
    title: "Information you give us when you register",
    body: (
      <>
        <Lead>
          Creating a MyCodePad account requires a name, an email address and a password. You also
          choose whether the account is for a student or a teacher.
        </Lead>
        <P>
          That is the whole of registration. We do not ask for a date of birth, a postal address,
          a phone number, a school email domain or a photograph. Profile pictures are chosen from
          a fixed catalogue of illustrated avatars, so no image is ever uploaded and no picture of
          you is stored.
        </P>
        <P>
          Afterwards you may add or change a display name and an avatar, and students and teachers
          may join a class or a school by entering a code. Joining is how your account becomes
          linked to a teacher or a school; we never infer a school from your email address.
        </P>
        <Callout tone="warning" title="No age is collected today">
          Because registration asks for no age information, we cannot currently tell whether
          somebody signing up independently is a child. The minimum age for a self-registered
          account is <Tbc id="minimumAge" />, and how age is established is an outstanding
          decision. See{" "}
          <a href="#children" className="text-foreground underline underline-offset-4">
            section 16
          </a>
          .
        </Callout>
      </>
    ),
  },
  {
    id: "account-security-data",
    title: "Account, sign-in and session information",
    body: (
      <>
        <Lead>
          Your password is stored only as a cryptographic hash. Nobody at MyCodePad can read it,
          and we will never ask you for it.
        </Lead>
        <P>
          When you sign in we create a session record containing a session token, its expiry
          time, and the IP address and browser user-agent of the device the session was created
          from. These exist so that you stay signed in and so that unusual access can be
          investigated.
        </P>
        <P>
          Requesting a password reset creates a short-lived token that expires after one hour.
          Completing a reset signs out every other session on the account, because a forgotten
          password may be a compromised one. Changing your password from the account area does the
          same.
        </P>
        <P>
          Email addresses are not currently verified, which means an account can be created
          against an address its owner does not control. We are treating this as a gap rather
          than a feature.
        </P>
      </>
    ),
  },
  {
    id: "your-work",
    title: "The code, projects and files you create",
    body: (
      <>
        <Lead>
          Everything you write in a MyCodePad editor is saved to your account: the contents of
          each file, its name, which editor it belongs to and which folder it sits in.
        </Lead>
        <P>
          Your work is private to you by default. The people who can see a pupil&apos;s files are
          the pupil themselves and the teacher who owns the class the file belongs to — plus, for
          a school account, that school&apos;s administrators through the school dashboard. Other
          students never see each other&apos;s work.
        </P>
        <H3>When a teacher marks or corrects your work</H3>
        <P>
          A teacher can mark a file as done, leave comments on it and, if they choose, edit the
          code directly. A correction is never silent: the file records which teacher made it,
          their name, when it happened and which lines changed, and your own version from
          immediately before the correction is kept so your work cannot be destroyed. You can
          reply to a comment with one of a small set of reactions, including asking for more help.
        </P>
        <H3>Running code</H3>
        <P>
          Python runs inside your own browser using the Pyodide runtime, in a sandboxed worker.
          Your program and anything it prints are not sent to us in order to run. HTML previews
          render in a sandboxed frame that cannot reach the rest of the page, its cookies or your
          session. The runtime itself is downloaded from the public jsDelivr CDN, which sees your
          browser&apos;s IP address as part of that download.
        </P>
        <H3>Publishing a file as a link</H3>
        <P>
          You can publish one of your files as a public link. Anyone holding that link can read
          that file without an account. Share pages are excluded from search engines, but the
          link itself does not expire and cannot be password protected, so it should be treated as
          public once given out. You can revoke a link at any time, which disables every copy of
          it.
        </P>
      </>
    ),
  },
  {
    id: "teaching-data",
    title: "Class, school and teaching records",
    body: (
      <>
        <Lead>
          Teaching requires knowing who is in which class. We record enrolments, the teacher who
          owns each class, school membership with its role, and which invite code a member
          redeemed.
        </Lead>
        <P>
          A school membership carries a role — student, teacher or school administrator — and a
          status. Removing somebody from a school marks their membership as removed rather than
          erasing it, so the record of who was in the school when remains accurate. Leaving a
          school is therefore not the same thing as deleting data.
        </P>
        <P>Teachers additionally generate:</P>
        <Bullets
          items={[
            "A private library of reusable files and folders, with task instructions, topic, difficulty, year group and learning objective.",
            "Worked solutions attached to tasks. These are teacher-only and are never included in any response sent to a student.",
            "Daily starter quizzes for a class, and the resulting pupil answers, scores, totals, the frozen record of a pupil's first attempt, and the times each starter was opened and submitted.",
          ]}
        />
      </>
    ),
  },
  {
    id: "billing-data",
    title: "Subscriptions, billing and payments",
    body: (
      <>
        <Lead>
          Payments are processed by Stripe. Card numbers and other payment credentials are entered
          with Stripe directly and never reach MyCodePad&apos;s servers or database.
        </Lead>
        <P>
          When you start a subscription we pass your billing email address to Stripe Checkout. In
          return we store, against your account or your school: the plan, its status, the billing
          interval, Stripe&apos;s customer, subscription and price identifiers, the end of the
          current billing period and whether a cancellation is scheduled. We also record the
          identifier of each Stripe event we have processed, so a retried notification cannot
          apply the same billing change twice.
        </P>
        <P>
          Where a school or a teacher pays for your access, no card is requested from you at all
          and there is nothing on your account to bill.
        </P>
      </>
    ),
  },
  {
    id: "support-and-logs",
    title: "Support, diagnostics and security logs",
    body: (
      <>
        <Lead>
          If you contact us for support we hold your message and the address you sent it from for
          as long as it takes to deal with it and to handle any follow-up.
        </Lead>
        <P>
          For security, failed attempts to use a class join code are recorded against both the
          account that tried and the IP address it came from, so that a code — which anybody
          holding it can use — cannot be found by guessing. Successful joins are not recorded this
          way.
        </P>
        <P>
          Application errors are logged by our hosting provider as part of running the service.
          Email delivery failures are logged without the recipient address or the message content
          outside of local development.
        </P>
        <Callout tone="warning" title="Outstanding">
          The failed-attempt log stores IP addresses and is not currently pruned by any scheduled
          job. Its retention period is <Tbc id="retentionSecurityLogs" />, and a routine to
          enforce it still has to be built.
        </Callout>
      </>
    ),
  },
  {
    id: "what-we-hold",
    title: "Summary of the personal data we hold",
    body: (
      <>
        <Lead>
          The table below is generated from the actual database schema, so it can be checked
          against the product rather than taken on trust.
        </Lead>
        <InfoTable
          caption="Categories of personal data held by MyCodePad"
          headers={["Category", "What it contains", "Where it lives"]}
          rows={DATA_CATEGORIES.map((category) => [
            category.name,
            category.detail,
            <code key={category.name} className="font-mono text-xs">
              {category.source}
            </code>,
          ])}
        />
      </>
    ),
  },
  {
    id: "purposes-and-bases",
    title: "Why we process your data, and our lawful basis",
    body: (
      <>
        <Lead>
          UK GDPR requires a lawful basis for every purpose. The purposes below are the ones the
          product actually serves; the basis assigned to each is a legal determination that has
          not yet been confirmed by an adviser.
        </Lead>
        <InfoTable
          caption="Processing purposes and their lawful basis"
          headers={["Purpose", "Data used", "Proposed lawful basis"]}
          rows={[
            [
              "Creating and running your account",
              "Name, email address, password hash, role",
              "Contract — necessary to provide the account you asked for. For a pupil using a school account, the school's own basis applies instead.",
            ],
            [
              "Keeping you signed in and securing the account",
              "Session token, expiry, IP address, user-agent",
              "Legitimate interests — keeping accounts secure, including children's accounts.",
            ],
            [
              "Storing and displaying the work you create",
              "File contents, names, folders, marking status",
              "Contract, or the school's instructions where the school is the controller.",
            ],
            [
              "Teaching, marking and feedback",
              "Enrolments, comments, corrections, starter answers and scores",
              "Performance of a task in the public interest, or the school's instructions. This is the determination most in need of review.",
            ],
            [
              "Taking payment for a subscription",
              "Billing email, Stripe identifiers, plan and status",
              "Contract.",
            ],
            [
              "Sending service emails (welcome, password reset)",
              "Name, email address",
              "Contract, and legitimate interests for security notices.",
            ],
            [
              "AI error help and task generation",
              "The code and error text in the file concerned; a teacher's topic and objective",
              "Legitimate interests, subject to the teacher control described in section 18.",
            ],
            [
              "Protecting the service from abuse",
              "Failed join attempts with account and IP address",
              "Legitimate interests — protecting pupils and class data from unauthorised access.",
            ],
            [
              "Meeting legal and tax obligations",
              "Billing and transaction records",
              "Legal obligation.",
            ],
          ]}
        />
        <Callout tone="warning" title="Requires legal review">
          Lawful bases are not interchangeable and cannot be swapped after the fact. Each row
          above must be confirmed before this policy is published — particularly the basis for
          processing children&apos;s data in a school context, where the choice between public
          task, legitimate interests and the school&apos;s own instructions has real consequences
          for the rights available to pupils.
        </Callout>
        <P>
          Where we rely on legitimate interests, you have the right to object. Where we ever rely
          on consent, it will be asked for separately and specifically, and you will be able to
          withdraw it as easily as you gave it. Accepting our Terms of Service is not consent to
          any processing of personal data.
        </P>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share data with",
    body: (
      <>
        <Lead>
          We do not sell personal data, we do not share it with advertisers and there is no
          advertising, marketing or behavioural tracking technology anywhere in the product.
        </Lead>
        <P>Data is shared only in these situations:</P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">With your teacher and your school.</strong> A
              pupil&apos;s work, marking status, comments and starter results are visible to the
              teacher who owns their class, and to administrators of the school that pupil belongs
              to.
            </>,
            <>
              <strong className="text-foreground">With service providers.</strong> The companies
              listed in the next section process data on our behalf and under contract.
            </>,
            <>
              <strong className="text-foreground">With anyone you give a link to.</strong> Only
              where you have deliberately published a file as a public link.
            </>,
            <>
              <strong className="text-foreground">Where the law requires it,</strong> or to
              establish, exercise or defend legal claims, or to protect someone&apos;s vital
              interests.
            </>,
            <>
              <strong className="text-foreground">In a business transfer,</strong> if the service
              were ever sold or reorganised. You would be told before your data became subject to
              a different privacy policy.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "providers",
    title: "Service providers and international transfers",
    body: (
      <>
        <Lead>
          These are every provider that receives personal data, identified by reading the
          application code rather than from a vendor list.
        </Lead>
        <InfoTable
          caption="Service providers and what each one receives"
          headers={["Provider", "What it does", "What it receives", "Location"]}
          rows={SUBPROCESSORS.map((provider) => [
            provider.name,
            provider.role,
            provider.dataReceived,
            provider.location ? <Tbc key={provider.name} id={provider.location} /> : "To be confirmed",
          ])}
        />
        <Callout tone="warning" title="Transfers out of the UK are not yet confirmed">
          Several of these providers are capable of processing data outside the UK. Where that
          happens, the safeguard relied upon is <Tbc id="transferMechanism" />. The actual
          deployment and database regions — <Tbc id="hostingRegion" /> and{" "}
          <Tbc id="databaseRegion" /> — must be read from the live project configuration, and the
          processing locations of the payment, email and AI providers confirmed with each of them,
          before this section can state anything definite.
        </Callout>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep your data",
    body: (
      <>
        <Lead>
          We keep personal data for as long as your account exists, and then for the periods set
          out below. Some of those periods have not yet been set.
        </Lead>
        <P>What we can state from how the product behaves today:</P>
        <Bullets
          items={[
            "A file you delete is removed from the database, and so is the public share link attached to it — a revoked or orphaned link resolves to nothing.",
            "Deleting a class removes the class and its enrolments.",
            "Sessions expire on their own and are revoked in bulk when you change or reset your password.",
            "Password reset tokens expire one hour after they are issued.",
            "Being removed from a school marks the membership as removed; it does not delete the member's account or their work.",
          ]}
        />
        <P>What is still to be decided:</P>
        <InfoTable
          caption="Retention periods still to be set"
          headers={["Data", "Retention"]}
          rows={[
            ["Account and work data after an account is closed", <Tbc key="a" id="retentionAfterAccountClosure" />],
            ["Backups, and when deletions reach them", <Tbc key="b" id="retentionBackups" />],
            ["Billing and tax records", <Tbc key="c" id="retentionBillingRecords" />],
            ["Security logs, including failed join attempts", <Tbc key="d" id="retentionSecurityLogs" />],
            ["Dormant accounts", <Tbc key="e" id="retentionInactiveAccounts" />],
            ["School data at the end of a school contract", <Tbc key="f" id="retentionSchoolEndOfContract" />],
          ]}
        />
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect your data",
    body: (
      <>
        <Lead>
          The measures below are implemented in the product today. We have deliberately not
          listed anything we cannot point at in the code.
        </Lead>
        <InfoTable
          caption="Technical and organisational security measures"
          headers={["Measure", "What it means in practice"]}
          rows={SECURITY_MEASURES.map((item) => [item.measure, item.detail])}
        />
        <P>
          We hold the following security certifications: <Tbc id="securityCertifications" />. No
          service can be guaranteed absolutely secure, and we do not claim otherwise. If you
          believe an account has been compromised, contact us at <Tbc id="securityEmail" />.
        </P>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights over your data",
    body: (
      <>
        <Lead>
          Under UK data protection law you have the rights below. They are free to exercise, and
          we will respond within one month of receiving a request.
        </Lead>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Access</strong> — a copy of the personal data we
              hold about you.
            </>,
            <>
              <strong className="text-foreground">Rectification</strong> — correction of anything
              inaccurate. Your name and avatar can be changed yourself in your account settings.
            </>,
            <>
              <strong className="text-foreground">Erasure</strong> — deletion of your data, where
              no overriding reason to keep it applies.
            </>,
            <>
              <strong className="text-foreground">Restriction</strong> — a pause on processing
              while a dispute about accuracy or legitimate interests is resolved.
            </>,
            <>
              <strong className="text-foreground">Portability</strong> — the data you gave us, in
              a machine-readable form.
            </>,
            <>
              <strong className="text-foreground">Objection</strong> — to processing we justify on
              legitimate interests.
            </>,
            <>
              <strong className="text-foreground">Withdrawing consent</strong> — at any time,
              wherever we have relied on consent.
            </>,
          ]}
        />
        <P>
          To exercise any of these, write to <Tbc id="privacyEmail" />. We may ask you to confirm
          your identity before acting, so that somebody else cannot obtain your data by asking.
        </P>
        <P>
          If your account belongs to a school, the school is usually the controller for your
          school work. In that case send your request to the school and we will assist them with
          it; if you send it to us, we will tell you and pass it on.
        </P>
        <Callout tone="warning" title="What we can and cannot do today">
          There is no self-service account deletion in the product, and no single export covering
          your account, classes, feedback and results. Requests under the rights above are
          currently fulfilled manually. Building both is the first item on our remediation list,
          and this section will be rewritten when it is done.
        </Callout>
      </>
    ),
  },
  {
    id: "closing-your-account",
    title: "Closing your account, exporting and deleting data",
    body: (
      <>
        <Lead>
          You can download your code at any time from inside either editor, file by file or as a
          zip archive.
        </Lead>
        <P>
          To close an account, or to have your data deleted, contact <Tbc id="privacyEmail" />.
          Once an account is closed, data is retained for{" "}
          <Tbc id="retentionAfterAccountClosure" />, except for records we must keep by law — see{" "}
          <a href="#retention" className="text-foreground underline underline-offset-4">
            section 13
          </a>
          .
        </P>
        <P>
          Cancelling a paid subscription is separate from closing an account: a cancelled
          subscription leaves the account in place on the free tier. Cancellation is handled
          through the Stripe billing portal linked from your billing page.
        </P>
        <P>
          Where your account was created through a school, the school may ask us to remove it. The
          school&apos;s own retention policy governs how long it keeps pupil work.
        </P>
      </>
    ),
  },
  {
    id: "children",
    title: "Children and young people",
    body: (
      <>
        <Lead>
          MyCodePad is used in schools, so we expect many of our users to be children. The
          ICO&apos;s Age Appropriate Design Code applies to us, and the following is an honest
          account of where we stand against it.
        </Lead>
        <P>What is already true of the product:</P>
        <Bullets
          items={[
            "Registration collects the minimum we can run an account on: a name, an email address and a role.",
            "Files are private by default. Nothing a pupil writes is public unless they publish it themselves.",
            "There is no advertising, no marketing, no behavioural tracking and no profiling anywhere in the platform.",
            "Teacher corrections to a pupil's code are always attributed, and the pupil's own prior version is preserved.",
            "AI help is a teacher-controlled feature that can be switched off for a class, and is delayed so that pupils attempt problems themselves first.",
          ]}
        />
        <P>What is outstanding, and which we are not going to describe as finished:</P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Age assurance.</strong> No age is collected, so
              we cannot yet identify which of our users are children. The minimum age for an
              independent account is <Tbc id="minimumAge" />.
            </>,
            <>
              <strong className="text-foreground">A child-facing privacy notice.</strong> This
              policy is written for an adult reader. A short, plain version for pupils is still to
              be written.
            </>,
            <>
              <strong className="text-foreground">Public sharing.</strong> A published link does
              not expire and cannot be password protected. Whether pupils should be able to
              publish at all is under review.
            </>,
            <>
              <strong className="text-foreground">A data protection impact assessment.</strong>{" "}
              Our DPIA status is <Tbc id="dpiaStatus" />. No assessment has been completed, and we
              make no claim that one has.
            </>,
          ]}
        />
        <P>
          If you are a parent or carer and want to know what we hold about your child, the
          quickest route is usually through their school, because for school work the school is
          the controller. You can also write to <Tbc id="privacyEmail" />.
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    body: (
      <>
        <Lead>
          MyCodePad sets one cookie, and it exists to keep you signed in. There are no
          advertising cookies, no cross-site trackers and no third-party marketing tags.
        </Lead>
        <P>
          Some preferences are kept in your browser&apos;s own local storage rather than sent to
          us. They never leave your device and we cannot read them. The complete list, taken from
          the code:
        </P>
        <InfoTable
          caption="Cookies and browser storage set by MyCodePad"
          headers={["What", "Type", "Why", "Strictly necessary"]}
          rows={BROWSER_STORAGE.map((item) => [
            item.name,
            item.kind,
            item.purpose,
            item.essential ? "Yes" : "No — a preference stored on your own device",
          ])}
        />
        <H3>Why there is no cookie banner</H3>
        <P>
          Because nothing here is used for advertising, analytics profiling or tracking you across
          sites, there is nothing to ask consent for beyond what is strictly necessary to provide
          the service you asked for, and the remaining items store only your own interface
          preferences on your own device. Adding a consent banner would be decorative, and a
          decorative banner trains people to dismiss the real ones.
        </P>
        <P>
          We use Vercel&apos;s page analytics in production. It is cookieless and does not build a
          profile of you or follow you to other sites.
        </P>
        <Callout tone="warning" title="One point to confirm">
          Whether cookieless analytics and functional browser storage fall inside the
          &ldquo;strictly necessary&rdquo; exemption in the Privacy and Electronic Communications
          Regulations is a judgement, and the ICO expects it to be reasoned rather than assumed.
          It should be confirmed as part of the legal review. If MyCodePad ever adds a tracking
          technology that needs consent, a real consent mechanism — with a reject option as
          prominent as accept, and the technology blocked until consent is given — must be built
          at the same time.
        </Callout>
      </>
    ),
  },
  {
    id: "automated-decisions",
    title: "Automated decision-making, profiling and AI features",
    body: (
      <>
        <Lead>
          No decision with a legal or similarly significant effect on you is made by automated
          means, and we do not profile users.
        </Lead>
        <P>
          Starter quizzes are scored automatically, and files carry a marking status. Both are
          shown to the pupil and to their own teacher. Nothing is inferred, ranked or predicted
          from them, and no access, grade or account outcome follows automatically from either.
        </P>
        <H3>What the AI features send, and where</H3>
        <P>
          Three features call a large language model through Vercel&apos;s AI Gateway, which
          currently routes to OpenAI:
        </P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Error help.</strong> Sends the code in the file
              you are working on, truncated to 8,000 characters, together with the error message
              your program produced. It is unlocked only after a delay set by your teacher, and
              teachers can switch it off for a class entirely. Your name, email address and
              account identifier are not included in the prompt.
            </>,
            <>
              <strong className="text-foreground">Task generation.</strong> Sends the topic,
              difficulty, year group and learning objective a teacher typed in. No pupil data is
              involved.
            </>,
            <>
              <strong className="text-foreground">Starter generation.</strong> Sends the same kind
              of teacher-supplied lesson metadata to produce quiz questions.
            </>,
          ]}
        />
        <P>
          The hint you receive is cached in your own browser so that reopening a file does not
          spend another request.
        </P>
        <Callout tone="warning" title="To confirm with the provider">
          Whether prompts are retained by the model provider, for how long, and whether they are
          excluded from model training must be confirmed in writing and reflected here. Code a
          pupil has written is their personal data, and sending it to a third party needs that
          answer on the record.
        </Callout>
      </>
    ),
  },
  {
    id: "complaints",
    title: "Complaints, and the Information Commissioner's Office",
    body: (
      <>
        <Lead>
          If you are unhappy with how we have handled your personal data, please tell us first so
          that we have the chance to put it right. Our complaints process is{" "}
          <Tbc id="complaintsProcess" />.
        </Lead>
        <P>
          You also have the right to complain to the UK&apos;s data protection regulator, the
          Information Commissioner&apos;s Office, at any time, and you do not have to come to us
          first.
        </P>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3.5 text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">Information Commissioner&apos;s Office</p>
          <p>Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF</p>
          <p>Helpline: 0303 123 1113</p>
          <p>
            <a
              href="https://ico.org.uk/make-a-complaint/"
              className="text-foreground underline underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              ico.org.uk/make-a-complaint
            </a>
          </p>
        </div>
      </>
    ),
  },
  {
    id: "changes",
    title: "Version, effective date and changes to this policy",
    body: (
      <>
        <Lead>
          This is version {LEGAL_DOCUMENTS.privacy.version}. It has no effective date because it
          has not yet been reviewed or published.
        </Lead>
        <P>
          When we change this policy we will update the version and the effective date at the top
          of the page. For a material change — a new purpose, a new category of recipient, or a
          change to a lawful basis — we will email account holders in advance where we can, and
          notify schools through their administrator, rather than relying on you noticing a new
          date.
        </P>
        <P>
          Previous versions are available on request from <Tbc id="privacyEmail" />.
        </P>
      </>
    ),
  },
]

export default async function PrivacyPolicyPage() {
  const sessionUser = await getSessionUser()

  return (
    <LegalDocumentPage
      meta={LEGAL_DOCUMENTS.privacy}
      signedIn={Boolean(sessionUser)}
      sections={sections}
      intro={
        <>
          <Lead>
            This policy explains what personal data MyCodePad collects, why, who it is shared
            with, how long it is kept and what you can do about it. It is written to be read, not
            to be skimmed past.
          </Lead>
          <P>
            Everything stated here as fact was checked against how the platform is actually built.
            Where a question has not been answered yet — a retention period, a provider location,
            a legal determination — it is marked in amber rather than filled in with something
            plausible.
          </P>
        </>
      }
    />
  )
}
