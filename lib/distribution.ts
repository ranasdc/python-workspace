/**
 * Who a teacher's distribution goes to.
 *
 * - `null` sends to everyone enrolled in the class.
 * - a single id sends to that one student.
 * - a list sends to exactly those students and nobody else.
 */
export type RecipientSelection = string | string[] | null

/** Far above any real class, and low enough to refuse a runaway request. */
export const MAX_SELECTED_RECIPIENTS = 2000

/**
 * Turns what the client asked for into the students who will actually receive
 * the work.
 *
 * The selection arrives from a browser and is not trusted: every id is checked
 * against the class's own enrolments, so a forged request cannot reach a pupil
 * in another class, and repeated ids collapse to one so nobody is sent the
 * same work twice.
 *
 * The teacher is never a recipient, even when enrolled in their own class.
 * Distributed files are exempt from the recipient's storage allowance, so
 * sending to yourself would be a way to mint files the allowance never counts.
 */
export function resolveRecipientIds(
  selection: unknown,
  enrolledIds: readonly string[],
  teacherId: string,
): string[] {
  const eligible = Array.from(new Set(enrolledIds)).filter((id) => id !== teacherId)

  if (selection === null || selection === undefined) return eligible

  if (typeof selection === "string") {
    if (!eligible.includes(selection)) throw new Error("Student is not in this class")
    return [selection]
  }

  if (Array.isArray(selection)) {
    if (selection.length > MAX_SELECTED_RECIPIENTS) {
      throw new Error("Too many students selected")
    }
    if (!selection.every((id): id is string => typeof id === "string" && id.length > 0)) {
      throw new Error("Invalid student selection")
    }
    const chosen = Array.from(new Set(selection))
    if (chosen.length === 0) throw new Error("Select at least one student")

    const allowed = new Set(eligible)
    if (!chosen.every((id) => allowed.has(id))) {
      throw new Error("One or more selected students are not in this class")
    }
    return chosen
  }

  throw new Error("Invalid student selection")
}
