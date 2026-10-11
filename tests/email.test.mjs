import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it, mock } from "node:test"

import { passwordResetEmail, sendEmail } from "../lib/email.ts"

const message = { to: "delivered@resend.dev", subject: "Hi", html: "<p>Hi</p>", text: "Hi" }
const savedEnv = { ...process.env }

beforeEach(() => {
  process.env.NODE_ENV = "test"
  process.env.RESEND_API_KEY = "re_test_key"
  process.env.RESEND_EMAIL_DOMAIN = "example.test"
  delete process.env.EMAIL_FROM
  mock.method(console, "error", () => {})
  mock.method(console, "warn", () => {})
  mock.method(console, "log", () => {})
})

afterEach(() => {
  mock.restoreAll()
  process.env = { ...savedEnv }
})

describe("sendEmail", () => {
  it("does not call Resend and reports not_configured when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response("{}"))
    const result = await sendEmail(message)
    assert.deepEqual(result, { ok: false, reason: "not_configured" })
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it("sends from the integration domain with the idempotency key", async () => {
    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    )
    const result = await sendEmail({ ...message, idempotencyKey: "welcome/user-1" })

    assert.deepEqual(result, { ok: true, id: "email_123" })
    const [url, init] = fetchMock.mock.calls[0].arguments
    assert.equal(url, "https://api.resend.com/emails")
    assert.equal(init.headers["Idempotency-Key"], "welcome/user-1")
    assert.equal(init.headers.Authorization, "Bearer re_test_key")
    const body = JSON.parse(init.body)
    assert.equal(body.from, "mycodepad <no-reply@example.test>")
    assert.equal(body.text, "Hi")
  })

  it("returns rejected (and does not throw) when Resend returns an error", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => new Response('{"message":"domain is not verified"}', { status: 403 }),
    )
    const result = await sendEmail(message)
    assert.deepEqual(result, { ok: false, reason: "rejected", status: 403 })
  })

  it("returns network_error (and does not throw) when Resend is unreachable", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNRESET")
    })
    const result = await sendEmail(message)
    assert.deepEqual(result, { ok: false, reason: "network_error" })
  })

  it("never logs the message body or recipient outside development", async () => {
    const logs = []
    mock.method(console, "error", (...args) => logs.push(args.join(" ")))
    mock.method(console, "log", (...args) => logs.push(args.join(" ")))
    mock.method(globalThis, "fetch", async () => new Response("nope", { status: 500 }))
    await sendEmail({ ...message, text: "secret-reset-link" })
    assert.ok(logs.every((l) => !l.includes("secret-reset-link") && !l.includes(message.to)))
  })
})

describe("password reset email (unchanged)", () => {
  it("still renders the reset link and expiry, escaped in HTML", () => {
    const email = passwordResetEmail({ name: "Ada <b>", url: "https://app.test/reset?token=abc&x=1" })
    assert.equal(email.subject, "Reset your mycodepad password")
    assert.match(email.text, /https:\/\/app\.test\/reset\?token=abc&x=1/)
    assert.match(email.text, /expires in 1 hour/)
    assert.match(email.html, /token=abc&amp;x=1/)
    assert.ok(!email.html.includes("<b>"))
  })
})
