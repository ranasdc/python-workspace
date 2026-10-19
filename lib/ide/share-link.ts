/**
 * Where a public share lives, and how its URL is spelled.
 *
 * A share link is genuinely public: the token in the path is the only thing
 * that grants access, so the page behind it renders for anyone, signed in or
 * not. That is the whole difference from the deep link this replaced, which
 * named a file id and still demanded a session that owned it.
 *
 * The route is kept short on purpose — these get pasted into chats and read out
 * loud, and `/s/aB3…` survives that better than `/share/file/aB3…`.
 */

export const SHARE_ROUTE = "/s"

export function sharePath(token: string) {
  return `${SHARE_ROUTE}/${token}`
}

/**
 * Built from the live origin at click time rather than from a configured site
 * URL, so the copied link points at whatever host the user is actually on —
 * a preview deployment, localhost, or production. Client-only: reading
 * `window.location` during render would disagree with the server and break
 * hydration.
 */
export function shareUrl(token: string) {
  return new URL(sharePath(token), window.location.origin).toString()
}
