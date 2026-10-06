/**
 * The MyCodePad avatar catalogue.
 *
 * This file is the single authority on which profile pictures exist. A user
 * record stores only an `avatarId` that must appear here, which is what makes
 * the feature safe: there is no code path that turns user input into an image
 * source, so a profile picture can never be an arbitrary URL, an upload or a
 * path assembled from something the client sent. Every write is checked
 * against this list server-side (see app/actions/avatar.ts).
 *
 * Storing an id rather than a file also means the artwork can be re-cut,
 * re-rendered or re-exported later without touching a single user row.
 *
 * To grow the collection, append entries. Never renumber or reuse an id: a
 * retired avatar should be marked `active: false` so the people already
 * wearing it keep their picture while nobody new can choose it.
 */

export type AvatarCategory =
  | "coding"
  | "heroes"
  | "robots"
  | "animals"
  | "space"
  | "fantasy"
  | "funny"

export type Avatar = {
  /** Stable key stored on the user record. Never reused, never renamed. */
  id: string
  /** Friendly display name, used for tooltips and screen-reader labels. */
  name: string
  category: AvatarCategory
  /** Surfaced in the "Featured" filter as a small, curated starting point. */
  featured: boolean
  /** False retires an avatar from the picker without breaking existing users. */
  active: boolean
}

export type AvatarChoice = Avatar & {
  /** Resolved asset path. Derived, so the artwork can move in one place. */
  src: string
}

export const AVATAR_CATEGORIES: { id: AvatarCategory; label: string }[] = [
  { id: "coding", label: "Coding" },
  { id: "heroes", label: "Heroes" },
  { id: "robots", label: "Robots" },
  { id: "animals", label: "Animals" },
  { id: "space", label: "Space" },
  { id: "fantasy", label: "Fantasy" },
  { id: "funny", label: "Funny" },
]

const CATALOGUE: Avatar[] = [
  // ---------- Coding ----------
  { id: "code-cadet", name: "Code Cadet", category: "coding", featured: true, active: true },
  { id: "python-pal", name: "Python Pal", category: "coding", featured: true, active: true },
  { id: "web-weaver", name: "Web Weaver", category: "coding", featured: false, active: true },
  { id: "terminal-tam", name: "Terminal Tam", category: "coding", featured: false, active: true },
  { id: "syntax-sage", name: "Syntax Sage", category: "coding", featured: false, active: true },
  { id: "debug-dynamo", name: "Debug Dynamo", category: "coding", featured: false, active: true },
  { id: "professor-pixel", name: "Professor Pixel", category: "coding", featured: true, active: true },

  // ---------- Heroes ----------
  { id: "code-hero", name: "Code Hero", category: "heroes", featured: true, active: true },
  { id: "cyber-guardian", name: "Cyber Guardian", category: "heroes", featured: false, active: true },
  { id: "byte-knight", name: "Byte Knight", category: "heroes", featured: false, active: true },
  { id: "logic-lancer", name: "Logic Lancer", category: "heroes", featured: false, active: true },
  { id: "data-defender", name: "Data Defender", category: "heroes", featured: false, active: true },
  { id: "script-sentinel", name: "Script Sentinel", category: "heroes", featured: false, active: true },
  { id: "turbo-tinkerer", name: "Turbo Tinkerer", category: "heroes", featured: false, active: true },

  // ---------- Robots ----------
  { id: "robo-coder", name: "Robo Coder", category: "robots", featured: true, active: true },
  { id: "astro-bot", name: "Astro Bot", category: "robots", featured: false, active: true },
  { id: "circuit-chum", name: "Circuit Chum", category: "robots", featured: false, active: true },
  { id: "gear-grin", name: "Gear Grin", category: "robots", featured: false, active: true },
  { id: "beep-buddy", name: "Beep Buddy", category: "robots", featured: false, active: true },
  { id: "mecha-mentor", name: "Mecha Mentor", category: "robots", featured: false, active: true },
  { id: "overclock-ollie", name: "Overclock Ollie", category: "robots", featured: false, active: true },

  // ---------- Animals ----------
  { id: "cyber-fox", name: "Cyber Fox", category: "animals", featured: true, active: true },
  { id: "pixel-panda", name: "Pixel Panda", category: "animals", featured: true, active: true },
  { id: "hacker-penguin", name: "Hacker Penguin", category: "animals", featured: false, active: true },
  { id: "circuit-cat", name: "Circuit Cat", category: "animals", featured: false, active: true },
  { id: "loop-labrador", name: "Loop Labrador", category: "animals", featured: false, active: true },
  { id: "owl-architect", name: "Owl Architect", category: "animals", featured: false, active: true },
  { id: "koala-coder", name: "Koala Coder", category: "animals", featured: false, active: true },
  { id: "red-panda-dev", name: "Red Panda Dev", category: "animals", featured: false, active: true },
  { id: "marmoset-maker", name: "Marmoset Maker", category: "animals", featured: false, active: true },

  // ---------- Space ----------
  { id: "space-explorer", name: "Space Explorer", category: "space", featured: true, active: true },
  { id: "nebula-navigator", name: "Nebula Navigator", category: "space", featured: false, active: true },
  { id: "rocket-rookie", name: "Rocket Rookie", category: "space", featured: false, active: true },
  { id: "star-scientist", name: "Star Scientist", category: "space", featured: false, active: true },
  { id: "friendly-alien", name: "Friendly Alien", category: "space", featured: false, active: true },
  { id: "comet-captain", name: "Comet Captain", category: "space", featured: false, active: true },
  { id: "orbit-engineer", name: "Orbit Engineer", category: "space", featured: false, active: true },

  // ---------- Fantasy ----------
  { id: "code-wizard", name: "Code Wizard", category: "fantasy", featured: true, active: true },
  { id: "digital-mage", name: "Digital Mage", category: "fantasy", featured: false, active: true },
  { id: "debugging-dragon", name: "Debugging Dragon", category: "fantasy", featured: false, active: true },
  { id: "rune-reader", name: "Rune Reader", category: "fantasy", featured: false, active: true },
  { id: "potion-programmer", name: "Potion Programmer", category: "fantasy", featured: false, active: true },
  { id: "enchanted-engineer", name: "Enchanted Engineer", category: "fantasy", featured: false, active: true },
  { id: "griffin-guide", name: "Griffin Guide", category: "fantasy", featured: false, active: true },

  // ---------- Funny ----------
  { id: "sleepy-coder", name: "Sleepy Coder", category: "funny", featured: false, active: true },
  { id: "puzzled-programmer", name: "Puzzled Programmer", category: "funny", featured: false, active: true },
  { id: "happy-hacker", name: "Happy Hacker", category: "funny", featured: true, active: true },
  { id: "waffle-bot", name: "Waffle Bot", category: "funny", featured: false, active: true },
  { id: "snack-stack", name: "Snack Stack", category: "funny", featured: false, active: true },
  { id: "goofy-alien", name: "Goofy Alien", category: "funny", featured: false, active: true },
]

