import type { ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, FileWarning, Mail } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { MarketingShell } from "@/components/marketing/marketing-chrome"
import {
  factValue,
  unresolvedFacts,
  LEGAL_LINKS,
  type LegalDocumentMeta,
  type LegalFactId,
} from "@/lib/legal"

/**
 * Presentation for the three legal documents.
 *
 * The documents are supplied as data — an ordered list of sections, each with
 * an id, a title and a body — so the contents list and the headings are
 * generated from the same array and cannot drift apart. Adding a section to a
 * policy therefore cannot leave it missing from its own table of contents.
 */

export type LegalSection = {
  id: string
  title: string
  body: ReactNode
}

// ---------------------------------------------------------------------------
// Inline building blocks for document bodies
// ---------------------------------------------------------------------------

export function P({ children }: { children: ReactNode }) {
  return <p className="text-pretty leading-7 text-muted-foreground">{children}</p>
}

/** The opening sentence of a section, set slightly stronger than body copy. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-pretty leading-7 text-foreground">{children}</p>
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-base font-semibold text-foreground">{children}</h3>
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 leading-7 text-muted-foreground marker:text-border">
      {items.map((item, i) => (
        <li key={i} className="pl-1">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function Numbered({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 leading-7 text-muted-foreground marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="pl-1">
          {item}
        </li>
      ))}
    </ol>
  )
}

/**
 * An unanswered legal or factual question, rendered where the answer belongs.
 *
 * Visually loud on purpose. A gap in a privacy policy that looks like prose is
 * the failure mode this component exists to prevent: a reader must be able to
 * tell at a glance that nobody has decided this yet.
 */
export function Tbc({ id }: { id: LegalFactId }) {
  const value = factValue(id)
  if (value) return <>{value}</>

  const { label } = unresolvedFacts().find((f) => f.id === id) ?? { label: id }
  return (
    <mark className="mx-0.5 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 align-baseline text-[0.8125rem] font-medium text-amber-700 dark:text-amber-400">
      <span className="sr-only">To be confirmed: </span>
      {label}
      <span aria-hidden="true"> ?</span>
    </mark>
  )
}

