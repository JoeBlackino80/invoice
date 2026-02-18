// Automatické účtovanie pri vytvorení faktúry, úhrade a bankovom pohybe
import type { SupabaseClient } from "@supabase/supabase-js"

interface AutoPostingConfig {
  db: SupabaseClient
  companyId: string
  userId: string
}

interface PostingResult {
  success: boolean
  journalEntryId?: string
  error?: string
}

/**
 * Nájde účet podľa syntetického čísla
 */
async function findAccount(db: SupabaseClient, companyId: string, synthAccount: string): Promise<string | null> {
  const { data } = await (db.from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("synth_account", synthAccount)
    .is("deleted_at", null)
    .limit(1)
    .single()
  return data?.id || null
}

/**
 * Generuje číslo účtovného dokladu
 */
async function generateEntryNumber(db: SupabaseClient, companyId: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear()
  const { data: existing } = await (db.from("journal_entries") as any)
    .select("entry_number")
    .eq("company_id", companyId)
    .like("entry_number", `${prefix}${year}%`)
    .order("entry_number", { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const lastNum = existing[0].entry_number
    const numPart = parseInt(lastNum.replace(`${prefix}${year}`, ""), 10)
    if (!isNaN(numPart)) seq = numPart + 1
  }

  return `${prefix}${year}${String(seq).padStart(6, "0")}`
}

/**
 * Vytvorí účtovný zápis pri odoslaní faktúry
 * Vydaná: MD 311 (Odberatelia) / D 602 (Tržby) + MD 311 / D 343 (DPH)
 * Prijatá: MD 518 (Služby) / D 321 (Dodávatelia) + MD 343 / D 321
 */
export async function createInvoiceJournalEntry(
  config: AutoPostingConfig,
  invoiceId: string
): Promise<PostingResult> {
  const { db, companyId, userId } = config

  try {
    // Načítať faktúru
    const { data: invoice, error: invError } = await (db.from("invoices") as any)
      .select("id, type, subtotal, vat_amount, total, number, issue_date, contact_id")
      .eq("id", invoiceId)
      .single()

    if (invError || !invoice) {
      return { success: false, error: "Faktúra nenájdená" }
    }

    const subtotal = Number(invoice.subtotal) || 0
    const vatAmount = Number(invoice.vat_amount) || 0
    const total = Number(invoice.total) || 0

    if (total === 0) return { success: true } // Nulová faktúra

    const isIssued = invoice.type === "vydana" || invoice.type === "proforma"
    const prefix = isIssued ? "FA" : "PFA"

    // Nájsť účty
    let accountReceivable: string | null = null
    let accountRevenue: string | null = null
    let accountVAT: string | null = null

    if (isIssued) {
      accountReceivable = await findAccount(db, companyId, "311") // Odberatelia
      accountRevenue = await findAccount(db, companyId, "602")    // Tržby z predaja služieb
      accountVAT = await findAccount(db, companyId, "343")        // DPH
    } else {
      accountReceivable = await findAccount(db, companyId, "321") // Dodávatelia
      accountRevenue = await findAccount(db, companyId, "518")    // Ostatné služby
      accountVAT = await findAccount(db, companyId, "343")        // DPH
    }

    if (!accountReceivable || !accountRevenue) {
      return { success: false, error: `Účty ${isIssued ? "311/602" : "321/518"} nie sú v účtovom rozvrhu` }
    }

    const entryNumber = await generateEntryNumber(db, companyId, prefix)

    // Vytvoriť hlavičku
    const { data: entry, error: entryError } = await (db.from("journal_entries") as any)
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_type: isIssued ? "FA" : "PFA",
        entry_date: invoice.issue_date,
        description: `Automatické zaúčtovanie faktúry ${invoice.number}`,
        total_debit: total,
        total_credit: total,
        status: "zauctovany",
        source_invoice_id: invoiceId,
        created_by: userId,
      })
      .select("id")
      .single()

    if (entryError || !entry) {
      return { success: false, error: entryError?.message || "Chyba pri vytváraní zápisu" }
    }

    // Vytvoriť riadky
    const lines: any[] = []

    if (isIssued) {
      // Vydaná: MD 311 / D 602 (základ) + D 343 (DPH)
      lines.push({
        journal_entry_id: entry.id,
        account_id: accountReceivable,
        side: "MD",
        amount: total,
        description: `Pohľadávka - ${invoice.number}`,
      })
      if (subtotal > 0) {
        lines.push({
          journal_entry_id: entry.id,
          account_id: accountRevenue,
          side: "D",
          amount: subtotal,
          description: `Tržby - ${invoice.number}`,
        })
      }
      if (vatAmount > 0 && accountVAT) {
        lines.push({
          journal_entry_id: entry.id,
          account_id: accountVAT,
          side: "D",
          amount: vatAmount,
          description: `DPH výstup - ${invoice.number}`,
        })
      }
    } else {
      // Prijatá: MD 518 / D 321 (základ) + MD 343 / D 321 (DPH)
      if (subtotal > 0) {
        lines.push({
          journal_entry_id: entry.id,
          account_id: accountRevenue,
          side: "MD",
          amount: subtotal,
          description: `Náklady - ${invoice.number}`,
        })
      }
      if (vatAmount > 0 && accountVAT) {
        lines.push({
          journal_entry_id: entry.id,
          account_id: accountVAT,
          side: "MD",
          amount: vatAmount,
          description: `DPH vstup - ${invoice.number}`,
        })
      }
      lines.push({
        journal_entry_id: entry.id,
        account_id: accountReceivable,
        side: "D",
        amount: total,
        description: `Záväzok - ${invoice.number}`,
      })
    }

    if (lines.length > 0) {
      await (db.from("journal_entry_lines") as any).insert(lines)
    }

    return { success: true, journalEntryId: entry.id }
  } catch (err: any) {
    return { success: false, error: err.message || "Neočakávaná chyba" }
  }
}