/** Where an avatar's artwork lives. The only place a path is ever built. */
function assetPath(id: string) {
  return `/avatars/${id}.webp`
}

const withSrc = (avatar: Avatar): AvatarChoice => ({ ...avatar, src: assetPath(avatar.id) })

/** The full catalogue, including retired entries. */
export const ALL_AVATARS: AvatarChoice[] = CATALOGUE.map(withSrc)

/** Everything a user is currently allowed to choose. */
export const SELECTABLE_AVATARS: AvatarChoice[] = ALL_AVATARS.filter((a) => a.active)

const BY_ID = new Map(ALL_AVATARS.map((a) => [a.id, a]))

/**
 * The avatars a never-chosen account can be given.
 *
 * The jokier characters are left out: being handed "Sleepy Coder" without
 * asking reads as a comment on the person, whereas every avatar here is one
 * anybody would be happy to be assigned. They remain freely choosable.
 */
const STARTER_POOL = SELECTABLE_AVATARS.filter((a) => a.category !== "funny")

/** True only for an id that exists and may still be chosen. */
export function isSelectableAvatarId(value: unknown): value is string {
  return typeof value === "string" && (BY_ID.get(value)?.active ?? false)
}

/** Look up an avatar by id, including retired ones, or null. */
export function findAvatar(id: string | null | undefined): AvatarChoice | null {
  if (!id) return null
  return BY_ID.get(id) ?? null
}

/** Stable 32-bit FNV-1a hash, so a given user always lands on the same avatar. */
function hash(value: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The avatar shown for somebody who has never picked one.
 *
 * It is derived from the user id rather than being a single shared fallback,
 * so a brand-new class is varied on sight instead of thirty identical circles
 * — and because the derivation is pure, the same person shows the same face on
 * every device and after every deploy, with nothing written to the database.
 */
export function defaultAvatarFor(userId: string): AvatarChoice {
  return STARTER_POOL[hash(userId) % STARTER_POOL.length]
}

/**
 * The avatar to display for a user: their choice when it is still valid,
 * otherwise their stable default. Resolving an unknown or retired id to the
 * default rather than to nothing is what guarantees no broken image and no
 * empty circle anywhere in the product.
 */
export function resolveAvatar(
  userId: string,
  avatarId: string | null | undefined,
): AvatarChoice {
  return findAvatar(avatarId) ?? defaultAvatarFor(userId)
}
