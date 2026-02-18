/**
 * SEPA XML pain.001.001.03 (Credit Transfer Initiation) generator
 * for Slovak banking payment orders.
 *
 * Generates valid SEPA XML documents compatible with Slovak banks.
 * Supports VS/KS/SS (variable, constant, specific symbols) in RemittanceInformation.
 */

export interface SepaPayment {
  id: string // unique payment ID (EndToEndId)
  amount: number
  currency: string
  creditor_name: string
  creditor_iban: string
  creditor_bic?: string
  variable_symbol?: string
  constant_symbol?: string
  specific_symbol?: string
  remittance_info?: string // payment reference/description
  requested_date?: string // YYYY-MM-DD, defaults to today
}

export interface SepaDocument {
  message_id: string // unique message ID
  creation_date: string // ISO datetime
  initiator_name: string // company name
  debtor_name: string // company name
  debtor_iban: string // company IBAN
  debtor_bic?: string
  payments: SepaPayment[]
}

/**
 * Escape special XML characters in a string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Truncate a string to a maximum length (SEPA fields have character limits).
 */
function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) : str
}

/**
 * Format an amount to two decimal places for SEPA XML.
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Build the remittance info string from VS/KS/SS and optional description.
 * Slovak format: /VS{vs}/KS{ks}/SS{ss} followed by optional description.
 */
function buildRemittanceInfo(payment: SepaPayment): string {
  const parts: string[] = []

  if (payment.variable_symbol) {
    parts.push(`/VS${payment.variable_symbol}`)
  }
  if (payment.constant_symbol) {
    parts.push(`/KS${payment.constant_symbol}`)
  }
  if (payment.specific_symbol) {
    parts.push(`/SS${payment.specific_symbol}`)
  }

  let info = parts.join("")

  if (payment.remittance_info) {
    if (info) {
      info += " " + payment.remittance_info
    } else {
      info = payment.remittance_info
    }
  }

  // SEPA Unstructured remittance info max 140 characters
  return truncate(info, 140)
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Generate a valid SEPA pain.001.001.03 XML document.
 *
 * @param doc - The SEPA document configuration with payments
 * @returns The complete XML string
 */
export function generateSepaXml(doc: SepaDocument): string {
  const nbOfTxs = doc.payments.length
  const ctrlSum = doc.payments.reduce((sum, p) => sum + p.amount, 0)
  const requestedDate = doc.payments[0]?.requested_date || getTodayDate()

  const lines: string[] = []

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')

  // Root element with namespace
  lines.push(
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  )
  lines.push("  <CstmrCdtTrfInitn>")

  // ── Group Header ──
  lines.push("    <GrpHdr>")
  lines.push(`      <MsgId>${escapeXml(truncate(doc.message_id, 35))}</MsgId>`)
  lines.push(`      <CreDtTm>${escapeXml(doc.creation_date)}</CreDtTm>`)
  lines.push(`      <NbOfTxs>${nbOfTxs}</NbOfTxs>`)
  lines.push(`      <CtrlSum>${formatAmount(ctrlSum)}</CtrlSum>`)
  lines.push("      <InitgPty>")
  lines.push(`        <Nm>${escapeXml(truncate(doc.initiator_name, 70))}</Nm>`)
  lines.push("      </InitgPty>")
  lines.push("    </GrpHdr>")

  // ── Payment Information ──
  lines.push("    <PmtInf>")
  lines.push(
    `      <PmtInfId>${escapeXml(truncate(doc.message_id + "-PMT", 35))}</PmtInfId>`
  )
  lines.push("      <PmtMtd>TRF</PmtMtd>")
  lines.push(`      <NbOfTxs>${nbOfTxs}</NbOfTxs>`)
  lines.push(`      <CtrlSum>${formatAmount(ctrlSum)}</CtrlSum>`)

  // Payment Type Information
  lines.push("      <PmtTpInf>")
  lines.push("        <SvcLvl>")
  lines.push("          <Cd>SEPA</Cd>")
  lines.push("        </SvcLvl>")
  lines.push("      </PmtTpInf>")

  // Requested Execution Date
  lines.push(`      <ReqdExctnDt>${requestedDate}</ReqdExctnDt>`)

  // Debtor (company sending the payment)
  lines.push("      <Dbtr>")
  lines.push(`        <Nm>${escapeXml(truncate(doc.debtor_name, 70))}</Nm>`)
  lines.push("      </Dbtr>")

  // Debtor Account
  lines.push("      <DbtrAcct>")
  lines.push("        <Id>")
  lines.push(
    `          <IBAN>${escapeXml(doc.debtor_iban.replace(/\s/g, ""))}</IBAN>`
  )
  lines.push("        </Id>")
  lines.push("      </DbtrAcct>")

  // Debtor Agent (BIC)
  lines.push("      <DbtrAgt>")
  lines.push("        <FinInstnId>")
  if (doc.debtor_bic) {
    lines.push(`          <BIC>${escapeXml(doc.debtor_bic)}</BIC>`)
  } else {
    lines.push("          <Othr>")
    lines.push("            <Id>NOTPROVIDED</Id>")
    lines.push("          </Othr>")
  }
  lines.push("        </FinInstnId>")
  lines.push("      </DbtrAgt>")

  // Charge Bearer
  lines.push("      <ChrgBr>SLEV</ChrgBr>")

  // ── Credit Transfer Transaction Information (one per payment) ──
  for (const payment of doc.payments) {
    lines.push("      <CdtTrfTxInf>")

    // Payment ID
    lines.push("        <PmtId>")
    lines.push(
      `          <EndToEndId>${escapeXml(truncate(payment.id, 35))}</EndToEndId>`
    )
    lines.push("        </PmtId>")

    // Amount
    lines.push("        <Amt>")
    lines.push(
      `          <InstdAmt Ccy="${escapeXml(payment.currency)}">${formatAmount(payment.amount)}</InstdAmt>`
    )
    lines.push("        </Amt>")

    // Creditor Agent (BIC)
    if (payment.creditor_bic) {
      lines.push("        <CdtrAgt>")
      lines.push("          <FinInstnId>")
      lines.push(
        `            <BIC>${escapeXml(payment.creditor_bic)}</BIC>`
      )
      lines.push("          </FinInstnId>")
      lines.push("        </CdtrAgt>")
    }

    // Creditor
    lines.push("        <Cdtr>")
    lines.push(
      `          <Nm>${escapeXml(truncate(payment.creditor_name, 70))}</Nm>`
    )
    lines.push("        </Cdtr>")

    // Creditor Account
    lines.push("        <CdtrAcct>")
    lines.push("          <Id>")
    lines.push(
      `            <IBAN>${escapeXml(payment.creditor_iban.replace(/\s/g, ""))}</IBAN>`
    )
    lines.push("          </Id>")
    lines.push("        </CdtrAcct>")

    // Remittance Information
    const remittanceInfo = buildRemittanceInfo(payment)
    if (remittanceInfo) {
      lines.push("        <RmtInf>")
      lines.push(
        `          <Ustrd>${escapeXml(remittanceInfo)}</Ustrd>`
      )
      lines.push("        </RmtInf>")
    }

    lines.push("      </CdtTrfTxInf>")
  }

  lines.push("    </PmtInf>")
  lines.push("  </CstmrCdtTrfInitn>")
  lines.push("</Document>")

  return lines.join("\n")
}
