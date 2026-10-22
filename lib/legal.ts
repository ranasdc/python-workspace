/**
 * Configuration behind the Privacy Policy, Terms of Service and School DPA.
 *
 * Two kinds of information live here, and the distinction is the whole point of
 * the file:
 *
 *  1. FACTS (`LEGAL_FACTS`) — things only the operator can state: legal identity,
 *     contact addresses, ICO registration, governing law, retention periods,
 *     provider locations. Every one of these starts as `null`. A null fact
 *     renders as a visible "to be confirmed" marker on the page and appears in
 *     the pre-publication checklist, so an unanswered legal question can never
 *     be mistaken for an answered one.
 *
 *  2. AUDIT FINDINGS (everything below the facts) — things read directly out of
 *     this codebase: which tables hold personal data, which providers receive
 *     it, what deletion actually does today. These are asserted as fact because
 *     they were verified against the implementation, and each carries a note
 *     saying where it was verified.
 *
 * Nothing here is a secret, so it is plain configuration rather than
 * environment variables: the legal identity of the operator belongs in version
 * control where a change to it is reviewable.
 */

// ---------------------------------------------------------------------------
// 1. Facts the operator must supply
// ---------------------------------------------------------------------------

export type LegalFactId = keyof typeof LEGAL_FACTS

type Fact = {
  /** What the page is trying to say, used as the marker text and checklist row. */
  label: string
  /** Why it cannot be guessed. Shown in the checklist. */
  why: string
  /**
   * The answer. `null` until the operator fills it in.
   *
   * Never write a plausible-looking default here. A wrong company number or an
   * invented retention period is worse than a visible gap, because the gap is
   * the thing that tells a reviewer where to look.
   */
  value: string | null
}

