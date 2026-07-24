import { betterAuth } from "better-auth"
import { Pool } from "pg"

const isDev = process.env.NODE_ENV === "development"

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.V0_RUNTIME_URL || "http://localhost:3000"
}

// Custom domains added in Vercel aren't known to Better Auth automatically, so
// logins from them are rejected as an invalid origin. Set TRUSTED_ORIGINS to a
// comma-separated list of your custom domain(s) — with the scheme, e.g.
// "https://www.mycodingbook.com,https://mycodingbook.com" — to allow them.
const customTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

const trustedOrigins = [
  ...customTrustedOrigins,
  process.env.V0_RUNTIME_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
  // The v0 sandbox preview is served from a rotating https://sb-*.vercel.run
  // host, so trust that wildcard (and localhost) in development.
  ...(isDev ? ["http://localhost:3000", "https://*.vercel.run"] : []),
].filter(Boolean) as string[]

export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
        input: true,
      },
    },
  },
  ...(isDev
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