/** A note explaining something the reader should not have to infer. */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning"
  title?: string
  children: ReactNode
}) {
  const warning = tone === "warning"
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3 text-sm leading-6",
        warning
          ? "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          : "border-border bg-muted/40 text-muted-foreground",
      ].join(" ")}
    >
      {title && (
        <p
          className={[
            "mb-1 font-semibold",
            warning ? "text-amber-700 dark:text-amber-300" : "text-foreground",
          ].join(" ")}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

/** A simple two- or three-column reference table. */
export function InfoTable({
  caption,
  headers,
  rows,
}: {
  caption?: string
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-2.5 font-semibold text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={[
                    "px-4 py-3 leading-6",
                    j === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The privacy contact block, repeated across all three documents. */
export function ContactBlock() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3.5 text-sm">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Mail className="h-4 w-4" aria-hidden="true" />
        Contacting MyCodePad about personal data
      </p>
      <dl className="flex flex-col gap-1.5 text-muted-foreground">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Operator:</dt>
          <dd>
            <Tbc id="operatorLegalName" />
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Postal address:</dt>
          <dd>
            <Tbc id="registeredAddress" />
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Privacy enquiries:</dt>
          <dd>
            <Tbc id="privacyEmail" />
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Security and breaches:</dt>
          <dd>
            <Tbc id="securityEmail" />
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Data Protection Officer:</dt>
          <dd>
            <Tbc id="dpoStatus" />
          </dd>
        </div>
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

function DraftBanner({ title }: { title: string }) {
  const outstanding = unresolvedFacts()
  if (outstanding.length === 0) return null

  return (
    <aside
      aria-labelledby="draft-notice-heading"
      className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2">
          <h2
            id="draft-notice-heading"
            className="font-semibold text-amber-800 dark:text-amber-300"
          >
            Draft — not yet in force
          </h2>
          <p className="text-pretty text-sm leading-6 text-amber-900/90 dark:text-amber-200/90">
            This {title} has not been reviewed by a qualified adviser and has no effective date.
            It describes how MyCodePad is actually built, but {outstanding.length} legal or
            factual {outstanding.length === 1 ? "question has" : "questions have"} not been
            answered yet. Each one is marked in the text below and listed in the
            pre-publication checklist at the end. MyCodePad should not be described as
            compliant with UK GDPR or the Data Protection Act 2018 on the strength of this
            page alone.
          </p>
        </div>
      </div>
    </aside>
  )
}

function PublicationChecklist() {
  const outstanding = unresolvedFacts()
  if (outstanding.length === 0) return null

  return (
    <section
      id="checklist"
      aria-labelledby="publication-checklist"
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h2 id="publication-checklist" className="text-xl font-semibold tracking-tight">
          Pre-publication checklist
        </h2>
      </div>
      <P>
        Every item below is marked somewhere in these documents and must be resolved before any
        of them is published or relied upon. They are listed here as well so the list can be
        worked through in one pass.
      </P>
      <ol className="flex flex-col gap-3">
        {outstanding.map((fact, i) => (
          <li
            key={fact.id}
            className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">
                {fact.label.charAt(0).toUpperCase() + fact.label.slice(1)}
              </p>
              <p className="leading-6 text-muted-foreground">{fact.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <Callout>
        Each item corresponds to an entry in{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">lib/legal.ts</code>.
        Filling in its <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">value</code>{" "}
        replaces the marker everywhere it appears and removes this row.
      </Callout>
    </section>
  )
}

function Contents({ sections }: { sections: LegalSection[] }) {
  return (
    <nav aria-labelledby="contents-heading" className="flex flex-col gap-3">
      <h2
        id="contents-heading"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Contents
      </h2>
      <ol className="flex flex-col gap-1.5 text-sm">
        {sections.map((section, i) => (
          <li key={section.id} className="flex gap-2">
            <span className="shrink-0 font-mono text-xs leading-6 text-muted-foreground/70">
              {i + 1}.
            </span>
            <a
              href={`#${section.id}`}
              className="text-pretty leading-6 text-muted-foreground transition-colors hover:text-foreground"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function OtherDocuments({ currentPath }: { currentPath: string }) {
  const others = LEGAL_LINKS.filter((link) => link.href !== currentPath)
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Related documents
      </h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {others.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A complete legal document page, including the public site header and footer
 * so these pages are reachable and navigable while signed out.
 */
export function LegalDocumentPage({
  meta,
  signedIn,
  intro,
  sections,
}: {
  meta: LegalDocumentMeta
  signedIn: boolean
  /** One or two paragraphs before the numbered sections begin. */
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <MarketingShell signedIn={signedIn}>
      <article className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{meta.version}</Badge>
            <Badge variant="outline">
              {meta.effectiveDate ? `Effective ${meta.effectiveDate}` : "No effective date"}
            </Badge>
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {meta.title}
          </h1>
          <p className="max-w-2xl text-pretty leading-7 text-muted-foreground">{meta.summary}</p>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <div className="flex min-w-0 flex-col gap-10">
            <DraftBanner title={meta.title.toLowerCase()} />

            <div className="flex flex-col gap-4">{intro}</div>

            {sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="flex scroll-mt-24 flex-col gap-4"
              >
                <h2
                  id={`${section.id}-heading`}
                  className="text-balance text-xl font-semibold tracking-tight"
                >
                  <span className="mr-2 font-mono text-base font-normal text-muted-foreground">
                    {i + 1}.
                  </span>
                  {section.title}
                </h2>
                {section.body}
              </section>
            ))}

            <hr className="border-border" />
            <PublicationChecklist />
          </div>

          {/* Sidebar comes after the document in source order so a screen reader
              and a crawler both reach the policy itself first. */}
          <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:order-first lg:h-fit">
            <Contents sections={sections} />
            <OtherDocuments currentPath={meta.path} />
          </aside>
        </div>
      </article>
    </MarketingShell>
  )
}
