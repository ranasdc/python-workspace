/**
 * How a pupil can answer a piece of teacher feedback.
 *
 * Feedback without a reply is a monologue: the teacher cannot tell the
 * difference between a pupil who read a comment and fixed it, one who never
 * opened the file, and one who read it and is stuck. These three replies are
 * deliberately the whole vocabulary — enough to tell those cases apart, few
 * enough that answering stays a single tap rather than a writing task.
 *
 * Kept free of React and Tailwind-only concerns so both the pupil's buttons and
 * the teacher's badge render from one definition and can be unit tested.
 */
export const COMMENT_REACTIONS = [
  {
    id: "acknowledged",
    /** On the pupil's button. */
    label: "Acknowledged",
    /** On the teacher's badge — reads as a report of what the pupil did. */
    teacherLabel: "Acknowledged",
    /** Explains the consequence of choosing it, for the button's tooltip. */
    hint: "Tell your teacher you have read this",
    tone: "chart-3",
  },
  {
    id: "corrected",
    label: "Made correction",
    teacherLabel: "Made correction",
    hint: "Tell your teacher you have changed your code",
    tone: "chart-2",
  },
  {
    id: "need_help",
    label: "Need help on this",
    teacherLabel: "Needs help",
    hint: "Ask your teacher for help with this",
    tone: "chart-4",
  },
] as const

export type CommentReaction = (typeof COMMENT_REACTIONS)[number]["id"]
export type CommentReactionDef = (typeof COMMENT_REACTIONS)[number]

/**
 * Whether a value is one of the three replies.
 *
 * Every reaction arriving from a client goes through this before it reaches the
 * database, so a crafted request cannot write an arbitrary string into a column
 * that both dashboards then render.
 */
export function isCommentReaction(value: unknown): value is CommentReaction {
  return (
    typeof value === "string" &&
    COMMENT_REACTIONS.some((reaction) => reaction.id === value)
  )
}

/** The definition for a stored reaction, or null if absent or unrecognised. */
export function getCommentReaction(value: unknown): CommentReactionDef | null {
  if (!isCommentReaction(value)) return null
  return COMMENT_REACTIONS.find((reaction) => reaction.id === value) ?? null
}

/**
 * Tailwind classes for a reaction, derived from its tone so the pupil's chosen
 * button and the teacher's badge are always the same colour for the same reply.
 *
 * Written as whole class strings rather than assembled from the tone at runtime
 * because Tailwind only ships classes it can see in the source.
 */
const TONE_CLASSES: Record<
  CommentReactionDef["tone"],
  { active: string; badge: string }
> = {
  "chart-3": {
    active: "border-chart-3/40 bg-chart-3/15 text-chart-3 hover:bg-chart-3/25",
    badge: "bg-chart-3/15 text-chart-3",
  },
  "chart-2": {
    active: "border-chart-2/40 bg-chart-2/15 text-chart-2 hover:bg-chart-2/25",
    badge: "bg-chart-2/15 text-chart-2",
  },
  "chart-4": {
    active: "border-chart-4/40 bg-chart-4/15 text-chart-4 hover:bg-chart-4/25",
    badge: "bg-chart-4/15 text-chart-4",
  },
}

export function reactionClasses(reaction: CommentReactionDef) {
  return TONE_CLASSES[reaction.tone]
}