export const LEGAL_FACTS = {
  // ----- Identity and contact -----
  operatorLegalName: {
    label: "registered legal name of the MyCodePad operator",
    why: "UK GDPR Article 13 requires the identity of the controller. Only the operator knows whether MyCodePad trades as a limited company, a sole trader or a partnership.",
    value: null,
  },
  operatorLegalForm: {
    label: "legal form (e.g. private limited company, sole trader)",
    why: "Determines what else must be published, including whether a company number and registered office exist at all.",
    value: null,
  },
  companyNumber: {
    label: "Companies House registration number",
    why: "Required on the website of a UK registered company. Not applicable to a sole trader.",
    value: null,
  },
  registeredAddress: {
    label: "registered or trading postal address",
    why: "Article 13 requires contact details for the controller, and schools need a service address for a signed DPA.",
    value: null,
  },
  privacyEmail: {
    label: "privacy and data protection contact address",
    why: "Data subject rights requests need a route that is actually monitored.",
    value: null,
  },
  securityEmail: {
    label: "security and breach notification contact address",
    why: "Article 33/34 breach handling and the DPA both depend on a reachable security contact.",
    value: null,
  },
  supportEmail: {
    label: "general support contact address",
    why: "Referenced by the Terms for service and billing queries.",
    value: null,
  },
  dpoStatus: {
    label: "whether a Data Protection Officer has been appointed, and their contact details",
    why: "Article 37 requires a DPO in some cases. Processing children's data at scale makes this a decision that must be taken deliberately and recorded, not assumed either way.",
    value: null,
  },
  icoRegistration: {
    label: "ICO data protection fee registration number",
    why: "Most UK controllers must pay the data protection fee and register. The number must not be invented, and registration status must be confirmed before it is claimed.",
    value: null,
  },
  ukRepresentative: {
    label: "UK or EU representative, if the operator is established outside the UK",
    why: "Article 27 may require a representative. Depends on where the operator is established.",
    value: null,
  },

  // ----- Legal framing -----
  governingLaw: {
    label: "governing law and jurisdiction for the Terms",
    why: "A jurisdiction clause is a commercial and legal decision, and consumer protection rules limit what can be imposed on UK consumers.",
    value: null,
  },
  minimumAge: {
    label: "minimum age for a self-registered individual account",
    why: "There is no age gate in the product today. The threshold is a policy decision with direct Children's Code and lawful-basis consequences.",
    value: null,
  },
  consumerCancellation: {
    label: "statutory cancellation / cooling-off position for individual subscriptions",
    why: "The Consumer Contracts Regulations give a 14 day right to cancel distance contracts, with specific rules where a digital service starts immediately. How this is handled must be confirmed before it is described.",
    value: null,
  },
  refundPolicy: {
    label: "refund policy beyond statutory rights",
    why: "No refund logic exists in the billing code. Any discretionary refund promise is a commercial commitment.",
    value: null,
  },
  vatPosition: {
    label: "VAT registration status and whether listed prices include VAT",
    why: "Stripe is configured with plain GBP amounts and no tax behaviour, so the published prices cannot be described as VAT-inclusive or exclusive until this is confirmed.",
    value: null,
  },
  supportResponseTarget: {
    label: "support response target, if any is offered",
    why: "Several plans advertise \"priority support\". What that means in practice is a commitment that has to be set deliberately.",
    value: null,
  },
  complaintsProcess: {
    label: "internal complaints process and escalation route",
    why: "Referenced by both the Terms and the Privacy Policy, and expected by schools procuring the service.",
    value: null,
  },

  // ----- Retention -----
  retentionAfterAccountClosure: {
    label: "retention period for account and work data after an account is closed",
    why: "No account deletion exists in the product yet, so there is no implemented period to describe. See the technical gaps list.",
    value: null,
  },
  retentionBackups: {
    label: "backup retention window and the point at which deletions reach backups",
    why: "Set by the database provider's configured plan and by operator choice, and must be read from the live Neon project rather than assumed.",
    value: null,
  },
  retentionBillingRecords: {
    label: "retention period for billing and tax records",
    why: "UK tax law sets minimum record-keeping periods, which interact with deletion requests. The applicable period depends on the operator's legal form.",
    value: null,
  },
  retentionSecurityLogs: {
    label: "retention period for security logs, including failed join-code attempts",
    why: "Failed join attempts record raw IP addresses and are not pruned by any code in this repository.",
    value: null,
  },
  retentionInactiveAccounts: {
    label: "whether dormant accounts are deleted, and after how long",
    why: "Storage limitation requires data not to be kept indefinitely without reason. No dormancy policy is implemented.",
    value: null,
  },
  retentionSchoolEndOfContract: {
    label: "period within which school data is returned or deleted at the end of a contract",
    why: "Article 28(3)(g) requires the processor to delete or return personal data at the end of the service. The window is a contractual term.",
    value: null,
  },

  // ----- Infrastructure facts to verify -----
  hostingRegion: {
    label: "Vercel deployment region(s)",
    why: "Determines where the application runs and whether a transfer outside the UK occurs. Must be read from the live Vercel project configuration.",
    value: null,
  },
  databaseRegion: {
    label: "Neon database region",
    why: "Determines where personal data is stored at rest. Must be read from the live Neon project.",
    value: null,
  },
  transferMechanism: {
    label: "transfer mechanism relied on for any processing outside the UK",
    why: "The UK Addendum to the EU SCCs, the IDTA or adequacy may apply. Which one, for which provider, is a legal determination.",
    value: null,
  },
  breachNotificationWindow: {
    label: "deadline for notifying a school of a personal data breach",
    why: "Article 33(2) requires notification \"without undue delay\". A specific number of hours is a contractual promise that the operator must be able to meet.",
    value: null,
  },
  auditArrangements: {
    label: "audit and inspection arrangements offered to schools",
    why: "Article 28(3)(h) requires audits to be permitted. The practical form — questionnaire, report, on-site — is negotiated.",
    value: null,
  },
  securityCertifications: {
    label: "security certifications held, if any (e.g. Cyber Essentials, ISO 27001)",
    why: "Schools routinely ask. Claiming a certification that is not held is a misrepresentation.",
    value: null,
  },
  subprocessorNoticePeriod: {
    label: "notice period before a new subprocessor is added",
    why: "Article 28(2) requires the controller to have an opportunity to object to changes.",
    value: null,
  },
  dpiaStatus: {
    label: "whether a DPIA has been carried out, by whom and when",
    why: "Processing children's personal data at scale is likely to require a DPIA under Article 35. No assessment is recorded in this repository.",
    value: null,
  },
} satisfies Record<string, Fact>

/** The value of a fact, or null when the operator has not supplied it yet. */
export function factValue(id: LegalFactId): string | null {
  return LEGAL_FACTS[id].value
}

export type PlaceholderRow = { id: LegalFactId; label: string; why: string }

/**
 * Every fact still missing, in declaration order.
 *
 * Drives both the on-page draft banner and the publication checklist, so the
 * page cannot claim to be ready while the checklist still has rows.
 */
