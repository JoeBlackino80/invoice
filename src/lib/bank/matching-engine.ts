/**
 * Payment Matching Engine (Parovanie platieb)
 *
 * Matches bank transactions to invoices based on:
 * 1. Variable symbol (VS) match - confidence +0.5
 * 2. Amount match - confidence +0.3
 * 3. IBAN match - confidence +0.1
 * 4. Name match - confidence +0.1
 */

export interface MatchCandidate {
  invoice_id: string
  invoice_number: string
  contact_name: string
  total: number
  remaining: number // total - paid_amount
  confidence: number // 0-1
  match_reason: string
}

export interface MatchResult {
  transaction_id: string
  candidates: MatchCandidate[]
  best_match: MatchCandidate | null
  auto_match: boolean // true if confidence >= 0.9
}

export interface BankTransaction {
  id: string
  company_id: string
  bank_account_id: string
  bank_statement_id: string | null
  date: string
  amount: number
  counterparty_name: string | null
  counterparty_iban: string | null
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  description: string | null
  status: string
  matched_invoice_id: string | null
  journal_entry_id: string | null
}

export interface Invoice {
  id: string
  company_id: string
  number: string
  type: string // vydana | prijata
  variable_symbol: string | null
  total: number
  paid_amount: number
  status: string
  contact_id: string | null
}

export interface Contact {
  id: string
  name: string
  ico: string | null
}

export interface ContactBankAccount {
  contact_id: string
  iban: string
}

function normalizeString(s: string | null | undefined): string {
  if (!s) return ""
  return s.trim().toLowerCase()
}

function normalizeIban(iban: string | null | undefined): string {
  if (!iban) return ""
  return iban.replace(/\s+/g, "").toUpperCase()
}

/**
 * Find matching invoice candidates for a single bank transaction.
 */
export function findMatches(
  transaction: BankTransaction,
  invoices: Invoice[],
  contacts: Contact[],
  contactBankAccounts: ContactBankAccount[]
): MatchResult {
  const candidates: MatchCandidate[] = []
  const isCredit = transaction.amount > 0

  // Filter invoices by type:
  // Credit transactions (income) match to outgoing invoices (vydana)
  // Debit transactions (expense) match to incoming invoices (prijata)
  const eligibleInvoices = invoices.filter((inv) => {
    // Only match credit to vydana, debit to prijata
    if (isCredit && inv.type !== "vydana") return false
    if (!isCredit && inv.type !== "prijata") return false

    // Only consider invoices that are not fully paid and not cancelled
    if (inv.status === "uhradena" || inv.status === "stornovana") return false

    return true
  })

  // Build lookup maps for contacts and their bank accounts
  const contactMap = new Map<string, Contact>()
  for (const contact of contacts) {
    contactMap.set(contact.id, contact)
  }

  const contactIbanMap = new Map<string, string[]>()
  for (const cba of contactBankAccounts) {
    const existing = contactIbanMap.get(cba.contact_id) || []
    existing.push(normalizeIban(cba.iban))
    contactIbanMap.set(cba.contact_id, existing)
  }

  const txAbsAmount = Math.abs(transaction.amount)
  const txVS = transaction.variable_symbol?.trim() || ""
  const txIban = normalizeIban(transaction.counterparty_iban)
  const txName = normalizeString(transaction.counterparty_name)

  for (const invoice of eligibleInvoices) {
    let confidence = 0
    const reasons: string[] = []
    const remaining = invoice.total - (invoice.paid_amount || 0)

    // 1. Variable Symbol match (+0.5)
    const invoiceVS = invoice.variable_symbol?.trim() || ""
    if (txVS && invoiceVS && txVS === invoiceVS) {
      confidence += 0.5
      reasons.push("VS zhoda")
    }

    // 2. Amount match (+0.3): abs(transaction.amount) === remaining
    if (remaining > 0 && Math.abs(txAbsAmount - remaining) < 0.01) {
      confidence += 0.3
      reasons.push("Zhoda sumy")
    }

    // 3. IBAN match (+0.1)
    if (txIban && invoice.contact_id) {
      const contactIbans = contactIbanMap.get(invoice.contact_id) || []
      if (contactIbans.some((iban) => iban === txIban)) {
        confidence += 0.1
        reasons.push("IBAN zhoda")
      }
    }

    // 4. Name match (+0.1): counterparty_name contains contact.name
    if (txName && invoice.contact_id) {
      const contact = contactMap.get(invoice.contact_id)
      if (contact) {
        const contactName = normalizeString(contact.name)
        if (contactName && txName.includes(contactName)) {
          confidence += 0.1
          reasons.push("Zhoda nazvu")
        }
      }
    }

    // Only include candidates with some confidence
    if (confidence > 0) {
      const contact = invoice.contact_id ? contactMap.get(invoice.contact_id) : null
      candidates.push({
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        contact_name: contact?.name || "",
        total: invoice.total,
        remaining,
        confidence: Math.min(confidence, 1),
        match_reason: reasons.join(", "),
      })
    }
  }

  // Sort by confidence descending, take top 5
  candidates.sort((a, b) => b.confidence - a.confidence)
  const topCandidates = candidates.slice(0, 5)

  const bestMatch = topCandidates.length > 0 ? topCandidates[0] : null
  const autoMatch = bestMatch !== null && bestMatch.confidence >= 0.9

  return {
    transaction_id: transaction.id,
    candidates: topCandidates,
    best_match: bestMatch,
    auto_match: autoMatch,
  }
}

/**
 * Find matches for all provided transactions.
 */
export function findMatchesForAll(
  transactions: BankTransaction[],
  invoices: Invoice[],
  contacts: Contact[],
  contactBankAccounts: ContactBankAccount[]
): MatchResult[] {
  return transactions.map((tx) =>
    findMatches(tx, invoices, contacts, contactBankAccounts)
  )
}
