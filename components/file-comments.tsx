"use client"

import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { getFileComments, addComment, deleteComment } from "@/app/actions/files"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { MessageSquare, Loader2, Send, Trash2 } from "lucide-react"

type Comment = {
  id: number
  fileId: number
  teacherId: string
  teacherName: string
  body: string
  createdAt: Date
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * Comment thread for a single file. Polls every few seconds so a student sees a
 * teacher's feedback appear in near real time (and vice versa). Teachers get an
 * input to add feedback; students see it read-only.
 */
export function FileComments({
  fileId,
  canComment,
}: {
  fileId: number
  canComment: boolean
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

  const list = comments ?? []

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Teacher feedback
        {list.length > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
            {list.length}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading feedback...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">
            {canComment
              ? "No feedback yet. Add a comment below to guide this student."
              : "No feedback yet. Your teacher's comments will appear here."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {initials(c.teacherName)}
                </span>
                <div className="min-w-0 flex-1 rounded-lg rounded-tl-sm bg-muted/60 px-3 py-2">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-xs font-semibold">{c.teacherName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