export function unresolvedFacts(): PlaceholderRow[] {
  return (Object.keys(LEGAL_FACTS) as LegalFactId[])
    .filter((id) => LEGAL_FACTS[id].value === null)
    .map((id) => ({ id, label: LEGAL_FACTS[id].label, why: LEGAL_FACTS[id].why }))
}

/** True once every fact above has been answered. */
export function isReadyForPublication(): boolean {
  return unresolvedFacts().length === 0
}

// ---------------------------------------------------------------------------
// 2. Document metadata
// ---------------------------------------------------------------------------

export type LegalDocumentMeta = {
  title: string
  path: string
  /** One sentence for the page header and the meta description. */
  summary: string
  version: string
  /**
   * The date the document takes effect. Null until it is published, because a
   * date printed before legal review would imply the text is in force.
   */
  effectiveDate: string | null
  lastReviewed: string | null
}

export const LEGAL_DOCUMENTS = {
  privacy: {
    title: "Privacy Policy",
    path: "/privacy",
    summary:
      "How MyCodePad collects, uses, shares and protects personal data, and the rights you have over it.",
    version: "0.1 — draft for legal review",
    effectiveDate: null,
    lastReviewed: null,
  },
  terms: {
    title: "Terms of Service",
    path: "/terms",
    summary:
      "The terms on which students, teachers, tutors and schools may use MyCodePad.",
    version: "0.1 — draft for legal review",
    effectiveDate: null,
    lastReviewed: null,
  },
  dpa: {
    title: "School Data Processing Agreement",
    path: "/data-processing-agreement",
    summary:
      "The Article 28 processor terms offered to schools where the school is the controller and MyCodePad processes personal data on its instructions.",
    version: "0.1 — draft for legal review",
    effectiveDate: null,
    lastReviewed: null,
  },
} satisfies Record<string, LegalDocumentMeta>

export const LEGAL_LINKS = [
  { label: "Privacy Policy", href: LEGAL_DOCUMENTS.privacy.path },
  { label: "Terms of Service", href: LEGAL_DOCUMENTS.terms.path },
  { label: "School DPA", href: LEGAL_DOCUMENTS.dpa.path },
]

// ---------------------------------------------------------------------------
// 3. Audit findings — verified against this codebase
// ---------------------------------------------------------------------------

export type DataCategory = {
  name: string
  /** The specific fields or tables involved, named so a reviewer can check. */
  detail: string
  /** Where in the codebase this was verified. */
  source: string
}

/**
 * What the database actually holds, read from lib/db/schema.ts.
 *
 * Grouped the way a reader thinks about it rather than the way the tables are
 * laid out, but every entry names its tables so the mapping stays checkable.
 */
export const DATA_CATEGORIES: DataCategory[] = [
  {
    name: "Account identity",
    detail:
      "Name, email address, role (student or teacher), account type, chosen avatar key, first-login and onboarding flags, the last editor opened, and created/updated timestamps.",
    source: "user table",
  },
  {
    name: "Authentication credentials",
    detail:
      "A hashed password, managed by Better Auth. Password reset tokens with expiry times. MyCodePad never stores a password in a form it can read.",
    source: "account.password, verification tables",
  },
  {
    name: "Session records",
    detail:
      "A session token, its expiry, and the IP address and browser user-agent recorded when the session was created.",
    source: "session table",
  },
  {
    name: "Code and project work",
    detail:
      "The contents of every file a user writes, its name, language and folder, the pupil's version from immediately before any teacher correction, and marking status.",
    source: "code_file, student_folder tables",
  },
  {
    name: "Teacher feedback and corrections",
    detail:
      "Comments left on a pupil's file with the teacher's name, the pupil's reaction to each comment and when they gave it, and an attributed record of any line a teacher edited directly.",
    source: "file_comment, code_file.teacherEditedBy* columns",
  },
  {
    name: "Tasks and lesson material",
    detail:
      "Teacher-authored task instructions, topic, difficulty, year group and learning objective, plus worked solutions that are never served to a student.",
    source: "file_task, library_file, library_folder tables",
  },
  {
    name: "Starter quiz activity",
    detail:
      "A pupil's answers, score and total for each daily starter, the frozen record of their first attempt, when they opened it and when they submitted.",
    source: "daily_starter_response, daily_starter_open tables",
  },
  {
    name: "Class and school membership",
    detail:
      "Which classes a pupil is enrolled in, which teacher owns each class, school membership with its role and active/removed status, and which invite code a member redeemed.",
    source: "enrollment, class, school_member, invite_code tables",
  },
  {
    name: "AI help activity",
    detail:
      "A record of each request to unlock AI error help, tied to the pupil, the file and a signature of the error, with the time the hint becomes available.",
    source: "ai_help_unlock table",
  },
  {
    name: "Subscription and billing",
    detail:
      "Plan, status, billing interval, Stripe customer and subscription identifiers, the price identifier, the current period end and whether a cancellation is scheduled. Card details are handled by Stripe and never reach MyCodePad.",
    source: "subscription, school_subscription, stripe_event tables; lib/checkout.ts",
  },
  {
    name: "Security logs",
    detail:
      "Failed class join-code attempts, recorded against both the user and the raw IP address they came from, so a guessing attack can be throttled.",
    source: "join_attempt table; app/actions/classes.ts",
  },
  {
    name: "Public share links",
    detail:
      "Where a file has been published as a link, the random token, who owns the file and whether the link has been revoked. Anyone holding a live token can read that file without an account.",
    source: "file_share table; app/s/[token]",
  },
]

