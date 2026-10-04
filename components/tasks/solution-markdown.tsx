import { Fragment, type ReactNode } from "react"

/**
 * A small renderer for the markdown the solution generator writes: headings,
 * bullet lists, paragraphs, inline code, bold and fenced code blocks. Kept
 * deliberately narrow rather than pulling in a markdown dependency, and it
 * never injects HTML, so model output cannot run script in the teacher's page.
 */
export function SolutionMarkdown({ text }: { text: string }) {
  // Splitting on fences alternates prose (even) and code (odd).
  const segments = text.split(/```[\w+#.-]*\n?/)
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {segments.map((segment, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed"
          >
            <code>{segment.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          <Prose key={i} text={segment} />
        ),
      )}
    </div>
  )
}

function Prose({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (!list.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) {
      flushList()
      continue
    }
    const bullet = line.match(/^(?:[-*]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flushList()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    blocks.push(
      heading ? (
        <h4 key={blocks.length} className="pt-1 font-semibold text-foreground">
          {inline(heading[1])}
        </h4>
      ) : (
        <p key={blocks.length} className="text-foreground/90">
          {inline(line)}
        </p>
      ),
    )
  }
  flushList()
  return <>{blocks}</>
}

function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
