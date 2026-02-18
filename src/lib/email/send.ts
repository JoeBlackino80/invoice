import { Resend } from "resend"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendEmail({
  to, subject, html, from
}: {
  to: string
  subject: string
  html: string
  from?: string
}) {
  // If no API key, log and return (development mode)
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}`)
    return { success: true, dev: true }
  }

  const { data, error } = await getResend().emails.send({
    from: from || process.env.EMAIL_FROM || "Účtovníctvo <noreply@example.com>",
    to,
    subject,
    html,
  })

  if (error) {
    console.error("Email error:", error)
    return { success: false, error }
  }
  return { success: true, data }
}
