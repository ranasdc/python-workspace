"use client"

import { useEffect, useId, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import {
  getFileComments,
  addComment,
  deleteComment,
  setCommentReaction,
} from "@/app/actions/files"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import {
  COMMENT_REACTIONS,
  getCommentReaction,
  reactionClasses,
  type CommentReaction,
} from "@/lib/ide/comment-reactions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  MessageSquare,
  PencilLine,
  Send,
  Trash2,
} from "lucide-react"

type Comment = {
  id: number
  fileId: number
  teacherId: string
  teacherName: string
  teacherAvatarId: string | null
  body: string
  createdAt: Date
  studentReaction: string | null
  studentReactedAt: Date | null
}

const REACTION_ICONS: Record<CommentReaction, typeof Check> = {
  acknowledged: Check,
  corrected: PencilLine,
  need_help: HelpCircle,
}

function formatWhen(value: Date) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Comment thread for a single file. Polls every few seconds so a student sees a
 * teacher's feedback appear in near real time (and vice versa). Teachers get an
 * input to add feedback; students get the three one-tap replies instead.
 *
 * Two shapes, chosen by `collapsible`:
 *
 * - The teacher's review pane fills the height it is given, because feedback is
 *   the thing they came to that screen to write.
 * - The pupil's dock sizes itself to its contents under the editor. A pupil is
 *   there to write code, so an empty thread must cost them a single strip of
 *   header and nothing more, while a thread that does have something to say
 *   opens itself and takes only the room that saying it needs.
 */
