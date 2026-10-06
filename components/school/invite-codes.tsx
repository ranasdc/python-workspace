"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createInviteCode,
  getInviteCodeUsage,
  regenerateInviteCode,
  setInviteCodeActive,
} from "@/app/actions/schools"
import {
  MAX_INVITE_DAYS,
  MAX_INVITE_USES,
  type InviteCodeMember,
  type SchoolInviteCode,
} from "@/lib/invite-codes"

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Expiry choices, filtered against the server's own ceiling so the form can
 * never offer a window the create action would reject.
 *
 * Keyed by the string the Select stores, which is also what Base UI needs in
 * order to label the closed trigger with "In 30 days" rather than "30".
 */
const EXPIRY_OPTIONS: Record<string, string> = {
  never: "Never",
  ...Object.fromEntries(
    [
      [7, "In 7 days"],
      [30, "In 30 days"],
      [90, "In 90 days"],
      [365, "In a year"],
    ]
      .filter(([days]) => (days as number) <= MAX_INVITE_DAYS)
      .map(([days, label]) => [String(days), label]),
  ),
}

type CodeState =
  | { kind: "active"; label: null }
  | { kind: "disabled"; label: string }
  | { kind: "expired"; label: string }
  | { kind: "exhausted"; label: string }

/**
 * Why a code will or will not work right now.
 *
 * A code can fail for three different reasons and an administrator handing one
 * to a colleague needs to know which, because the fix differs: re-enable it,
 * regenerate it for a fresh window, or raise the use limit.
 */
function describeState(code: SchoolInviteCode): CodeState {
  if (!code.active) return { kind: "disabled", label: "Disabled" }
  if (code.expiresAt && new Date(code.expiresAt).getTime() < Date.now()) {
    return { kind: "expired", label: `Expired ${formatDate(code.expiresAt)}` }
  }
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    return { kind: "exhausted", label: "All uses taken" }
  }
  return { kind: "active", label: null }
}

/**
 * Teacher invite codes for a school administrator.
 *
 * Retired codes stay on the list rather than disappearing, because the record
 * of who joined on which code is the only audit trail of how staff got their
 * access. Nothing here can remove a teacher from the school — disabling a code
 * only stops future joins.
 */
export function InviteCodes({
  schoolId,
  codes,
}: {
  schoolId: number
  codes: SchoolInviteCode[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key)
    try {
      await fn()
      toast.success(success)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Teacher invite codes</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground text-pretty">
            Share a code with your staff to add them to the school plan. Students
            join through their teacher&apos;s class code and are covered
            automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          New code
        </Button>
      </div>

      {codes.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          No invite codes yet. Create one to start adding teachers.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {codes.map((code) => (
            <CodeRow
              key={code.id}
              code={code}
              busy={busy}
              onToggle={() =>
                run(
                  `toggle-${code.id}`,
                  () => setInviteCodeActive(code.id, !code.active),
                  code.active ? "Code disabled" : "Code enabled",
                )
              }
              onRegenerate={() =>
                run(
                  `regen-${code.id}`,
                  () => regenerateInviteCode(code.id),
                  "New code created. The old one no longer works.",
                )
              }
            />
          ))}
        </ul>
      )}

      <CreateCodeDialog
        schoolId={schoolId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />
    </section>
  )
}

function CodeRow({
  code,
  busy,
  onToggle,
  onRegenerate,
}: {
  code: SchoolInviteCode
  busy: string | null
  onToggle: () => void
  onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [members, setMembers] = useState<InviteCodeMember[] | null>(null)
  const [loadingMembers, setLoadingMembers] = useState(false)

  const state = describeState(code)
  const usable = state.kind === "active"

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy. Select the code and copy it manually.")
    }
  }

  async function handleExpand() {
    const next = !expanded
    setExpanded(next)
    // Fetched on first open only; the list is a point-in-time record that does
    // not change while the panel sits open.
    if (next && members === null) {
      setLoadingMembers(true)
      try {
        setMembers(await getInviteCodeUsage(code.id))
      } catch {
        toast.error("Could not load who joined on this code")
        setExpanded(false)
      } finally {
        setLoadingMembers(false)
      }
    }
  }

  return (
    <li className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <code
          className={`rounded bg-muted px-2 py-1 font-mono text-sm tracking-wider ${
            usable ? "" : "text-muted-foreground line-through"
          }`}
        >
          {code.code}
        </code>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label={copied ? "Code copied" : `Copy code ${code.code}`}
        >
          {copied ? <Check className="text-primary" /> : <Copy />}
        </Button>

        {state.label && (
          <Badge variant={state.kind === "disabled" ? "outline" : "secondary"}>
            {state.label}
          </Badge>
        )}

        <span className="text-xs text-muted-foreground">
          {code.joinedCount === 1 ? "1 teacher" : `${code.joinedCount} teachers`}
          {code.maxUses !== null
            ? ` · ${code.usedCount}/${code.maxUses} uses`
            : " joined"}
          {code.expiresAt && state.kind === "active"
            ? ` �� expires ${formatDate(code.expiresAt)}`
            : ""}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {code.joinedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExpand}
              aria-expanded={expanded}
            >
              <Users data-icon="inline-start" />
              Who joined
              <ChevronDown
                data-icon="inline-end"
                className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy === `regen-${code.id}`}
            onClick={onRegenerate}
          >
            {busy === `regen-${code.id}` ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy === `toggle-${code.id}`}
            onClick={onToggle}
          >
            {code.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          {loadingMembers ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading
            </p>
          ) : members && members.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                >
                  <UserAvatar
                    userId={member.userId}
                    name={member.name}
                    avatarId={member.avatarId}
                    size="sm"
                  />
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground">{member.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {member.status === "active"
                      ? `joined ${formatDate(member.joinedAt)}`
                      : "removed from school"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nobody is recorded against this code.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function CreateCodeDialog({
  schoolId,
  open,
  onOpenChange,
  onCreated,
}: {
  schoolId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [maxUses, setMaxUses] = useState("")
  const [expiresIn, setExpiresIn] = useState("never")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const parsedUses = maxUses.trim() === "" ? null : Number(maxUses)
      await createInviteCode(schoolId, "teacher", {
        maxUses: parsedUses,
        expiresInDays: expiresIn === "never" ? null : Number(expiresIn),
      })
      toast.success("Teacher code created")
      setMaxUses("")
      setExpiresIn("never")
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the code")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New teacher code</DialogTitle>
          <DialogDescription>
            Limits are optional. A code with no limits works until you disable it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code-max-uses">Maximum uses</FieldLabel>
              <Input
                id="code-max-uses"
                type="number"
                min={1}
                max={MAX_INVITE_USES}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
              />
              <FieldDescription>
                Useful for a single colleague — set it to 1 and the code retires
                itself.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="code-expiry">Expires</FieldLabel>
              <Select
                items={EXPIRY_OPTIONS}
                value={expiresIn}
                onValueChange={(value) => setExpiresIn(value ?? "never")}
              >
                <SelectTrigger id="code-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPIRY_OPTIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Create code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
