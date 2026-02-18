import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { findMatchesForAll } from "@/lib/bank/matching-engine"
import type { BankTransaction, Invoice, Contact, ContactBankAccount } from "@/lib/bank/matching-engine"

// POST /api/bank-transactions/match - spustenie parovania transakcii
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, bank_account_id, auto_pair } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Fetch all unmatched transactions
  let txQuery = (db.from("bank_transactions") as any)
    .select("*")
    .eq("company_id", company_id)
    .eq("status", "neparovana")
    .is("deleted_at", null)
    .order("date", { ascending: false })

  if (bank_account_id) {
    txQuery = txQuery.eq("bank_account_id", bank_account_id)
  }

  const { data: transactions, error: txError } = await txQuery

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  if (!transactions || transactions.length === 0) {
    return NextResponse.json({
      matched: 0,
      unmatched: 0,
      results: [],
    })
  }

  // Fetch all unpaid invoices for the company
  const { data: invoices, error: invError } = await (db.from("invoices") as any)
    .select("id, company_id, number, type, variable_symbol, total, paid_amount, status, contact_id")
    .eq("company_id", company_id)
    .is("deleted_at", null)
    .not("status", "in", "(uhradena,stornovana)")

  if (invError) {
    return NextResponse.json({ error: invError.message }, { status: 500 })
  }

  // Fetch contacts
  const { data: contacts, error: contactError } = await (db.from("contacts") as any)
    .select("id, name, ico")
    .eq("company_id", company_id)
    .is("deleted_at", null)

  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 })
  }

  // Fetch contact bank accounts
  const { data: contactBankAccounts, error: cbaError } = await (db.from("contact_bank_accounts") as any)
    .select("contact_id, iban")

  if (cbaError) {
    return NextResponse.json({ error: cbaError.message }, { status: 500 })
  }

  // Run matching engine
  const results = findMatchesForAll(
    transactions as BankTransaction[],
    (invoices || []) as Invoice[],
    (contacts || []) as Contact[],
    (contactBankAccounts || []) as ContactBankAccount[]
  )

  let matchedCount = 0
  let unmatchedCount = 0

  // If auto_pair is enabled, automatically pair high-confidence matches
  if (auto_pair) {
    // Track which invoices have been auto-paired already to prevent double-pairing
    const pairedInvoiceIds = new Set<string>()

    for (const result of results) {
      if (result.auto_match && result.best_match && !pairedInvoiceIds.has(result.best_match.invoice_id)) {
        const invoiceId = result.best_match.invoice_id
        const transaction = transactions.find((tx: any) => tx.id === result.transaction_id)
        if (!transaction) continue

        const absAmount = Math.abs(transaction.amount)

        // Update bank_transaction: status="parovana", matched_invoice_id
        const { error: updateTxError } = await (db.from("bank_transactions") as any)
          .update({
            status: "parovana",
            matched_invoice_id: invoiceId,
            updated_by: user.id,
          })
          .eq("id", result.transaction_id)

        if (updateTxError) continue

        // Fetch current invoice to get latest paid_amount
        const { data: currentInvoice, error: fetchInvError } = await (db.from("invoices") as any)
          .select("total, paid_amount")
          .eq("id", invoiceId)
          .single() as { data: any; error: any }

        if (fetchInvError || !currentInvoice) continue

        const newPaidAmount = (currentInvoice.paid_amount || 0) + absAmount
        const isFullyPaid = newPaidAmount >= currentInvoice.total

        // Update invoice: paid_amount, status
        const { error: updateInvError } = await (db.from("invoices") as any)
          .update({
            paid_amount: newPaidAmount,
            status: isFullyPaid ? "uhradena" : "ciastocne_uhradena",
            updated_by: user.id,
          })
          .eq("id", invoiceId)

        if (updateInvError) continue

        // Create invoice_payment record
        await (db.from("invoice_payments") as any)
          .insert({
            invoice_id: invoiceId,
            company_id,
            amount: absAmount,
            payment_date: transaction.date,
            payment_method: "bankovy_prevod",
            bank_transaction_id: result.transaction_id,
            created_by: user.id,
          })

        pairedInvoiceIds.add(invoiceId)
        matchedCount++
      } else {
        unmatchedCount++
      }
    }
  } else {
    matchedCount = results.filter((r) => r.auto_match).length
    unmatchedCount = results.filter((r) => !r.auto_match).length
  }

  return NextResponse.json({
    matched: matchedCount,
    unmatched: unmatchedCount,
    results,
  })
}
