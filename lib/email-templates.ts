// Transactional templates. Visual style mirrors the password-reset email in
// lib/email.ts (which is deliberately left untouched). Pure functions with no
// imports, so they can be unit tested directly with `node --test`.

export type RenderedEmail = { subject: string; html: string; text: string }

type Detail = { label: string; value: string }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  )
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date)
}

export function formatMoney(amountInMinorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInMinorUnits / 100)
}

function firstName(name: string | null | undefined) {
  const trimmed = (name ?? "").trim()
  return trimmed ? trimmed.split(/\s+/)[0] : "there"
}

function layout({
  preheader,
  heading,
  paragraphs,
  details = [],
  cta,
  footnote,
}: {
  preheader: string
  heading: string
  paragraphs: string[]
  details?: Detail[]
  cta?: { label: string; url: string }
  footnote?: string
}) {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4b5468">${escapeHtml(p)}</p>`,
    )
    .join("")

  const detailRows = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid #e3e7ef;border-radius:10px;border-collapse:separate">
        ${details
          .map(
            (d, i) => `<tr>
          <td style="padding:10px 14px;font-size:13px;color:#7a8296;${i ? "border-top:1px solid #e3e7ef;" : ""}">${escapeHtml(d.label)}</td>
          <td align="right" style="padding:10px 14px;font-size:14px;font-weight:600;color:#1e2433;${i ? "border-top:1px solid #e3e7ef;" : ""}">${escapeHtml(d.value)}</td>
        </tr>`,
          )
          .join("")}
      </table>`
    : ""

  const button = cta
    ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#3d5bd9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(cta.label)}</a>`
    : ""

  const note = footnote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7a8296">${escapeHtml(footnote)}</p>`
    : ""

  return `<!doctype html>
<html lang="en-GB"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e2433">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e7ef;border-radius:14px;overflow:hidden">
        <tr><td style="height:4px;background:linear-gradient(90deg,#8b5cf6,#3b82f6,#34d399)"></td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:-0.01em">
            <span style="color:#8b5cf6">my</span>code<span style="color:#3b82f6">pad</span>
          </p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">${escapeHtml(heading)}</h1>
          ${body}
          ${detailRows}
          ${button}
          ${note}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9aa1b2">MyCodePad &middot; Code. Learn. Teach. Together.</p>
    </td></tr>
  </table>
</body></html>`
}

function plainText({
  greeting,
  paragraphs,
  details = [],
  cta,
  footnote,
}: {
  greeting: string
  paragraphs: string[]
  details?: Detail[]
  cta?: { label: string; url: string }
  footnote?: string
}) {
  return [
    greeting,
    ...paragraphs,
    details.length ? details.map((d) => `${d.label}: ${d.value}`).join("\n") : null,
    cta ? `${cta.label}: ${cta.url}` : null,
    footnote ?? null,
    "— The MyCodePad team",
  ]
    .filter(Boolean)
    .join("\n\n")
}

function render(input: {
  subject: string
  preheader: string
  heading: string
  name: string | null | undefined
  paragraphs: string[]
  details?: Detail[]
  cta?: { label: string; url: string }
  footnote?: string
}): RenderedEmail {
  const greeting = `Hi ${firstName(input.name)},`
  const paragraphs = [greeting, ...input.paragraphs]
  return {
    subject: input.subject,
    html: layout({ ...input, paragraphs }),
    text: plainText({ ...input, greeting, paragraphs: input.paragraphs }),
  }
}

export function welcomeEmail({
  name,
  role,
  dashboardUrl,
}: {
  name: string | null | undefined
  role: string | null | undefined
  dashboardUrl: string
}): RenderedEmail {
  const isTeacher = role === "teacher"
  return render({
    subject: "Welcome to MyCodePad",
    preheader: "Your coding workspace is ready.",
    heading: "Welcome to MyCodePad",
    name,
    paragraphs: isTeacher
      ? [
          "Your teacher account is ready. You can create a class, share its join code with your students and keep their coding projects and tasks organised in one place.",
          "Prefer to explore first? Python, HTML and more are available straight away in your browser.",
        ]
      : [
          "Your account is ready. Practise at your own pace with Python, HTML and more, all in your browser.",
          "If your teacher has given you a class code, you can join their class from your dashboard.",
        ],
    cta: { label: "Open your dashboard", url: dashboardUrl },
    footnote: "You're receiving this because a MyCodePad account was created with this email address.",
  })
}

