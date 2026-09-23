/** Shared SWR cache keys so unrelated components can revalidate each other. */
export const SUBSCRIPTION_INFO_KEY = "subscription-info"

/**
 * Usage and limits are reported per IDE, so the cache key carries the language.
 * Without it, creating an HTML file would revalidate into the Python tier bar
 * and show a quota that does not match what the server will enforce.
 */
export function subscriptionInfoKey(language: string) {
  return [SUBSCRIPTION_INFO_KEY, language] as const
}
