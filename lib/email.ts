import "server-only"

type Email = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "rejected" | "network_error"; status?: number }

const isDev = () => process.env.NODE_ENV === "development"

function fromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM
  const domain = process.env.RESEND_EMAIL_DOMAIN
  return domain ? `mycodepad <no-reply@${domain}>` : "mycodepad <onboarding@resend.dev>"
}

/**
 * Sends through Resend's REST API and never throws: callers get a result they
 * can log or ignore. In development the message is also logged whenever it
 * can't be delivered, so links can still be followed before the sending domain
 * is verified. Production logs never contain the recipient or message body.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: Email): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const logForDev = () => console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}`)

  if (!apiKey) {
    if (isDev()) logForDev()
    else console.warn("[email] RESEND_API_KEY is not set; email was not sent.")
    return { ok: false, reason: "not_configured" }
  }

  let res: Response
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: fromAddress(), to, subject, html, text }),
    })
  } catch (error) {
    console.error(
      "[email] Could not reach Resend:",
      error instanceof Error ? error.message : "unknown error",
    )
    if (isDev()) logForDev()
    return { ok: false, reason: "network_error" }
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300)
    console.error("[email] Resend rejected the message:", res.status, detail)
    if (isDev()) logForDev()
    return { ok: false, reason: "rejected", status: res.status }
  }

  const body = (await res.json().catch(() => null)) as { id?: string } | null
  return { ok: true, id: body?.id ?? null }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  )
}

export function passwordResetEmail({ name, url }: { name: string; url: string }) {
  const safeName = escapeHtml(name || "there")
  const safeUrl = escapeHtml(url)

  return {
    subject: "Reset your mycodepad password",
    text: `Hi ${name || "there"},\n\nWe received a request to reset your mycodepad password. Open this link to choose a new one (it expires in 1 hour):\n\n${url}\n\nIf you didn't ask for this, you can ignore this email; your password won't change.`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e2433">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e7ef;border-radius:14px;overflow:hidden">
        <tr><td style="height:4px;background:linear-gradient(90deg,#8b5cf6,#3b82f6,#34d399)"></td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:-0.01em">
            <span style="color:#8b5cf6">my</span>code<span style="color:#3b82f6">pad</span>
          </p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5468">
            Hi ${safeName}, we received a request to reset your password. This link expires in 1 hour.
          </p>
          <a href="${safeUrl}" style="display:inline-block;background:#3d5bd9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Choose a new password</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7a8296">
            If you didn't ask for this, you can safely ignore this email; your password won't change.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }
}
