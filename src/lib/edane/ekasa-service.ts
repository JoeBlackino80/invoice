/**
 * eKasa Integration Service
 *
 * Prepared architecture for integration with the Slovak eKasa system
 * (electronic cash register). Handles import of daily closing data,
 * matching with cash register entries, and generation of accounting
 * journal entries.
 */

// ===================== Types =====================

export interface EKasaReceiptItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  vat_amount: number
}

export interface EKasaReceipt {
  id: string
  receipt_number: string
  amount: number
  vat_amount: number
  date: string
  items: EKasaReceiptItem[]
  okp: string // overovaci kod podnikatela
  uid: string // unikatny identifikator dokladu
}

export interface EKasaDailySummary {
  date: string
  total_receipts: number
  total_amount: number
  total_vat: number
}

export interface CashTransaction {
  id: string
  date: string
  amount: number
  description: string
  document_number: string | null
}

export interface MatchResult {
  matched: Array<{
    receipt: EKasaReceipt
    transaction: CashTransaction
  }>
  unmatched_receipts: EKasaReceipt[]
  unmatched_transactions: CashTransaction[]
  match_rate: number // percentage 0-100
}

export interface AccountingEntry {
  date: string
  description: string
  debit_account: string
  credit_account: string
  amount: number
  document_number: string
}

export interface ImportResult {
  success: boolean
  message: string
  summary: EKasaDailySummary
  receipts_imported: number
  entries_generated: number
}

// ===================== Helpers =====================

/**
 * Round to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
  return `ekasa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ===================== Service Functions =====================

/**
 * Import daily closing data from eKasa.
 *
 * Processes an array of eKasa receipts for a given date,
 * generates a daily summary, and creates accounting entries.
 *
 * In production, this would connect to the eKasa API or
 * process an exported data file from the eKasa device.
 *
 * @param companyId - Company ID
 * @param date - Date of the daily closing (YYYY-MM-DD)
 * @param receipts - Array of eKasa receipts
 * @returns ImportResult with summary and generated entries count
 */
export function importDailyClosing(
  companyId: string,
  date: string,
  receipts: EKasaReceipt[]
): ImportResult {
  if (!receipts || receipts.length === 0) {
    return {
      success: false,
      message: "Ziadne bločky na import",
      summary: {
        date,
        total_receipts: 0,
        total_amount: 0,
        total_vat: 0,
      },
      receipts_imported: 0,
      entries_generated: 0,
    }
  }

  // Calculate daily summary
  const summary = calculateDailySummary(date, receipts)

  // Generate accounting entries
  const entries = generateEKasaAccountingEntries(receipts)

  return {
    success: true,
    message: `Uspesne importovanych ${receipts.length} bločkov za den ${date}. Celkova suma: ${summary.total_amount.toFixed(2)} EUR`,
    summary,
    receipts_imported: receipts.length,
    entries_generated: entries.length,
  }
}

/**
 * Calculate daily summary from receipts.
 */
export function calculateDailySummary(
  date: string,
  receipts: EKasaReceipt[]
): EKasaDailySummary {
  let totalAmount = 0
  let totalVat = 0

  for (const receipt of receipts) {
    totalAmount += Number(receipt.amount) || 0
    totalVat += Number(receipt.vat_amount) || 0
  }

  return {
    date,
    total_receipts: receipts.length,
    total_amount: round2(totalAmount),
    total_vat: round2(totalVat),
  }
}

/**
 * Match eKasa receipts with cash register (pokladna) transactions.
 *
 * Matching is performed by:
 * 1. Exact amount match on the same date
 * 2. Document number match (if available)
 *
 * @param receipts - eKasa receipts to match
 * @param cashTransactions - Cash register transactions to match against
 * @returns MatchResult with matched pairs and unmatched items
 */