export function subscriptionActivatedEmail({
  name,
  planName,
  amount,
  renewsOn,
  billingUrl,
}: {
  name: string | null | undefined
  planName: string
  amount: string
  renewsOn: string | null
  billingUrl: string
}): RenderedEmail {
  return render({
    subject: `Your ${planName} subscription is active`,
    preheader: `Thanks for subscribing to ${planName}.`,
    heading: "Your subscription is active",
    name,
    paragraphs: [
      `Thank you for subscribing. Your payment has been received and ${planName} is now active on your account.`,
    ],
    details: [
      { label: "Plan", value: planName },
      { label: "Amount paid", value: amount },
      ...(renewsOn ? [{ label: "Next renewal", value: renewsOn }] : []),
    ],
    cta: { label: "View billing", url: billingUrl },
    footnote: "You can manage or cancel your subscription at any time from your billing page.",
  })
}

export function paymentSucceededEmail({
  name,
  planName,
  amount,
  renewsOn,
  billingUrl,
}: {
  name: string | null | undefined
  planName: string
  amount: string
  renewsOn: string | null
  billingUrl: string
}): RenderedEmail {
  return render({
    subject: `Payment received for ${planName}`,
    preheader: `We've received your payment of ${amount}.`,
    heading: "Payment received",
    name,
    paragraphs: [`Thank you. We've received your payment and your ${planName} subscription continues as normal.`],
    details: [
      { label: "Plan", value: planName },
      { label: "Amount paid", value: amount },
      ...(renewsOn ? [{ label: "Next renewal", value: renewsOn }] : []),
    ],
    cta: { label: "View billing", url: billingUrl },
  })
}

export function paymentFailedEmail({
  name,
  planName,
  amount,
  nextAttemptOn,
  billingUrl,
}: {
  name: string | null | undefined
  planName: string
  amount: string
  nextAttemptOn: string | null
  billingUrl: string
}): RenderedEmail {
  return render({
    subject: `Action needed: payment for ${planName} failed`,
    preheader: "Please update your payment details to keep your subscription.",
    heading: "We couldn't take your payment",
    name,
    paragraphs: [
      `Your latest payment for ${planName} didn't go through. This can happen if a card has expired or the bank declined the charge.`,
      nextAttemptOn
        ? `We'll try again on ${nextAttemptOn}. To avoid any interruption, please check your payment details before then.`
        : "To avoid losing access, please update your payment details as soon as possible.",
    ],
    details: [
      { label: "Plan", value: planName },
      { label: "Amount due", value: amount },
    ],
    cta: { label: "Update payment details", url: billingUrl },
  })
}

export function cancellationScheduledEmail({
  name,
  planName,
  endsOn,
  billingUrl,
}: {
  name: string | null | undefined
  planName: string
  endsOn: string | null
  billingUrl: string
}): RenderedEmail {
  return render({
    subject: `Your ${planName} subscription is set to end`,
    preheader: endsOn ? `Access continues until ${endsOn}.` : "Your cancellation has been scheduled.",
    heading: "Your subscription is set to end",
    name,
    paragraphs: [
      endsOn
        ? `We've scheduled the cancellation of ${planName}. You'll keep full access until ${endsOn}, and you won't be charged again.`
        : `We've scheduled the cancellation of ${planName}. You won't be charged again.`,
      "Changed your mind? You can resume your subscription from your billing page before it ends.",
    ],
    cta: { label: "Manage subscription", url: billingUrl },
  })
}

export function subscriptionEndedEmail({
  name,
  planName,
  billingUrl,
}: {
  name: string | null | undefined
  planName: string
  billingUrl: string
}): RenderedEmail {
  return render({
    subject: `Your ${planName} subscription has ended`,
    preheader: "Your projects are still saved.",
    heading: "Your subscription has ended",
    name,
    paragraphs: [
      `Your ${planName} subscription has now ended and your account has moved to the free plan. Your saved projects are still there.`,
      "You can subscribe again at any time from your billing page.",
    ],
    cta: { label: "View plans", url: billingUrl },
  })
}