export function FileComments({
  fileId,
  canComment,
  canReact = false,
  collapsible = false,
}: {
  fileId: number
  /** Teachers: shows the composer and lets them delete their own comments. */
  canComment: boolean
  /** Pupils: shows the acknowledge / corrected / need-help replies. */
  canReact?: boolean
  /** Dock mode — header toggles, body hugs its contents. */
  collapsible?: boolean
}) {
  const key = ["file-comments", fileId] as const
  const { data: comments, isLoading } = useSWR<Comment[]>(
    key,
    () => getFileComments(fileId),
    { refreshInterval: 5000, revalidateOnFocus: true },
  )
  const { mutate } = useSWRConfig()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  const list = comments ?? []
  const count = list.length
  const latest = count > 0 ? list[count - 1] : null

  // The dock opens itself when there is feedback to read, and again whenever a
  // comment arrives while the pupil is working, so a teacher's message is never
  // left hidden behind a header the pupil has no reason to click. Tracked per
  // file because the component is reused as the pupil moves between files: a
  // count carried over from the last file would read as new feedback on this one.
  const seen = useRef<{ fileId: number; count: number } | null>(null)
  useEffect(() => {
    if (!collapsible) return
    const previous = seen.current
    seen.current = { fileId, count }
    if (!previous || previous.fileId !== fileId) {
      setOpen(count > 0)
      return
    }
    if (count > previous.count) setOpen(true)
  }, [collapsible, fileId, count])

  async function submit() {
    const clean = body.trim()
    if (!clean) return
    setBusy(true)
    try {
      await addComment(fileId, clean)
      setBody("")
      await mutate(key)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add comment")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    try {
      await deleteComment(id)
      await mutate(key)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete comment")
    }
  }

  async function react(commentId: number, choice: CommentReaction) {
    const current = list.find((c) => c.id === commentId)?.studentReaction ?? null
    // Tapping the chosen reply again clears it, so a mis-tap is recoverable.
    const next = current === choice ? null : choice
    setPendingId(commentId)
    try {
      // Shown immediately: a reply that waited on a round trip would invite a
      // second tap, which would read as the pupil undoing their own answer.
      await mutate(
        key,
        (previous?: Comment[]) =>
          (previous ?? []).map((c) =>
            c.id === commentId
              ? { ...c, studentReaction: next, studentReactedAt: next ? new Date() : null }
              : c,
          ),
        { revalidate: false },
      )
      await setCommentReaction(commentId, next)
      await mutate(key)
    } catch (e) {
      // Put the server's version back, so the pupil is never left believing
      // they told their teacher something that never arrived.
      await mutate(key)
      toast.error(e instanceof Error ? e.message : "Could not send your reply")
    } finally {
      setPendingId(null)
    }
  }

  const showBody = !collapsible || open
  const headerLabel = (
    <>
      <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="shrink-0">Teacher feedback</span>
      {count > 0 && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
          {count}
        </span>
      )}
    </>
  )

  return (
    <div className={cn("flex flex-col", !collapsible && "min-h-0")}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            "flex w-full items-center gap-2 px-4 py-1.5 text-left",
            "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
            "transition-colors hover:bg-muted/50 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            showBody && "border-b border-border",
          )}
        >
          {headerLabel}
          {/* Folded away, the strip still earns its place: the newest comment
              rides along in it, so the pupil can see what was said without
              giving the thread any of the editor's height back. */}
          {!open && latest && (
            <span className="min-w-0 flex-1 truncate text-xs font-normal normal-case tracking-normal text-muted-foreground/80">
              {latest.body}
            </span>
          )}
          <span className={cn("ml-auto shrink-0", !open && latest && "ml-2")} aria-hidden="true">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {headerLabel}
        </div>
      )}

      {showBody && (
        <div
          id={bodyId}
          className={cn(
            "min-h-0 overflow-auto px-4 py-2.5",
            // Hugs its contents, but never grows past a third of the viewport:
            // past that the thread scrolls instead of pushing the editor away.
            collapsible ? "max-h-[33vh]" : "flex-1 py-3",
          )}
        >
          {isLoading && count === 0 ? (
            <p className="text-sm text-muted-foreground">Loading feedback...</p>
          ) : count === 0 ? (
            <p className="text-pretty text-sm text-muted-foreground">
              {canComment
                ? "No feedback yet. Add a comment below to guide this student."
                : "No feedback yet. Your teacher's comments will appear here."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {list.map((c) => {
                const chosen = getCommentReaction(c.studentReaction)
                return (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <UserAvatar
                      userId={c.teacherId}
                      name={c.teacherName}
                      avatarId={c.teacherAvatarId}
                      size="sm"
                      className="mt-0.5 size-7"
                    />
                    <div className="min-w-0 flex-1 rounded-lg rounded-tl-sm bg-muted/60 px-3 py-2">
                      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold">{c.teacherName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatWhen(c.createdAt)}
                        </span>
                        {/* The pupil's answer, shown to both sides. On the
                            teacher's thread it is the whole point of the reply:
                            it marks who has acted and who is stuck. */}
                        {chosen && !canReact && (
                          <span
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              reactionClasses(chosen).badge,
                            )}
                            title={
                              c.studentReactedAt
                                ? `Student replied ${formatWhen(c.studentReactedAt)}`
                                : undefined
                            }
                          >
                            {(() => {
                              const Icon = REACTION_ICONS[chosen.id]
                              return <Icon className="h-3 w-3" aria-hidden="true" />
                            })()}
                            {chosen.teacherLabel}
                          </span>
                        )}
                        {canComment && (
                          <button
                            onClick={() => remove(c.id)}
                            className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {c.body}
                      </p>

                      {canReact && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {COMMENT_REACTIONS.map((reaction) => {
                            const active = c.studentReaction === reaction.id
                            const Icon = REACTION_ICONS[reaction.id]
                            return (
                              <button
                                key={reaction.id}
                                type="button"
                                onClick={() => react(c.id, reaction.id)}
                                disabled={pendingId === c.id}
                                aria-pressed={active}
                                title={active ? "Tap again to undo" : reaction.hint}
                                className={cn(
                                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                  "disabled:opacity-60",
                                  active
                                    ? reactionClasses(reaction).active
                                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                <Icon className="h-3 w-3" aria-hidden="true" />
                                {reaction.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {canComment && (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Leave feedback for this student..."
              rows={2}
              className="min-h-0 resize-none"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.metaKey || e.ctrlKey) &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <Button size="icon" onClick={submit} disabled={busy || !body.trim()} aria-label="Send comment">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Press Cmd/Ctrl + Enter to send</p>
        </div>
      )}
    </div>
  )
}
