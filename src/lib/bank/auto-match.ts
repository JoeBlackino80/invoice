// Auto-matching bankových transakcií po importe
import type { SupabaseClient } from "@supabase/supabase-js"
import { findMatches } from "./matching-engine"

interface AutoMatchResult {
  matched: number
  unmatched: number
  details: Array<{
    transactionId: string
    invoiceId: string
    confidence: number
  }>
}

/**
 * Spustí automatické párovanie pre všetky nepárované transakcie
 */
export async function runAutoMatching(
  db: SupabaseClient,
  companyId: string,
  userId: string,
  bankAccountId?: string
): Promise<AutoMatchResult> {
  // 1. Načítať nepárované transakcie
  let txQuery = (db.from("bank_transactions") as any)
    .select("id, amount, counterparty_iban, counterparty_name, variable_symbol, constant_symbol, specific_symbol, description, transaction_date, bank_statement_id")
    .eq("status", "neparovana")
    .is("matched_invoice_id", null)

  if (bankAccountId) {
    txQuery = txQuery.eq("bank_account_id", bankAccountId)
  }

  // Filtrovať podľa company cez bank_statements
  const { data: transactions } = await txQuery.limit(200)

  if (!transactions || transactions.length === 0) {
    return { matched: 0, unmatched: 0, details: [] }
  }

  // 2. Načítať kandidátov (neuhradené faktúry)
  const { data: invoices } = await (db.from("invoices") as any)
    .select("id, number, type, total, paid_amount, status, contact_id, variable_symbol")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("status", "in", '("uhradena","stornovana")')

  if (!invoices || invoices.length === 0) {
    return { matched: 0, unmatched: transactions.length, details: [] }
  }

  // 3. Načítať kontakty a bankové účty
  const { data: contacts } = await (db.from("contacts") as any)
    .select("id, name, ico")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  const { data: contactBankAccounts } = await (db.from("contact_bank_accounts") as any)
    .select("contact_id, iban")
    .eq("company_id", companyId)

  let matchedCount = 0
  const details: AutoMatchResult["details"] = []

  // 4. Pre každú transakciu nájsť najlepší match
  for (const tx of transactions) {
    try {
      const result = findMatches(tx, invoices, contacts || [], contactBankAccounts || [])

      // Auto-párovať len ak auto_match a best_match existuje
      if (result.auto_match && result.best_match) {
        const best = result.best_match

        // Aktualizovať transakciu
        await (db.from("bank_transactions") as any)
          .update({
            matched_invoice_id: best.invoice_id,
            status: "parovana",
            updated_by: userId,
          })
          .eq("id", tx.id)

        matchedCount++
        details.push({
          transactionId: tx.id,
          invoiceId: best.invoice_id,
          confidence: best.confidence,
        })
      }
    } catch {
      // Skip transakciu ak matching zlyhá
      continue
    }
  }

  return {
    matched: matchedCount,
    unmatched: transactions.length - matchedCount,
    details,
  }
}