/**
 * Vytvorí účtovný zápis pri úhrade faktúry
 * Vydaná: MD 221 (Banka) / D 311 (Odberatelia)
 * Prijatá: MD 321 (Dodávatelia) / D 221 (Banka)
 */
export async function createPaymentJournalEntry(
  config: AutoPostingConfig,
  invoiceId: string,
  paymentAmount: number,
  paymentMethod: string = "prevod"
): Promise<PostingResult> {
  const { db, companyId, userId } = config

  try {
    const { data: invoice } = await (db.from("invoices") as any)
      .select("id, type, number, issue_date")
      .eq("id", invoiceId)
      .single()

    if (!invoice) return { success: false, error: "Faktúra nenájdená" }

    const isIssued = invoice.type === "vydana" || invoice.type === "proforma"
    const bankAccount = paymentMethod === "hotovost"
      ? await findAccount(db, companyId, "211")  // Pokladňa
      : await findAccount(db, companyId, "221")  // Bankový účet

    const partnerAccount = isIssued
      ? await findAccount(db, companyId, "311")   // Odberatelia
      : await findAccount(db, companyId, "321")   // Dodávatelia

    if (!bankAccount || !partnerAccount) {
      return { success: false, error: "Účty 221/311 alebo 321 nie sú v účtovom rozvrhu" }
    }

    const entryNumber = await generateEntryNumber(db, companyId, "BV")

    const { data: entry, error: entryError } = await (db.from("journal_entries") as any)
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_type: "BV",
        entry_date: new Date().toISOString().split("T")[0],
        description: `Úhrada faktúry ${invoice.number}`,
        total_debit: paymentAmount,
        total_credit: paymentAmount,
        status: "zauctovany",
        source_invoice_id: invoiceId,
        created_by: userId,
      })
      .select("id")
      .single()

    if (entryError || !entry) {
      return { success: false, error: entryError?.message || "Chyba pri vytváraní zápisu" }
    }

    const lines = isIssued
      ? [
          { journal_entry_id: entry.id, account_id: bankAccount, side: "MD", amount: paymentAmount, description: `Príjem - ${invoice.number}` },
          { journal_entry_id: entry.id, account_id: partnerAccount, side: "D", amount: paymentAmount, description: `Úhrada pohľadávky - ${invoice.number}` },
        ]
      : [
          { journal_entry_id: entry.id, account_id: partnerAccount, side: "MD", amount: paymentAmount, description: `Úhrada záväzku - ${invoice.number}` },
          { journal_entry_id: entry.id, account_id: bankAccount, side: "D", amount: paymentAmount, description: `Výdaj - ${invoice.number}` },
        ]

    await (db.from("journal_entry_lines") as any).insert(lines)

    return { success: true, journalEntryId: entry.id }
  } catch (err: any) {
    return { success: false, error: err.message || "Neočakávaná chyba" }
  }
}

