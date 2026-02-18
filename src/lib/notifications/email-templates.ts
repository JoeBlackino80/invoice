interface EmailOutput {
  subject: string
  html: string
}

function baseLayout(companyName: string, content: string, actionUrl?: string, actionLabel?: string): string {
  const actionButton = actionUrl && actionLabel
    ? `
      <tr>
        <td style="padding: 24px 0;">
          <table border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background-color: #2563eb; border-radius: 6px;">
                <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">
                  ${actionLabel}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                ${companyName}
              </h1>
            </td>
          </tr>
          <!-- Obsah -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                ${content}
                ${actionButton}
              </table>
            </td>
          </tr>
          <!-- Päta -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                Tento email bol automaticky vygenerovaný systémom ${companyName}.
                Pre správu notifikácií prejdite do Nastavenia &gt; Notifikácie.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function invoiceOverdueTemplate(
  invoiceNumber: string,
  contactName: string,
  amount: string,
  daysPastDue: number,
  companyName: string
): EmailOutput {
  const daysText = daysPastDue === 1 ? "deň" : daysPastDue < 5 ? "dni" : "dní"

  const content = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px 0; color: #dc2626; font-size: 18px;">
          Faktúra po splatnosti
        </h2>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
          Faktúra <strong>${invoiceNumber}</strong> pre kontakt <strong>${contactName}</strong>
          je <strong>${daysPastDue} ${daysText}</strong> po splatnosti.
        </p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca; margin-bottom: 16px;">
          <tr>
            <td style="padding: 16px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Číslo faktúry</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Kontakt</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${contactName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Suma</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${amount}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px;">Dní po splatnosti</td>
                  <td align="right" style="color: #dc2626; font-size: 13px; font-weight: 700;">${daysPastDue}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
          Odporúčame kontaktovať zákazníka a pripomenúť platbu.
        </p>
      </td>
    </tr>`

  return {
    subject: `Faktúra ${invoiceNumber} je ${daysPastDue} ${daysText} po splatnosti`,
    html: baseLayout(companyName, content, undefined, undefined),
  }
}

export function deadlineApproachingTemplate(
  deadlineName: string,
  dueDate: string,
  daysRemaining: number,
  companyName: string
): EmailOutput {
  const daysText = daysRemaining === 1 ? "deň" : daysRemaining < 5 ? "dni" : "dní"

  const content = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px 0; color: #f59e0b; font-size: 18px;">
          Blížiaci sa termín
        </h2>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
          Termín <strong>${deadlineName}</strong> vyprší za <strong>${daysRemaining} ${daysText}</strong>.
        </p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 6px; border: 1px solid #fde68a; margin-bottom: 16px;">
          <tr>
            <td style="padding: 16px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Názov</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${deadlineName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Dátum splatnosti</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${dueDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px;">Zostáva</td>
                  <td align="right" style="color: #f59e0b; font-size: 13px; font-weight: 700;">${daysRemaining} ${daysText}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  return {
    subject: `Termín ${deadlineName} vyprší za ${daysRemaining} ${daysText}`,
    html: baseLayout(companyName, content, undefined, undefined),
  }
}

export function paymentReceivedTemplate(
  invoiceNumber: string,
  amount: string,
  contactName: string,
  companyName: string
): EmailOutput {
  const content = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px 0; color: #16a34a; font-size: 18px;">
          Platba prijatá
        </h2>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
          Bola prijatá platba za faktúru <strong>${invoiceNumber}</strong> od kontaktu <strong>${contactName}</strong>.
        </p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0; margin-bottom: 16px;">
          <tr>
            <td style="padding: 16px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Číslo faktúry</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding-bottom: 8px;">Kontakt</td>
                  <td align="right" style="color: #1e293b; font-size: 13px; font-weight: 600; padding-bottom: 8px;">${contactName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px;">Suma</td>
                  <td align="right" style="color: #16a34a; font-size: 13px; font-weight: 700;">${amount}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  return {
    subject: `Platba ${amount} prijatá za faktúru ${invoiceNumber}`,
    html: baseLayout(companyName, content, undefined, undefined),
  }
}

export function genericNotificationTemplate(
  title: string,
  message: string,
  companyName: string,
  actionUrl?: string,
  actionLabel?: string
): EmailOutput {
  const content = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px;">
          ${title}
        </h2>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
          ${message}
        </p>
      </td>
    </tr>`

  return {
    subject: title,
    html: baseLayout(companyName, content, actionUrl, actionLabel),
  }
}
