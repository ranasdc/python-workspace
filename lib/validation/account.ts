/**
 * The rules for names and passwords, in one place.
 *
 * The sign-up form, the profile editor and the auth server all import these
 * same functions. That is deliberate: the browser uses them to keep the submit
 * button disabled and show a live checklist, and the server re-runs the
 * identical checks on the request body, so a hand-crafted POST cannot get past
 * anything the form enforced. Changing a rule here changes it everywhere.
 */

/**
 * Long enough for genuinely long names, short enough to stay sane in a column
 * and in every list that renders one. Names are stored as `text`, so this is
 * an application limit rather than a database one.
 */
export const NAME_MAX_LENGTH = 100

/**
 * What a name may contain besides letters.
 *
 * `\p{M}` (combining marks) is what keeps Devanagari, Tamil and Arabic names
 * working: in those scripts a vowel sign is its own code point and is not
 * classed as a letter, so a letters-only rule would reject them outright. Both
 * apostrophes are listed because phones and word processors silently replace
 * the typewriter one with the curly one, and O'Connor should not depend on
 * which keyboard typed it. The two hyphens are there for the same reason.
 */
const NAME_ALLOWED = /^[\p{L}\p{M}'\u2019.\u002D\u2010 ]+$/u

/** At least one real letter, so punctuation alone can never be a name. */
const NAME_HAS_LETTER = /\p{L}/u

/**
 * Trim, collapse runs of whitespace, and capitalise the first letter only.
 *
 * NFC matters more than it looks: "é" can arrive as one code point or as "e"
 * plus a combining accent, and the two are visually identical but compare and
 * sort differently. Normalising on the way in means one spelling reaches the
 * database however the name was typed or pasted.
 *
 * Only the first character is touched. Jean-pierre keeps its lower-case "p"
 * and de la Cruz keeps its lower-case particles, because title-casing every
 * word would quietly misspell a great many real names.
 */
export function normalizeName(raw: string): string {
  const collapsed = String(raw ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
  if (!collapsed) return ""
  // Split by code point, so a name starting outside the basic plane is not
  // cut in half by indexing into UTF-16 units.
  const [first, ...rest] = Array.from(collapsed)
  return first.toUpperCase() + rest.join("")
}

export type NameField = "first" | "last"

/**
 * Validates one name field, returning a message to show beside it or null.
 * Runs against the normalised value, so "  ada  " is judged as "Ada".
 */
export function validateName(raw: string, field: NameField): string | null {
  const value = normalizeName(raw)
  if (!value) {
    return field === "first" ? "Please enter your first name." : "Please enter your last name."
  }
  if (value.length > NAME_MAX_LENGTH) {
    return `Your ${field === "first" ? "first" : "last"} name can be at most ${NAME_MAX_LENGTH} characters.`
  }
  if (!NAME_HAS_LETTER.test(value) || !NAME_ALLOWED.test(value)) {
    return "Please enter a valid name using letters and permitted punctuation."
  }
  return null
}

/** The display name stored on the user row, built from the two parts. */
export function composeDisplayName(first: string, last: string): string {
  return [normalizeName(first), normalizeName(last)].filter(Boolean).join(" ")
}

/**
 * Best-effort split of a single display name into two parts.
 *
 * Used for accounts created before the form collected the parts separately,
 * and for any future sign-in method that only hands over a full name. The
 * first word is taken as the given name and the remainder as the family name,
 * which is right for most names and, for the rest, is at least editable —
 * which is why this is only ever used to fill a field, never to overwrite a
 * stored name.
 */
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const collapsed = String(name ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
  if (!collapsed) return { firstName: "", lastName: "" }
  const space = collapsed.indexOf(" ")
  if (space === -1) return { firstName: collapsed, lastName: "" }
  return {
    firstName: collapsed.slice(0, space),
    lastName: collapsed.slice(space + 1),
  }
}

export type PasswordRule = {
  id: string
  /** Shown in the live checklist under the field. */
  label: string
  /** Shown as the error when this is the first unmet rule. */
  message: string
  test: (password: string) => boolean
}

/**
 * The password rules, in the order they are shown and checked.
 *
 * Case and digit tests use Unicode properties rather than A-Z and 0-9 so that
 * a password written in Greek or Cyrillic can satisfy them. "Special" is then
 * anything that is neither a letter nor a number in any script, which includes
 * the space — passwords are never trimmed or altered, so a passphrase counts.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    message: "Your password must contain at least 8 characters.",
    test: (p) => p.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    message: "Include at least one uppercase letter.",
    test: (p) => /\p{Lu}/u.test(p),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    message: "Include at least one lowercase letter.",
    test: (p) => /\p{Ll}/u.test(p),
  },
  {
    id: "number",
    label: "One number",
    message: "Include at least one number.",
    test: (p) => /\p{N}/u.test(p),
  },
  {
    id: "special",
    label: "One special character",
    message: "Include at least one special character.",
    test: (p) => /[^\p{L}\p{N}]/u.test(p),
  },
]

/** The first unmet password rule's message, or null when the password passes. */
export function validatePassword(password: string): string | null {
  const value = String(password ?? "")
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) return rule.message
  }
  return null
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null
}
