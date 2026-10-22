"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LANGUAGES, LANGUAGE_ORDER, isLanguageId } from "@/lib/ide/languages"

/**
 * One row in a reuse list: a starter, a task, or whatever a teacher next wants
 * to copy from one class to another.
 *
 * Both reuse windows present the same decision — "which of the things I have
 * already made do I want again?" — so they share one list rather than growing
 * two that drift apart. The language is a plain string because it arrives from
 * a database column; anything the registry does not recognise is still shown,
 * under its own heading, instead of being dropped.
 */
export type ReuseItem = {
  id: number
  language: string
  title: string
  /** One muted line under the title: the topic, or the opening instructions. */
  preview?: string
  /** Dot-separated context: the class or file it came from, the date, counts. */
  facts: string[]
  /** Short labels on the right, e.g. "Draft" or "Solution included". */
  tags?: string[]
}

type LanguageGroup = {
  key: string
  label: string
  accent: string
  items: ReuseItem[]
}

/**
 * Group the list by programming language, in the registry's own display order,
 * with the language the teacher is currently working in first. A Year 9 Python
 * lesson is never looking for an HTML starter, so the right group is the one
 * already under the cursor.
 */
function groupByLanguage(items: ReuseItem[], preferred?: string): LanguageGroup[] {
  const buckets = new Map<string, ReuseItem[]>()
  for (const item of items) {
    const bucket = buckets.get(item.language)
    if (bucket) bucket.push(item)
    else buckets.set(item.language, [item])
  }

  const order: string[] = []
  for (const id of LANGUAGE_ORDER) if (buckets.has(id)) order.push(id)
  for (const key of buckets.keys()) if (!order.includes(key)) order.push(key)
  if (preferred && order.includes(preferred)) {
    order.splice(order.indexOf(preferred), 1)
    order.unshift(preferred)
  }

  return order.map((key) => ({
    key,
    label: isLanguageId(key) ? LANGUAGES[key].label : key,
    accent: isLanguageId(key) ? LANGUAGES[key].accent : "var(--muted-foreground)",
    items: buckets.get(key) ?? [],
  }))
}

function matches(item: ReuseItem, query: string) {
  const haystack = [item.title, item.preview ?? "", ...item.facts, ...(item.tags ?? [])]
    .join(" ")
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

export function ReusePicker({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder = "Search by title, topic or class",
  emptyTitle,
  emptyHint,
  preferredLanguage,
  load,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  searchPlaceholder?: string
  emptyTitle: string
  emptyHint: string
  /** Shown first, so the teacher's current IDE is the group they land on. */
  preferredLanguage?: string
  load: () => Promise<ReuseItem[]>
  /** Resolve to apply and close; throw to leave the window open. */
  onPick: (item: ReuseItem) => Promise<void>
}) {
  const [items, setItems] = useState<ReuseItem[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState("")
  const [picking, setPicking] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    setItems(null)
    setError(false)
    load()
      .then((rows) => active && setItems(rows))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
    // `load` is a fresh closure on every render of the parent, so it is not a
    // dependency: the list is fetched when the window opens, and on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reloadKey])

  const groups = useMemo(() => {
    if (!items) return []
    const filtered = query.trim() ? items.filter((i) => matches(i, query.trim())) : items
    return groupByLanguage(filtered, preferredLanguage).filter((g) => g.items.length > 0)
  }, [items, query, preferredLanguage])

  const visible = groups.reduce((n, g) => n + g.items.length, 0)

  async function pick(item: ReuseItem) {
    setPicking(item.id)
    try {
      await onPick(item)
      onOpenChange(false)
      setQuery("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy that one. Please try again.")
    } finally {
      setPicking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[92vw] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-6 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items === null && !error && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> Loading...
            </p>
          )}

          {error && (
            <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">That list could not be loaded.</p>
              <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Try again
              </Button>
            </div>
          )}

          {items !== null && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="max-w-sm text-sm text-pretty text-muted-foreground">{emptyHint}</p>
            </div>
          )}

          {items !== null && items.length > 0 && visible === 0 && (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}

          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-muted/80 px-6 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: group.accent }}
                  aria-hidden
                />
                {group.label}
                <span className="font-normal text-muted-foreground normal-case">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"}
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pick(item)}
                      disabled={picking !== null}
                      className="flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.preview && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {item.preview}
                          </span>
                        )}
                        {item.facts.length > 0 && (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {item.facts.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        {item.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-normal">
                            {tag}
                          </Badge>
                        ))}
                        {picking === item.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={picking !== null}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
