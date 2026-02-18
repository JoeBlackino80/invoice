/**
 * Slovak email templates for the invoicing system
 */

interface InvoiceData {
  id: string
  number: string
  total: number
  currency?: string
  issue_date: string
  due_date: string
  supplier_name?: string
  customer_name?: string
  contact?: {
    name: string
    email?: string
  }
}

interface CompanyData {
  name: string
  ico?: string
  email?: string
  phone?: string
}

interface PaymentData {
  amount: number
  currency?: string
  paid_at: string
  payment_method?: string
}

/**
 * Email template for sending an invoice to a customer
 */
export function invoiceEmailTemplate(invoice: InvoiceData, company: CompanyData): string {
  const currency = invoice.currency || "EUR"
  const contactName = invoice.contact?.name || invoice.customer_name || "Vážený zákazník"

  return `
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #1a1a2e; margin-top: 0;">Faktúra č. ${invoice.number}</h2>
    <p>Dobrý deň, ${contactName},</p>
    <p>v prílohe Vám zasielame faktúru č. <strong>${invoice.number}</strong>.</p>

    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #4361ee;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Číslo faktúry:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.number}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Dátum vystavenia:</td>
          <td style="padding: 5px 0; text-align: right;">${invoice.issue_date}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Dátum splatnosti:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #e63946;">${invoice.due_date}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Suma na úhradu:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 1.2em;">${invoice.total.toFixed(2)} ${currency}</td>
        </tr>
      </table>
    </div>

    <p>Prosíme o úhradu do dátumu splatnosti uvedeného na faktúre.</p>
    <p>V prípade otázok nás neváhajte kontaktovať.</p>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
    <p style="color: #666; font-size: 0.9em; margin-bottom: 0;">
      S pozdravom,<br>
      <strong>${company.name}</strong>
      ${company.email ? `<br>${company.email}` : ""}
      ${company.phone ? `<br>${company.phone}` : ""}
    </p>
  </div>
</body>
</html>`
}

/**
 * Email template for payment received confirmation
 */
export function paymentConfirmationTemplate(invoice: InvoiceData, payment: PaymentData): string {
  const currency = payment.currency || invoice.currency || "EUR"
  const contactName = invoice.contact?.name || invoice.customer_name || "Vážený zákazník"

  return `
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #2d6a4f; margin-top: 0;">Potvrdenie o prijatí platby</h2>
    <p>Dobrý deň, ${contactName},</p>
    <p>potvrdzujeme prijatie platby za faktúru č. <strong>${invoice.number}</strong>.</p>

    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2d6a4f;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Číslo faktúry:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.number}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Prijatá suma:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 1.2em; color: #2d6a4f;">${payment.amount.toFixed(2)} ${currency}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Dátum platby:</td>
          <td style="padding: 5px 0; text-align: right;">${payment.paid_at}</td>
        </tr>
        ${payment.payment_method ? `
        <tr>
          <td style="padding: 5px 0; color: #666;">Spôsob platby:</td>
          <td style="padding: 5px 0; text-align: right;">${payment.payment_method}</td>
        </tr>` : ""}
      </table>
    </div>

    <p>Ďakujeme za Vašu platbu.</p>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
    <p style="color: #666; font-size: 0.9em; margin-bottom: 0;">
      Toto je automaticky generované potvrdenie.
    </p>
  </div>
</body>
</html>`
}

/**
 * Email template for payment reminder (overdue invoice)
 */
export function reminderEmailTemplate(invoice: InvoiceData, company: CompanyData, daysOverdue: number): string {
  const currency = invoice.currency || "EUR"
  const contactName = invoice.contact?.name || invoice.customer_name || "Vážený zákazník"

  return `
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #e63946; margin-top: 0;">Upomienka - Faktúra č. ${invoice.number}</h2>
    <p>Dobrý deň, ${contactName},</p>
    <p>dovoľujeme si Vás upozorniť, že faktúra č. <strong>${invoice.number}</strong> je po splatnosti <strong>${daysOverdue} dní</strong>.</p>

    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #e63946;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Číslo faktúry:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${invoice.number}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Dátum splatnosti:</td>
          <td style="padding: 5px 0; text-align: right; color: #e63946; font-weight: bold;">${invoice.due_date}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Dni po splatnosti:</td>
          <td style="padding: 5px 0; text-align: right; color: #e63946; font-weight: bold;">${daysOverdue}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Suma na úhradu:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; font-size: 1.2em;">${invoice.total.toFixed(2)} ${currency}</td>
        </tr>
      </table>
    </div>

    <p>Prosíme o urýchlenú úhradu. Ak ste medzičasom platbu uskutočnili, považujte túto upomienku za bezpredmetnú.</p>
    <p>V prípade otázok nás neváhajte kontaktovať.</p>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
    <p style="color: #666; font-size: 0.9em; margin-bottom: 0;">
      S pozdravom,<br>
      <strong>${company.name}</strong>
      ${company.email ? `<br>${company.email}` : ""}
      ${company.phone ? `<br>${company.phone}` : ""}
    </p>
  </div>
</body>
</html>`
}

/**
 * Email template for portal access token
 */
export function portalTokenTemplate(token: string, companyName: string): string {
  return `
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #1a1a2e; margin-top: 0;">Prístupový kód do portálu</h2>
    <p>Dobrý deň,</p>
    <p>Váš prístupový kód pre portál spoločnosti <strong>${companyName}</strong>:</p>

    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; border: 2px dashed #4361ee;">
      <span style="font-size: 2em; font-weight: bold; letter-spacing: 0.3em; color: #4361ee;">${token}</span>
    </div>

    <p>Kód je platný <strong>15 minút</strong>.</p>
    <p style="color: #e63946;">Ak ste o tento kód nežiadali, tento email môžete ignorovať.</p>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
    <p style="color: #666; font-size: 0.9em; margin-bottom: 0;">
      Toto je automaticky generovaná správa od spoločnosti <strong>${companyName}</strong>.
    </p>
  </div>
</body>
</html>`
}