export type Subprocessor = {
  name: string
  role: string
  /** The personal data this provider actually receives, from the audit. */
  dataReceived: string
  /** Null where the location has not been verified against live configuration. */
  location: LegalFactId | null
  source: string
}

/**
 * Providers that receive personal data, confirmed by reading the code.
 *
 * Locations point at an unresolved fact rather than naming a region, because a
 * provider's default region is not evidence of where this deployment runs.
 */
export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Vercel",
    role: "Application hosting, serverless execution and privacy-friendly page analytics",
    dataReceived:
      "Everything processed in a request, in transit. Analytics is enabled in production only and records page views without cookies.",
    location: "hostingRegion",
    source: "app/layout.tsx, @vercel/analytics",
  },
  {
    name: "Neon",
    role: "Managed PostgreSQL database",
    dataReceived: "All stored personal data listed above.",
    location: "databaseRegion",
    source: "lib/db/index.ts, DATABASE_URL",
  },
  {
    name: "Stripe",
    role: "Payment processing and subscription billing",
    dataReceived:
      "The billing email address passed to Checkout, plus the payment details the customer enters directly with Stripe. MyCodePad stores only Stripe's identifiers in return.",
    location: null,
    source: "lib/checkout.ts, lib/stripe.ts, app/api/stripe/webhook",
  },
  {
    name: "Resend",
    role: "Transactional email delivery",
    dataReceived:
      "Recipient email address, name where the template uses it, and message content for welcome and password reset emails.",
    location: null,
    source: "lib/email.ts, lib/transactional-emails.ts",
  },
  {
    name: "Vercel AI Gateway and OpenAI",
    role: "AI error help, task generation and starter generation",
    dataReceived:
      "For error help, the pupil's code (up to 8,000 characters) and the error message their program produced. For task and starter generation, the teacher's topic, year group and objective. No name, email or account identifier is included in the prompt.",
    location: null,
    source: "app/api/error-help, app/api/generate-task, lib/starter-generator.ts",
  },
  {
    name: "jsDelivr",
    role: "Public CDN serving the Pyodide runtime that executes Python in the browser",
    dataReceived:
      "The browser's IP address and request headers when it downloads the runtime. No account data is sent, and the code a pupil writes is executed locally in their own browser rather than uploaded.",
    location: null,
    source: "public/pyodide-worker.js",
  },
]

export type BrowserStorageItem = {
  name: string
  kind: "Cookie" | "Local storage" | "Session storage"
  purpose: string
  essential: boolean
  source: string
}

/**
 * Every client-side storage key the application sets, found by searching for
 * cookie, localStorage and sessionStorage use.
 *
 * The conclusion this table supports: there is no advertising, cross-site or
 * profiling technology in the product, so there is nothing to ask consent for
 * and a consent banner would be decorative. If that ever changes, this table
 * is the thing that has to change with it.
 */
