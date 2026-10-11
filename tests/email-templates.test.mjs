import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cancellationScheduledEmail,
  formatDate,
  formatMoney,
  paymentFailedEmail,
  paymentSucceededEmail,
  subscriptionActivatedEmail,
  subscriptionEndedEmail,
  welcomeEmail,
} from "../lib/email-templates.ts"

const billingUrl = "https://app.test/billing"

describe("email templates", () => {
  it("welcome email tailors copy by role and links to the dashboard", () => {
    const student = welcomeEmail({ name: "Ada Lovelace", role: "student", dashboardUrl: "https://app.test/dashboard" })
    const teacher = welcomeEmail({ name: "Alan", role: "teacher", dashboardUrl: "https://app.test/dashboard" })
    assert.equal(student.subject, "Welcome to MyCodePad")
    assert.match(student.text, /^Hi Ada,/)
    assert.match(student.text, /class code/)
    assert.match(teacher.text, /create a class/)
    assert.match(student.html, /href="https:\/\/app\.test\/dashboard"/)
  })

  it("escapes user-controlled values in HTML", () => {
    const email = welcomeEmail({ name: '<script>alert("x")</script>', role: "student", dashboardUrl: "https://app.test" })
    assert.ok(!email.html.includes("<script>"))
  })

  it("falls back to a neutral greeting without a name", () => {
    assert.match(welcomeEmail({ name: "  ", role: null, dashboardUrl: "x" }).text, /^Hi there,/)
  })

  it("formats money and dates in UK style", () => {
    assert.equal(formatMoney(499, "gbp"), "£4.99")
    assert.equal(formatDate(new Date("2026-11-12T12:00:00Z")), "12 November 2026")
  })

  it("every billing template has a subject, HTML, plain text and the billing link", () => {
    const emails = [
      subscriptionActivatedEmail({ name: "A", planName: "Student Pro", amount: "£4.99", renewsOn: "12 November 2026", billingUrl }),
      paymentSucceededEmail({ name: "A", planName: "Student Pro", amount: "£4.99", renewsOn: null, billingUrl }),
      paymentFailedEmail({ name: "A", planName: "Student Pro", amount: "£4.99", nextAttemptOn: "14 November 2026", billingUrl }),
      cancellationScheduledEmail({ name: "A", planName: "Student Pro", endsOn: "1 December 2026", billingUrl }),
      subscriptionEndedEmail({ name: "A", planName: "Student Pro", billingUrl }),
    ]
    for (const email of emails) {
      assert.ok(email.subject.includes("Student Pro"))
      assert.ok(email.html.includes(billingUrl))
      assert.ok(email.text.includes(billingUrl))
    }
    assert.match(emails[2].text, /14 November 2026/)
    assert.match(emails[3].text, /until 1 December 2026/)
  })
})