/**
 * Vytvorí účtovný zápis pre bankový pohyb
 */
export async function createBankTransactionJournalEntry(
  config: AutoPostingConfig,
  transactionId: string
): Promise<PostingResult> {
  const { db, companyId, userId } = config

  try {
    const { data: tx } = await (db.from("bank_transactions") as any)
      .select("id, amount, description, matched_invoice_id, counterparty_name, transaction_date, bank_statement_id, bank_statements!inner(bank_account_id)")
      .eq("id", transactionId)
      .single()

    if (!tx) return { success: false, error: "Transakcia nenájdená" }

    // Ak je spárovaná s faktúrou, použijeme payment posting
    if (tx.matched_invoice_id) {
      return createPaymentJournalEntry(config, tx.matched_invoice_id, Math.abs(Number(tx.amount)))
    }

    // Nespárovaná transakcia - vytvoríme BV zápis s prechodným účtom
    const amount = Math.abs(Number(tx.amount))
    const isCredit = Number(tx.amount) > 0

    const bankAccount = await findAccount(db, companyId, "221")
    const transitAccount = await findAccount(db, companyId, "395") // Vnútorné zúčtovanie

    if (!bankAccount) {
      return { success: false, error: "Účet 221 nie je v účtovom rozvrhu" }
    }

    const entryNumber = await generateEntryNumber(db, companyId, "BV")

    const { data: entry, error: entryError } = await (db.from("journal_entries") as any)
      .insert({
        company_id: companyId,
        entry_number: entryNumber,
        entry_type: "BV",
        entry_date: tx.transaction_date,
        description: `Bankový pohyb: ${tx.description || tx.counterparty_name || ""}`.substring(0, 200),
        total_debit: amount,
        total_credit: amount,
        status: "draft", // Draft - vyžaduje manuálne doplnenie účtu
        created_by: userId,
      })
      .select("id")
      .single()

    if (entryError || !entry) {
      return { success: false, error: entryError?.message || "Chyba" }
    }

    const targetAccount = transitAccount || bankAccount
    const lines = isCredit
      ? [
          { journal_entry_id: entry.id, account_id: bankAccount, side: "MD", amount, description: tx.description },
          { journal_entry_id: entry.id, account_id: targetAccount, side: "D", amount, description: tx.description },
        ]
      : [
          { journal_entry_id: entry.id, account_id: targetAccount, side: "MD", amount, description: tx.description },
          { journal_entry_id: entry.id, account_id: bankAccount, side: "D", amount, description: tx.description },
        ]

    await (db.from("journal_entry_lines") as any).insert(lines)

    // Aktualizovať transakciu
    await (db.from("bank_transactions") as any)
      .update({ journal_entry_id: entry.id, status: "zauctovana" })
      .eq("id", transactionId)

    return { success: true, journalEntryId: entry.id }
  } catch (err: any) {
    return { success: false, error: err.message || "Neočakávaná chyba" }
  }
}