export const BROWSER_STORAGE: BrowserStorageItem[] = [
  {
    name: "Better Auth session cookie",
    kind: "Cookie",
    purpose:
      "Keeps you signed in and ties each request to your account. Without it there is no way to stay logged in.",
    essential: true,
    source: "better-auth, lib/auth.ts",
  },
  {
    name: "mcp:task-panel-width, mcp:task-pinned",
    kind: "Local storage",
    purpose: "Remembers how wide the task panel was and whether it was pinned open.",
    essential: false,
    source: "components/student-workspace.tsx",
  },
  {
    name: "mcp:task-seen",
    kind: "Local storage",
    purpose:
      "Remembers which task versions you have already read, so an unchanged task does not reopen itself.",
    essential: false,
    source: "components/student-workspace.tsx",
  },
  {
    name: "Panel collapse state",
    kind: "Local storage",
    purpose: "Remembers which editor panels you collapsed.",
    essential: false,
    source: "components/ide/collapsible-panel.tsx",
  },
  {
    name: "AI hint cache",
    kind: "Local storage",
    purpose:
      "Keeps the last AI hint for a file in your own browser so reopening the file does not spend another request.",
    essential: false,
    source: "components/error-helper.tsx",
  },
  {
    name: "Install prompt flag",
    kind: "Local storage",
    purpose: "Records that the app-install suggestion has been shown, so it is not shown repeatedly.",
    essential: false,
    source: "components/pwa/install-suggestion.tsx",
  },
]

export type SecurityMeasure = { measure: string; detail: string }

/**
 * Security measures that are actually implemented. Each one was read out of the
 * code, so each can be defended in a school's security questionnaire.
 */
export const SECURITY_MEASURES: SecurityMeasure[] = [
  {
    measure: "Password storage",
    detail:
      "Passwords are hashed by Better Auth and never stored in readable form. Changing a password requires the current one, and succeeds only by signing every other device out.",
  },
  {
    measure: "Session invalidation on password reset",
    detail:
      "Completing a password reset revokes every existing session for that account, on the assumption that the old password may be compromised.",
  },
  {
    measure: "Server-side authorisation on every read",
    detail:
      "Access to a class, a file or a task is resolved on the server from the session, not from anything the browser sends. Hiding a control in the interface is never the only barrier.",
  },
  {
    measure: "Role escalation blocked at the database layer",
    detail:
      "The role requested at sign-up is clamped to student or teacher before the user row is created, and the account endpoints strip role changes, so school administrator cannot be self-granted.",
  },
  {
    measure: "Teacher-only fields never selected for students",
    detail:
      "Student-facing queries list their columns explicitly rather than returning whole rows, which is what keeps worked solutions out of a pupil's response.",
  },
  {
    measure: "Durable throttling of class join codes",
    detail:
      "A join code is a bearer credential, so failed attempts are counted in the database against both the account and the IP address. The limit therefore survives cold starts and cannot be spread across serverless instances.",
  },
  {
    measure: "Webhook replay protection",
    detail:
      "Stripe events are recorded by identifier once processed, so a retried webhook cannot apply the same billing change twice.",
  },
  {
    measure: "Transport security and browser hardening",
    detail:
      "HSTS, X-Content-Type-Options, Referrer-Policy and cross-origin isolation headers are set for every route. Traffic to the database and to every provider is encrypted in transit.",
  },
  {
    measure: "Sandboxed code execution",
    detail:
      "Python runs in a web worker inside the pupil's own browser, and HTML previews render in a sandboxed frame that cannot reach the parent page, its cookies or the session that owns it.",
  },
  {
    measure: "Restrained logging",
    detail:
      "Email delivery failures are logged without the recipient address or message body outside development.",
  },
]

/**
 * Gaps found during the audit that are code problems, not drafting problems.
 *
 * Deliberately part of the legal configuration rather than a separate document:
 * several statements in these policies are only true once these are fixed, and
 * keeping them adjacent makes that dependency hard to lose track of.
 */
