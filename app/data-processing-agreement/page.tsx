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
  DATA_CATEGORIES,
  LEGAL_DOCUMENTS,
  SECURITY_MEASURES,
  SUBPROCESSORS,
} from "@/lib/legal"
import { marketingMetadata } from "@/lib/seo/marketing"
import { getSessionUser } from "@/lib/session"

const PATH = "/data-processing-agreement"

export const metadata = marketingMetadata(PATH)

/**
 * The school-facing Data Processing Agreement.
 *
 * Written against Article 28(3) of UK GDPR, clause by clause, so a school's
 * data protection lead can check the mandatory list off against it. The
 * appendices are populated only from the codebase audit: where the audit could
 * not establish something — a region, a notification deadline, a retention
 * window — the appendix says so rather than filling the cell.
 */

const sections: LegalSection[] = [
  {
    id: "parties",
    title: "The parties, and how this fits the school's contract",
    body: (
      <>
        <Lead>
          This agreement is between the school, academy trust or college that subscribes to
          MyCodePad (the <strong className="text-foreground">School</strong>) and{" "}
          <Tbc id="operatorLegalName" />, a <Tbc id="operatorLegalForm" /> with company number{" "}
          <Tbc id="companyNumber" /> and address <Tbc id="registeredAddress" /> (
          <strong className="text-foreground">MyCodePad</strong>).
        </Lead>
        <P>
          It supplements the School&apos;s subscription to MyCodePad and the{" "}
          <a href="/terms" className="text-foreground underline underline-offset-4">
            Terms of Service
          </a>
          , and forms part of that contract. Where this agreement and the Terms of Service
          conflict on a matter of personal data, this agreement prevails. Where the School has a
          separate signed agreement with MyCodePad, that agreement prevails over this page.
        </P>
        <P>
          It takes effect when the School&apos;s subscription begins and continues for as long as
          MyCodePad processes personal data on the School&apos;s behalf.
        </P>
      </>
    ),
  },
  {
    id: "roles",
    title: "Controller and processor roles are not the same for every feature",
    body: (
      <>
        <Lead>
          This agreement applies where the School determines the purposes and means of the
          processing and MyCodePad processes on its instructions. That is not every activity on
          the platform, and treating it as though it were would be inaccurate.
        </Lead>
        <InfoTable
          caption="Indicative allocation of roles by activity"
          headers={["Activity", "Indicative role"]}
          rows={[
            [
              "Pupil accounts created to take part in the School's classes, class membership, work set and marked, teacher feedback, starter results",
              "School as controller, MyCodePad as processor under this agreement.",
            ],
            [
              "School membership, invite codes, seat administration",
              "School as controller, MyCodePad as processor.",
            ],
            [
              "Authenticating sign-ins, protecting accounts from unauthorised access, throttling join-code guessing, security logging",
              "MyCodePad as controller for its own security obligations, in respect of the same data.",
            ],
            [
              "Billing the School, keeping tax and accounting records",
              "MyCodePad as controller.",
            ],
            [
              "Operating, maintaining, securing and supporting the platform itself",
              "MyCodePad as controller for its own legitimate interests, within the limits of clause 6.",
            ],
            [
              "An account a pupil or teacher created independently, outside any school",
              "MyCodePad as controller. Not covered by this agreement.",
            ],
          ]}
        />
        <Callout tone="warning" title="This allocation must be assessed, not assumed">
          Roles follow the facts of each processing activity. A school should satisfy itself that
          the allocation above matches its own assessment, particularly where an independently
          created pupil account is later joined to the school, because the basis on which that
          data was originally collected does not change simply by joining. This clause requires
          specialist review before the School relies on it.
        </Callout>
      </>
    ),
  },
  {
    id: "subject-matter",
    title: "Subject matter and duration of the processing",
    body: (
      <>
        <Lead>
          <strong className="text-foreground">Subject matter:</strong> the provision of an online
          coding platform to the School&apos;s pupils and staff, including browser-based
          development environments, saved work, classes, assignments, feedback, starter quizzes
          and school administration.
        </Lead>
        <P>
          <strong className="text-foreground">Duration:</strong> for the term of the
          School&apos;s subscription, and then only for as long as needed to complete the return
          and deletion obligations in clause 16. The deletion window is{" "}
          <Tbc id="retentionSchoolEndOfContract" />.
        </P>
      </>
    ),
  },
  {
    id: "nature-and-purpose",
    title: "Nature and purpose of the processing",
    body: (
      <>
        <Lead>
          MyCodePad processes the School&apos;s personal data only to provide and support the
          platform. In practice this means:
        </Lead>
        <Bullets
          items={[
            "Creating and authenticating accounts for the School's pupils and staff.",
            "Storing, versioning and displaying the code, files and folders pupils create.",
            "Enrolling pupils in classes and recording school membership and roles.",
            "Distributing teacher-created tasks and library files to pupils, and recording submissions.",
            "Recording marking status, teacher comments, attributed teacher corrections and pupils' replies to feedback.",
            "Running starter quizzes and recording answers, scores and submission times.",
            "Providing AI-assisted error help and task generation, where the teacher has enabled it.",
            "Administering seats and invite codes for the School.",
            "Securing the service, including throttling attempts to guess class join codes.",
            "Providing support to the School's staff.",
          ]}
        />
        <P>
          MyCodePad does not use the School&apos;s personal data for advertising, marketing,
          profiling or any form of behavioural analysis. No such technology exists anywhere in the
          platform.
        </P>
      </>
    ),
  },
  {
    id: "data-subjects",
    title: "Categories of data subject",
    body: (
      <>
        <Bullets
          items={[
            "Pupils of the School, including children.",
            "Teaching staff and tutors at the School.",
            "School administrators who manage the School's membership, seats and plan.",
          ]}
        />
        <P>
          MyCodePad does not collect data about parents, carers or other third parties, and the
          platform has no parent-facing account.
        </P>
      </>
    ),
  },
  {
    id: "personal-data-types",
    title: "Types of personal data",
    body: (
      <>
        <Lead>
          The categories are set out in full in{" "}
          <a href="#appendix-a" className="text-foreground underline underline-offset-4">
            Appendix A
          </a>
          , derived from the live database schema.
        </Lead>
        <P>
          <strong className="text-foreground">Special category data:</strong> MyCodePad does not
          request or require any special category data under Article 9, and the platform has no
          field for it. Because pupils write free text in their code, comments and quiz answers,
          the School should instruct pupils not to enter sensitive personal information into their
          work. MyCodePad cannot filter free text and does not inspect it.
        </P>
        <P>
          <strong className="text-foreground">Criminal offence data:</strong> none is requested or
          required.
        </P>
      </>
    ),
  },
  {
    id: "instructions",
    title: "Documented processing instructions",
    body: (
      <>
        <Lead>
          MyCodePad will process the School&apos;s personal data only on the School&apos;s
          documented instructions, including on transfers, except where required to do otherwise
          by law. Where the law requires it, MyCodePad will tell the School first unless the law
          prohibits that.
        </Lead>
        <P>The School&apos;s documented instructions are:</P>
        <Numbered
          items={[
            "This agreement and the subscription it supplements.",
            "The School's and its teachers' use of the platform's own features — creating classes, issuing invite codes, setting and marking work, enabling or disabling AI help, adding and removing members.",
            "Any further written instruction the School gives to the privacy contact in clause 19.",
          ]}
        />
        <P>
          MyCodePad will tell the School if, in its opinion, an instruction infringes UK data
          protection law. MyCodePad may implement a further written instruction that requires
          development work, or that materially changes the service, subject to agreement on
          feasibility and cost.
        </P>
      </>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    body: (
      <>
        <Lead>
          MyCodePad ensures that every person authorised to process the School&apos;s personal
          data is bound by an appropriate duty of confidentiality, whether contractual or
          statutory, and that access is limited to those who need it to provide or support the
          service.
        </Lead>
        <Callout tone="warning" title="To be documented">
          The operator must be able to evidence this: confidentiality terms in staff and
          contractor agreements, a record of who holds production access, and the operational
          controls around support access to the live database. None of this can be read from the
          codebase, so it has to be documented separately before this clause can be relied upon.
        </Callout>
      </>
    ),
  },
  {
    id: "security",
    title: "Technical and organisational security measures",
    body: (
      <>
        <Lead>
          MyCodePad implements appropriate technical and organisational measures under Article 32,
          taking into account the state of the art, the costs of implementation, the nature of the
          processing and the risk to data subjects — who in this case include children.
        </Lead>
        <P>
          The measures currently implemented are listed in{" "}
          <a href="#appendix-c" className="text-foreground underline underline-offset-4">
            Appendix C
          </a>
          . Each one is implemented in the product today and can be evidenced on request.
        </P>
        <P>
          Certifications held: <Tbc id="securityCertifications" />. MyCodePad does not claim any
          certification it does not hold, and the absence of a certification above means none is
          claimed.
        </P>
      </>
    ),
  },
  {
    id: "subprocessors",
    title: "Subprocessors",
    body: (
      <>
        <Lead>
          The School gives general authorisation for MyCodePad to appoint subprocessors. Those
          currently appointed are listed in{" "}
          <a href="#appendix-b" className="text-foreground underline underline-offset-4">
            Appendix B
          </a>
          .
        </Lead>
        <P>MyCodePad will:</P>
        <Numbered
          items={[
            <>
              give the School <Tbc id="subprocessorNoticePeriod" /> notice before adding or
              replacing a subprocessor, so the School has a genuine opportunity to object;
            </>,
            "impose data protection obligations on each subprocessor that are no less protective than those in this agreement; and",
            "remain fully liable to the School for a subprocessor's performance of those obligations.",
          ]}
        />
        <P>
          If the School reasonably objects to a new subprocessor on data protection grounds, the
          parties will discuss it in good faith. Where no resolution is reached, the School may
          terminate the affected part of the service.
        </P>
        <Callout tone="warning" title="Notice mechanism to be built">
          There is currently no mechanism for notifying schools of a subprocessor change. A
          notification route — at minimum, email to school administrators and a dated list on this
          page — is needed before this clause can be met in practice.
        </Callout>
      </>
    ),
  },
  {
    id: "data-subject-rights",
    title: "Assistance with data subject rights requests",
    body: (
      <>
        <Lead>
          Taking into account the nature of the processing, MyCodePad will assist the School by
          appropriate technical and organisational measures, so far as possible, in responding to
          requests from pupils and staff exercising their rights under Chapter III.
        </Lead>
        <P>
          Where a request reaches MyCodePad directly, MyCodePad will not respond to it itself
          unless the School instructs it to. It will tell the School without undue delay and pass
          the request on.
        </P>

        <H3>How an erasure request from a School-managed account is handled</H3>
        <P>
          This is implemented rather than merely promised. When a pupil or member of staff whose
          account belongs to the School asks to be erased, the platform records the request,
          gives it a reference, sets the response deadline at one month from receipt, and places
          it in the School&apos;s own queue on its school dashboard rather than acting on it.
          MyCodePad does not delete work produced for the School without the School&apos;s
          instruction.
        </P>
        <P>
          From that queue, an administrator of the School — and only of that School — can record
          that the requester&apos;s identity has been verified, record separately that their
          authority to ask has been established, and mark the request completed or refused. A
          completion must say what was deleted, transferred or retained, and a refusal must state
          its grounds, because the School has to give those grounds to the requester. Every one of
          those steps is written to an audit trail with the administrator&apos;s name and the time.
        </P>
        <P>
          The plan that governs what happens to each kind of record is published to the account
          holder before they ask, and distinguishes a teacher from a pupil from an administrator.
          A teacher leaving does not delete their classes: their identifiers are removed from the
          feedback they left, and the classes and pupil work transfer to the School. An
          administrator who created the School cannot be removed until School ownership has been
          transferred, because the database would otherwise delete the School with them.
        </P>

        <Callout tone="warning" title="What this assistance currently looks like">
          Schools should know exactly what they are relying on. Requests are now tracked to a
          decision with a visible deadline, but fulfilment is still manual: no code in MyCodePad
          deletes an account, and there is no single export covering an individual&apos;s account,
          classes, feedback and starter results. The queue also sends no notification, so the
          School should nominate someone to check it. The practical turnaround for a bulk request
          should be agreed with the School rather than assumed from this clause.
        </Callout>
        <P>
          The platform does let a teacher or administrator correct a pupil&apos;s name and remove
          a member from a school, and lets a pupil download their own files from inside either
          editor at any time.
        </P>
      </>
    ),
  },
  {
    id: "breach",
    title: "Personal data breaches",
    body: (
      <>
        <Lead>
          MyCodePad will notify the School without undue delay after becoming aware of a personal
          data breach affecting the School&apos;s personal data, and in any event within{" "}
          <Tbc id="breachNotificationWindow" /> of becoming aware of it.
        </Lead>
        <P>The notification will include, so far as it is known at the time:</P>
        <Bullets
          items={[
            "the nature of the breach, including the categories and approximate number of data subjects and records affected;",
            "the likely consequences;",
            "the measures taken or proposed to address it and to mitigate its effects; and",
            "a contact point for further information.",
          ]}
        />
        <P>
          Where the full picture is not available at once, MyCodePad will provide information in
          phases rather than delay the initial notification. MyCodePad will assist the School with
          its own obligations to notify the ICO under Article 33 and affected individuals under
          Article 34, and will keep a record of breaches, their effects and the remedial action
          taken.
        </P>
        <Callout tone="warning" title="Set a deadline you can actually meet">
          The deadline above must be chosen deliberately. A school will often ask for 24 hours.
          Committing to a window the operator cannot meet — given on-call arrangements, monitoring
          and out-of-hours cover — creates a contractual breach on top of a data breach.
          Monitoring and alerting sufficient to detect a breach promptly should be in place before
          any figure is agreed.
        </Callout>
      </>
    ),
  },
  {
    id: "dpia",
    title: "Data protection impact assessments and prior consultation",
    body: (
      <>
        <Lead>
          MyCodePad will provide reasonable assistance to the School with any data protection
          impact assessment under Article 35, and with any prior consultation of the ICO under
          Article 36, where these relate to the School&apos;s use of the platform.
        </Lead>
        <P>
          That assistance takes account of the nature of the processing and the information
          available to MyCodePad: the descriptions in the appendices to this agreement, the
          security measures, the subprocessor list, and answers to specific questions about how a
          feature works.
        </P>
        <P>
          MyCodePad&apos;s own DPIA status is <Tbc id="dpiaStatus" />. No assessment has been
          completed at the time of writing, and MyCodePad does not claim that one has. A School
          whose own DPIA depends on the supplier having assessed its processing should ask for the
          current position before relying on this clause.
        </P>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <>
        <Lead>
          MyCodePad will not transfer the School&apos;s personal data outside the United Kingdom
          except in accordance with this clause and with UK data protection law.
        </Lead>
        <P>
          The hosting region is <Tbc id="hostingRegion" /> and the database region is{" "}
          <Tbc id="databaseRegion" />. Where a transfer outside the UK takes place, the safeguard
          relied upon is <Tbc id="transferMechanism" />.
        </P>
        <Callout tone="warning" title="Not yet established">
          The processing locations of the payment, email and AI providers in Appendix B have not
          been verified, and no transfer risk assessment has been carried out. A school that
          requires UK or EEA-only processing must not assume it from this page. These facts must
          be read from live configuration and confirmed with each provider before this clause can
          state anything definite.
        </Callout>
      </>
    ),
  },
  {
    id: "audit",
    title: "Audits and compliance information",
    body: (
      <>
        <Lead>
          MyCodePad will make available to the School the information necessary to demonstrate
          compliance with Article 28, and will allow for and contribute to audits, including
          inspections, conducted by the School or an auditor it mandates.
        </Lead>
        <P>
          The practical arrangements for audits are <Tbc id="auditArrangements" />. MyCodePad does
          not place restrictions on this right beyond those agreed in writing with the School, and
          no restriction should be read into the absence of detail here.
        </P>
        <P>
          MyCodePad will respond to reasonable security and data protection questionnaires as part
          of the School&apos;s own supplier assurance process.
        </P>
      </>
    ),
  },
  {
    id: "return-and-deletion",
    title: "Return and deletion at the end of the contract",
    body: (
      <>
        <Lead>
          At the School&apos;s choice, MyCodePad will delete or return all the School&apos;s
          personal data at the end of the provision of the service, and delete existing copies,
          except to the extent the law requires it to be kept.
        </Lead>
        <P>
          The School must make its choice within <Tbc id="retentionSchoolEndOfContract" /> of the
          end of the subscription. Absent an instruction, MyCodePad will delete.
        </P>
        <Callout tone="warning" title="A deletion routine has to be written first">
          This is the clause the School should press hardest on. Most application tables reference
          users and classes by plain identifier columns with no database-level cascade, so
          deleting an account would leave that person&apos;s files, enrolments, comments, starter
          responses and share links behind. A deletion routine must be written and tested table by
          table before this clause can be honoured, and before any assurance is given to a school
          that deletion is complete. Backups are retained for <Tbc id="retentionBackups" />, and
          deleted data persists in them until those expire.
        </Callout>
        <P>
          Removing a member from a school through the school dashboard marks their membership as
          removed. It is a membership change, not erasure, and it does not satisfy this clause.
        </P>
      </>
    ),
  },
  {
    id: "legal-retention",
    title: "Retention required by law",
    body: (
      <>
        <Lead>
          Where the law requires MyCodePad to retain personal data beyond the end of the contract,
          it will retain only what is required, for only as long as required, and will continue to
          protect it under this agreement.
        </Lead>
        <P>
          The main example is billing and tax records, retained for{" "}
          <Tbc id="retentionBillingRecords" />. MyCodePad will tell the School what has been
          retained and why, on request.
        </P>
      </>
    ),
  },
  {
    id: "school-responsibilities",
    title: "Responsibilities of the School and of MyCodePad",
    body: (
      <>
        <H3>The School</H3>
        <Bullets
          items={[
            "Determines the purposes and means of the processing it instructs, and is responsible for having a lawful basis for it.",
            "Provides its own privacy information to pupils, parents and staff. This page is not a substitute for the School's own privacy notice.",
            "Carries out any DPIA its own processing requires.",
            "Ensures instructions given through the platform are lawful, including decisions about who may see pupil work.",
            "Keeps its membership accurate, and removes staff and pupils who should no longer have access.",
            "Issues and controls invite codes responsibly; anyone holding a live code can join the School.",
            "Instructs pupils not to put sensitive personal information into free-text fields such as code, comments and quiz answers.",
            "Considers whether pupils should be permitted to publish work as public links, which the platform allows and which do not expire.",
          ]}
        />
        <H3>MyCodePad</H3>
        <Bullets
          items={[
            "Processes only on the School's documented instructions.",
            "Maintains the security measures in Appendix C and does not reduce the overall level of security during the contract.",
            "Maintains a record of processing carried out on the School's behalf under Article 30(2).",
            "Assists with rights requests, breaches, DPIAs and prior consultation as set out above.",
            "Does not use the School's personal data for its own purposes beyond the limits in clause 2.",
            "Does not sell personal data, and operates no advertising, marketing or profiling technology.",
          ]}
        />
      </>
    ),
  },
  {
    id: "contacts",
    title: "Contact points",
    body: (
      <>
        <Lead>
          Notices under this agreement should be sent to the addresses below. The School should
          give MyCodePad a named data protection contact and keep it current.
        </Lead>
        <ContactBlock />
      </>
    ),
  },
  {
    id: "appendix-a",
    title: "Appendix A — Description of the processing",
    body: (
      <>
        <Lead>
          Populated from the audit of the live database schema. Where a value could not be
          established from the implementation, it is marked rather than filled in.
        </Lead>
        <H3>A.1 Categories of data subject</H3>
        <Bullets
          items={[
            "Pupils of the School, including children.",
            "Teaching staff and tutors.",
            "School administrators.",
          ]}
        />
        <H3>A.2 Categories of personal data</H3>
        <InfoTable
          caption="Categories of personal data processed, with the tables they are held in"
          headers={["Category", "Contents", "Held in"]}
          rows={DATA_CATEGORIES.map((category) => [
            category.name,
            category.detail,
            <code key={category.name} className="font-mono text-xs">
              {category.source}
            </code>,
          ])}
        />
        <H3>A.3 Special category and criminal offence data</H3>
        <P>
          None requested or required. The platform provides no field for it. Free-text fields
          cannot be filtered, hence the School instruction in clause 18.
        </P>
        <H3>A.4 Purposes of the processing</H3>
        <P>
          As set out in clause 4. In summary: providing accounts, storing and displaying pupil
          work, running classes and assignments, recording marking and feedback, running starter
          quizzes, providing teacher-controlled AI assistance, administering school seats and
          invite codes, securing the service and supporting the School.
        </P>
        <H3>A.5 Frequency and duration</H3>
        <P>
          Continuous for the duration of the subscription: processing happens whenever a pupil or
          member of staff uses the platform.
        </P>
        <H3>A.6 Retention and deletion</H3>
        <InfoTable
          caption="Retention arrangements"
          headers={["Data", "Arrangement", "Status"]}
          rows={[
            [
              "Files deleted by a pupil or teacher",
              "Removed from the database, along with any public share link attached to them.",
              "Implemented",
            ],
            [
              "Classes deleted by a teacher",
              "The class and its enrolments are removed.",
              "Implemented",
            ],
            [
              "Sessions",
              "Expire on their own, and are revoked in bulk on password change or reset.",
              "Implemented",
            ],
            [
              "Password reset tokens",
              "Expire one hour after issue.",
              "Implemented",
            ],
            [
              "School membership after removal",
              "Marked as removed; the account and its work remain.",
              "Implemented — but not erasure",
            ],
            [
              "Erasure requests",
              "Recorded with a reference, a one month deadline, verification checks and an audit trail, and routed to the School for decision.",
              "Implemented — tracking only, not deletion",
            ],
            [
              "Account and work data after closure",
              <Tbc key="closure" id="retentionAfterAccountClosure" />,
              "Requestable and tracked; fulfilment is manual",
            ],
            [
              "The erasure request record itself",
              <Tbc key="erasurelog" id="erasureRecordRetention" />,
              "Holds the subject's name and email so the record survives the account",
            ],
            ["Backups", <Tbc key="backups" id="retentionBackups" />, "To be confirmed with provider"],
            [
              "Security logs, including failed join attempts with IP addresses",
              <Tbc key="logs" id="retentionSecurityLogs" />,
              "Not implemented — table is not pruned",
            ],
            [
              "End of school contract",
              <Tbc key="eoc" id="retentionSchoolEndOfContract" />,
              "Depends on a deletion routine that does not exist yet",
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "appendix-b",
    title: "Appendix B — Subprocessors",
    body: (
      <>
        <Lead>
          Every provider that receives personal data, identified by reading the application code
          rather than taken from a vendor list.
        </Lead>
        <InfoTable
          caption="Authorised subprocessors"
          headers={["Subprocessor", "Processing activity", "Personal data received", "Location"]}
          rows={SUBPROCESSORS.map((provider) => [
            provider.name,
            provider.role,
            provider.dataReceived,
            provider.location ? (
              <Tbc key={provider.name} id={provider.location} />
            ) : (
              "To be confirmed with the provider"
            ),
          ])}
        />
        <Callout tone="warning" title="Outstanding for this appendix">
          <Bullets
            items={[
              "The processing location of each provider must be confirmed, and the hosting and database regions read from live configuration.",
              "A signed data processing agreement with each provider must be obtained and kept on file.",
              "Whether the AI provider retains prompts, and whether it trains on them, must be confirmed in writing. Pupil code is sent to it.",
              "jsDelivr is a public CDN serving the Python runtime. Whether it is a subprocessor at all, or simply a third party the pupil's browser contacts directly, needs a legal view.",
            ]}
          />
        </Callout>
      </>
    ),
  },
  {
    id: "appendix-c",
    title: "Appendix C — Technical and organisational security measures",
    body: (
      <>
        <Lead>
          Measures implemented in the product today. Nothing is listed here that cannot be pointed
          at in the code.
        </Lead>
        <InfoTable
          caption="Implemented technical and organisational measures"
          headers={["Measure", "Implementation"]}
          rows={SECURITY_MEASURES.map((item) => [item.measure, item.detail])}
        />
        <H3>Measures not yet in place</H3>
        <P>
          Listed so that a school&apos;s security review starts from an accurate picture rather
          than discovering them later:
        </P>
        <Bullets
          items={[
            "No Content-Security-Policy or Permissions-Policy response header.",
            "No multi-factor authentication for any role, including school administrators.",
            "No email address verification at registration.",
            "No account deletion routine, and no database-level cascade from a user to most of their data.",
            "No pruning of the security log that records IP addresses.",
            "No expiry, password protection or oversight on public share links.",
            "No documented record of who holds production database access, and no documented support-access procedure.",
            "No penetration test or independent security assessment.",
          ]}
        />
      </>
    ),
  },
  {
    id: "status",
    title: "Status of this draft",
    body: (
      <>
        <Callout tone="warning" title="Do not sign this as it stands">
          <P>
            This is version {LEGAL_DOCUMENTS.dpa.version}. It is a drafting basis, written to
            track Article 28(3) clause by clause and to be honest about what the platform does and
            does not do yet. It has not been reviewed by a qualified adviser, has no effective
            date, and is not a substitute for a signed agreement.
          </P>
        </Callout>
        <P>
          The clauses most in need of review before a school relies on this document are the role
          allocation in clause 2, the breach notification deadline in clause 12, the transfer
          position in clause 14, the audit arrangements in clause 15, and the return and deletion
          obligation in clause 16 — which cannot currently be honoured because the deletion routine
          it depends on does not exist.
        </P>
        <P>
          Schools evaluating MyCodePad are welcome to send this page to their own data protection
          adviser and come back with requirements. Contact <Tbc id="privacyEmail" />.
        </P>
      </>
    ),
  },
]

export default async function DataProcessingAgreementPage() {
  const sessionUser = await getSessionUser()

  return (
    <LegalDocumentPage
      meta={LEGAL_DOCUMENTS.dpa}
      signedIn={Boolean(sessionUser)}
      sections={sections}
      intro={
        <>
          <Lead>
            This document sets out the processor terms MyCodePad offers schools under Article 28
            of UK GDPR, for the processing a school instructs when its pupils and staff use the
            platform.
          </Lead>
          <P>
            It is written to be checked rather than skimmed: each mandatory Article 28(3)
            requirement has its own clause, the appendices are populated from an audit of the
            actual database and provider calls, and the places where MyCodePad cannot yet meet a
            clause are stated in the clause itself rather than left for a school to discover.
          </P>
        </>
      }
    />
  )
}