export function matchWithCashRegister(
  receipts: EKasaReceipt[],
  cashTransactions: CashTransaction[]
): MatchResult {
  const matched: MatchResult["matched"] = []
  const usedReceiptIds = new Set<string>()
  const usedTransactionIds = new Set<string>()

  // Pass 1: Match by document number (strongest match)
  for (const receipt of receipts) {
    if (usedReceiptIds.has(receipt.id)) continue

    for (const transaction of cashTransactions) {
      if (usedTransactionIds.has(transaction.id)) continue

      if (
        transaction.document_number &&
        (transaction.document_number === receipt.receipt_number ||
          transaction.document_number === receipt.uid)
      ) {
        matched.push({ receipt, transaction })
        usedReceiptIds.add(receipt.id)
        usedTransactionIds.add(transaction.id)
        break
      }
    }
  }

  // Pass 2: Match by amount and date
  for (const receipt of receipts) {
    if (usedReceiptIds.has(receipt.id)) continue

    for (const transaction of cashTransactions) {
      if (usedTransactionIds.has(transaction.id)) continue

      const amountMatch =
        Math.abs(Number(receipt.amount) - Math.abs(Number(transaction.amount))) < 0.01
      const dateMatch = receipt.date === transaction.date

      if (amountMatch && dateMatch) {
        matched.push({ receipt, transaction })
        usedReceiptIds.add(receipt.id)
        usedTransactionIds.add(transaction.id)
        break
      }
    }
  }

  const unmatchedReceipts = receipts.filter((r) => !usedReceiptIds.has(r.id))
  const unmatchedTransactions = cashTransactions.filter(
    (t) => !usedTransactionIds.has(t.id)
  )

  const totalItems = receipts.length + cashTransactions.length
  const matchRate = totalItems > 0 ? round2((matched.length * 2 / totalItems) * 100) : 0

  return {
    matched,
    unmatched_receipts: unmatchedReceipts,
    unmatched_transactions: unmatchedTransactions,
    match_rate: matchRate,
  }
}

/**
 * Generate accounting journal entries from eKasa receipts.
 *
 * Standard accounting entries for cash sales in Slovak accounting:
 * - Sales revenue: Debit 211 (Pokladna) / Credit 604 (Trzby za tovar) or 602 (Trzby za sluzby)
 * - VAT: Debit 211 (Pokladna) / Credit 343 (Dan z pridanej hodnoty)
 *
 * For simplicity, we use:
 * - 211/604 for the net amount (zaklad dane)
 * - 211/343 for the VAT amount
 *
 * @param receipts - eKasa receipts to generate entries for
 * @returns Array of AccountingEntry
 */
export function generateEKasaAccountingEntries(
  receipts: EKasaReceipt[]
): AccountingEntry[] {
  const entries: AccountingEntry[] = []

  for (const receipt of receipts) {
    const netAmount = round2(
      (Number(receipt.amount) || 0) - (Number(receipt.vat_amount) || 0)
    )
    const vatAmount = round2(Number(receipt.vat_amount) || 0)

    // Revenue entry: 211 / 604
    if (netAmount > 0) {
      entries.push({
        date: receipt.date,
        description: `eKasa trzba - blocok ${receipt.receipt_number}`,
        debit_account: "211",
        credit_account: "604",
        amount: netAmount,
        document_number: receipt.receipt_number,
      })
    }

    // VAT entry: 211 / 343
    if (vatAmount > 0) {
      entries.push({
        date: receipt.date,
        description: `eKasa DPH - blocok ${receipt.receipt_number}`,
        debit_account: "211",
        credit_account: "343",
        amount: vatAmount,
        document_number: receipt.receipt_number,
      })
    }
  }

  return entries
}

/**
 * Generate sample/mock eKasa receipts for testing.
 *
 * @param date - Date for the receipts
 * @param count - Number of receipts to generate
 * @returns Array of EKasaReceipt
 */
export function generateMockReceipts(
  date: string,
  count: number
): EKasaReceipt[] {
  const receipts: EKasaReceipt[] = []

  for (let i = 0; i < count; i++) {
    const itemCount = Math.floor(Math.random() * 4) + 1
    const items: EKasaReceiptItem[] = []
    let totalAmount = 0
    let totalVat = 0

    for (let j = 0; j < itemCount; j++) {
      const unitPrice = round2(Math.random() * 50 + 1)
      const quantity = Math.floor(Math.random() * 3) + 1
      const totalPrice = round2(unitPrice * quantity)
      const vatRate = Math.random() > 0.3 ? 23 : 10
      const vatAmt = round2(totalPrice - totalPrice / (1 + vatRate / 100))

      items.push({
        name: `Polozka ${j + 1}`,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        vat_rate: vatRate,
        vat_amount: vatAmt,
      })

      totalAmount += totalPrice
      totalVat += vatAmt
    }

    const seqNum = String(i + 1).padStart(4, "0")

    receipts.push({
      id: generateId(),
      receipt_number: `BL-${date.replace(/-/g, "")}-${seqNum}`,
      amount: round2(totalAmount),
      vat_amount: round2(totalVat),
      date,
      items,
      okp: generateOKP(),
      uid: generateUID(),
    })
  }

  return receipts
}

/**
 * Generate a simulated OKP (overovaci kod podnikatela).
 */
function generateOKP(): string {
  const chars = "0123456789abcdef"
  let result = ""
  for (let i = 0; i < 8; i++) {
    if (i > 0 && i % 4 === 0) result += "-"
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result.toUpperCase()
}

/**
 * Generate a simulated UID (unikatny identifikator dokladu).
 */
function generateUID(): string {
  const chars = "0123456789abcdef"
  let result = "O-"
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += ""
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result.toUpperCase()
}