export const TECHNICAL_GAPS: { gap: string; impact: string; area: string }[] = [
  {
    area: "Right to erasure",
    gap: "There is no account deletion anywhere in the product. The account area can change a display name, an avatar and a password, and nothing else.",
    impact:
      "An Article 17 erasure request cannot be fulfilled through the product and would have to be carried out by hand against the database. The Privacy Policy cannot describe a self-service deletion route until one exists.",
  },
  {
    area: "Right to data portability",
    gap: "Files can be downloaded individually or as a zip from the editor, but there is no export of account data, class membership, feedback, starter results or billing history.",
    impact:
      "An Article 20 portability request is only partly satisfiable today.",
  },
  {
    area: "Deletion cascade",
    gap: "Most application tables reference users and classes by plain text or integer columns with no foreign key, so deleting a user row would leave their files, enrolments, comments, starter responses and share links behind. Only session, account, subscription, school and school_member cascade.",
    impact:
      "Any deletion routine must be written explicitly and tested, table by table. A naive delete would orphan personal data rather than remove it.",
  },
  {
    area: "School member removal",
    gap: "Removing a member from a school sets their status to removed and leaves the membership row, their classes, their files and their work in place.",
    impact:
      "Accurate as a membership record, but it means leaving a school is not erasure, and the Privacy Policy must not imply otherwise.",
  },
  {
    area: "Security log retention",
    gap: "Failed join attempts store the raw IP address and no code prunes the table.",
    impact:
      "Personal data in a security log accumulates indefinitely, which conflicts with storage limitation. A retention window and a pruning job are needed.",
  },
  {
    area: "Public share links",
    gap: "A published file is readable by anyone holding the token, with no expiry, no password and no indication to a pupil's teacher or school that the link exists.",
    impact:
      "This is the product's main route for a child's work to leave the platform. The Children's Code expects sharing to be off by default and easy to understand; a review of who may publish, and whether links should expire, is needed.",
  },
  {
    area: "Age assurance",
    gap: "Sign-up collects a name, an email address and a role. There is no date of birth, no age band and no age gate.",
    impact:
      "The operator cannot currently tell whether a self-registering user is a child, which affects the lawful basis for individual accounts and the Children's Code risk assessment.",
  },
  {
    area: "Email verification",
    gap: "Email addresses are not verified, so an account can be created against an address the registrant does not control.",
    impact:
      "Affects the reliability of the email channel for rights requests and security notices.",
  },
  {
    area: "Content Security Policy",
    gap: "Useful response headers are set, but there is no Content-Security-Policy and no Permissions-Policy.",
    impact:
      "Defence in depth only, but a CSP is a common expectation in school security reviews.",
  },
]

/**
 * Children's Code review points. Each is a question the operator has to answer,
 * paired with what the audit found so the answer starts from evidence.
 */
export const CHILDRENS_CODE_REVIEW: { standard: string; finding: string; action: string }[] = [
  {
    standard: "Best interests of the child",
    finding:
      "The product is built around classroom use, with teacher oversight of pupil work and a teacher control that delays AI help so pupils attempt problems first.",
    action:
      "Record this reasoning in a DPIA rather than leaving it implicit in the code.",
  },
  {
    standard: "Data protection impact assessment",
    finding: "No DPIA is recorded in this repository.",
    action:
      "Carry one out before launch. Processing children's data at scale makes it likely to be mandatory under Article 35.",
  },
  {
    standard: "Age-appropriate application",
    finding: "No age is collected, so no age-appropriate variation is possible.",
    action: "Decide the minimum age and how age is established for self-registration.",
  },
  {
    standard: "Transparency",
    finding:
      "Until now there was no privacy information at all. This policy is written in plain English, but it is written for an adult reader.",
    action:
      "Produce a short child-facing summary for the pupil experience in addition to this policy.",
  },
  {
    standard: "Detrimental use of data",
    finding:
      "No advertising, marketing or behavioural technology exists anywhere in the codebase.",
    action: "Keep it that way as an explicit policy, not as an accident of implementation.",
  },
  {
    standard: "Data minimisation",
    finding:
      "Registration collects only a name, an email address and a role. Session rows additionally hold IP address and user-agent, and failed join attempts hold raw IP addresses.",
    action:
      "Confirm the IP address retention is necessary and proportionate, and bound it with a retention period.",
  },
  {
    standard: "Data sharing",
    finding:
      "Pupil work is visible to the teacher who owns the class and, for schools, through that school's administration. It is not shared with any other user.",
    action: "Confirm this matches what schools and parents are told.",
  },
  {
    standard: "Default settings and sharing",
    finding:
      "Files are private by default. Public sharing is off until a user publishes a link, but once published the link does not expire and cannot be password protected.",
    action:
      "Decide whether pupils should be able to publish at all, and whether links should expire.",
  },
  {
    standard: "Profiling",
    finding:
      "No profiling exists. Scores and marking status are recorded and shown to the pupil's own teacher, but nothing is inferred, ranked or predicted from them automatically.",
    action: "Confirm as policy, and keep AI features assistive rather than evaluative.",
  },
  {
    standard: "Parental controls and oversight",
    finding:
      "There is no parent-facing view and no notification to a child that a teacher has viewed or edited their work, although teacher corrections are always attributed and the pupil's prior version is preserved.",
    action:
      "Decide what pupils should be told about teacher visibility, and say it where they will see it.",
  },
]
