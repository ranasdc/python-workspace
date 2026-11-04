import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { Pool } from "pg"
import { getBaseURL } from "@/lib/app-url"
import { passwordResetEmail, sendEmail } from "@/lib/email"
import { sendWelcomeEmail } from "@/lib/transactional-emails"
import {
  composeDisplayName,
  normalizeName,
  splitDisplayName,
  validateName,
  validatePassword,
} from "@/lib/validation/account"

const isDev = process.env.NODE_ENV === "development"

/**
 * Endpoints that accept a password being *set*.
 *
 * Sign-in is deliberately absent. The rules apply to a password being chosen,
 * never to one being checked, so tightening them can never lock an existing
 * account out of an account it can already sign in to.
 */
const PASSWORD_ENDPOINTS = new Set([
  "/sign-up/email",
  "/reset-password",
  "/change-password",
  "/set-password",
])

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
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset usually means the old password may be compromised, so every
    // existing session is signed out.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const message = passwordResetEmail({ name: user.name, url })
      await sendEmail({ to: user.email, ...message, idempotencyKey: `password-reset/${token}` })
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
        input: true,
      },
      // Not marked required, because requiredness belongs to the sign-up form
      // and the hook below rather than to the column: existing accounts have
      // no split stored, and declaring it required here would make every later
      // write of an unrelated field fail for them.
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
    },
  },
  /**
   * Server-side enforcement of the sign-up rules.
   *
   * The form applies the same checks from the same module, but the form is
   * just a convenience — this runs on the request itself, so a direct POST to
   * /api/auth/sign-up/email is held to exactly the same standard.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = (ctx.body ?? {}) as Record<string, unknown>

      if (PASSWORD_ENDPOINTS.has(ctx.path)) {
        const incoming = typeof body.newPassword === "string" ? body.newPassword : body.password
        if (typeof incoming === "string") {
          const problem = validatePassword(incoming)
          if (problem) throw new APIError("BAD_REQUEST", { message: problem })
        }
      }

      if (ctx.path !== "/sign-up/email") return

      // Falling back to a split of `name` means a request that sends only a
      // full name is still measured against the rules rather than waved
      // through for using an older shape.
      const fallback = splitDisplayName(typeof body.name === "string" ? body.name : "")
      const firstName =
        typeof body.firstName === "string" && body.firstName.trim()
          ? body.firstName
          : fallback.firstName
      const lastName =
        typeof body.lastName === "string" && body.lastName.trim()
          ? body.lastName
          : fallback.lastName

      for (const [value, field] of [
        [firstName, "first"],
        [lastName, "last"],
      ] as const) {
        const problem = validateName(value, field)
        if (problem) throw new APIError("BAD_REQUEST", { message: problem })
      }

      return {
        context: {
          body: {
            ...body,
            firstName: normalizeName(firstName),
            lastName: normalizeName(lastName),
            // Recomputed rather than trusted, so the stored display name is
            // always the two parts that were actually validated.
            name: composeDisplayName(firstName, lastName),
          },
        },
      }
    }),
  },
  // `role` is client-supplied at sign-up, so it is clamped here. Only the two
  // self-service roles are ever accepted; "school_admin" is granted server-side
  // by creating or being promoted within a school, never by asking for it.
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const incoming = newUser as Record<string, unknown>
          const role = incoming.role === "teacher" ? "teacher" : "student"

          // The sign-up hook has already validated and normalised these, but
          // this is the one place every user row passes through regardless of
          // endpoint. Reconciling here means `name`, `firstName` and
          // `lastName` can never be written out of step with each other.
          const fallback = splitDisplayName(
            typeof incoming.name === "string" ? incoming.name : "",
          )
          const firstName = normalizeName(
            typeof incoming.firstName === "string" && incoming.firstName.trim()
              ? incoming.firstName
              : fallback.firstName,
          )
          const lastName = normalizeName(
            typeof incoming.lastName === "string" && incoming.lastName.trim()
              ? incoming.lastName
              : fallback.lastName,
          )
          const name =
            composeDisplayName(firstName, lastName) || String(incoming.name ?? "").trim()

          return {
            data: {
              ...newUser,
              role,
              firstName: firstName || null,
              lastName: lastName || null,
              name,
            },
          }
        },
        // Email verification is not required, so the account is usable as
        // soon as it exists. sendWelcomeEmail never throws, so a delivery
        // problem can't fail the sign-up.
        after: async (createdUser) => {
          await sendWelcomeEmail(createdUser as typeof createdUser & { role?: string | null })
        },
      },
      update: {
        before: async (updates) => {
          // Nobody changes their own role through the account endpoints.
          //
          // Names are dropped for a different reason: registering them as
          // input fields also makes them writable through updateUser, where a
          // partial update could set one part and leave the display name
          // stale. The profile action in app/actions/account.ts is the single
          // write path, because it validates both parts and recomputes the
          // display name together.
          const {
            role: _role,
            name: _name,
            firstName: _firstName,
            lastName: _lastName,
            ...rest
          } = updates as Record<string, unknown>
          return { data: rest }
        },
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
