import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/bank-transactions/:id/post - zauctovanie sparovanej transakcie
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch the bank transaction
  const { data: transaction, error: txError } = await (db
    .from("bank_transactions") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (txError || !transaction) {
    return NextResponse.json({ error: "Bankova transakcia nebola najdena" }, { status: 404 })
  }

  if (transaction.status !== "parovana") {
    return NextResponse.json({
      error: "Zauctovat mozno iba transakcie v stave 'parovana'. Aktualny stav: " + transaction.status
    }, { status: 400 })
  }

  const absAmount = Math.abs(transaction.amount)
  const isCredit = transaction.amount > 0

  // Resolve accounting accounts
  // For bank account, look up the bank_accounts table for the synteticky ucet (default 221)
  let bankAccountNumber = "221"
  const { data: bankAccount } = await (db
    .from("bank_accounts") as any)
    .select("account_number")
    .eq("id", transaction.bank_account_id)
    .single() as { data: any; error: any }

  if (bankAccount?.account_number) {
    bankAccountNumber = bankAccount.account_number
  }

  // Find the chart_of_accounts entries for the accounts we need
  // Bank account (221 or custom)
  const { data: bankChartAccount } = await (db
    .from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", transaction.company_id)
    .eq("synteticky_ucet", bankAccountNumber)
    .is("deleted_at", null)
    .limit(1)
    .single() as { data: any; error: any }

  // Counter account depends on transaction type
  // Credit (vydana faktura - income): 221 MD / 311 D
  // Debit (prijata faktura - expense): 321 MD / 221 D
  const counterAccountNumber = isCredit ? "311" : "321"

  const { data: counterChartAccount } = await (db
    .from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", transaction.company_id)
    .eq("synteticky_ucet", counterAccountNumber)
    .is("deleted_at", null)
    .limit(1)
    .single() as { data: any; error: any }

  if (!bankChartAccount || !counterChartAccount) {
    return NextResponse.json({
      error: `Uctovny ucet ${!bankChartAccount ? bankAccountNumber : counterAccountNumber} nebol najdeny v uctovom rozvrhu. Pridajte ho najprv.`
    }, { status: 400 })
  }

  // Generate journal entry number
  const { data: documentNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: transaction.company_id,
      p_type: "uctovny_zapis_BV",
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Build description
  const description = transaction.description
    || `Bankova transakcia - ${transaction.counterparty_name || "neznamy"}`

  // Create journal_entry header
  const { data: entry, error: entryError } = await (db
    .from("journal_entries") as any)
    .insert({
      company_id: transaction.company_id,
      number: documentNumber,
      document_type: "BV",
      date: transaction.date,
      description,
      source_document_id: null,
      source_invoice_id: transaction.matched_invoice_id || null,
      status: "draft",
      total_md: absAmount,
      total_d: absAmount,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 })
  }

  // Create journal_entry_lines
  // Credit (income, vydana faktura): 221 MD / 311 D
  // Debit (expense, prijata faktura): 321 MD / 221 D
  const lines = isCredit
    ? [
        {
          company_id: transaction.company_id,
          journal_entry_id: entry.id,
          position: 0,
          account_id: bankChartAccount.id,
          side: "MD",
          amount: absAmount,
          description: `Prijem na bankovy ucet - ${transaction.counterparty_name || ""}`,
        },
        {
          company_id: transaction.company_id,
          journal_entry_id: entry.id,
          position: 1,
          account_id: counterChartAccount.id,
          side: "D",
          amount: absAmount,
          description: `Uhrada faktury - ${transaction.counterparty_name || ""}`,
        },
      ]
    : [
        {
          company_id: transaction.company_id,
          journal_entry_id: entry.id,
          position: 0,
          account_id: counterChartAccount.id,
          side: "MD",
          amount: absAmount,
          description: `Uhrada zavazku - ${transaction.counterparty_name || ""}`,
        },
        {
          company_id: transaction.company_id,
          journal_entry_id: entry.id,
          position: 1,
          account_id: bankChartAccount.id,
          side: "D",
          amount: absAmount,
          description: `Vydaj z bankoveho uctu - ${transaction.counterparty_name || ""}`,
        },
      ]

  const { error: linesError } = await (db
    .from("journal_entry_lines") as any)
    .insert(lines)

  if (linesError) {
    // Rollback: delete the journal entry
    await (db.from("journal_entries") as any).delete().eq("id", entry.id)
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  // Post the journal entry immediately
  const { error: postError } = await (db
    .from("journal_entries") as any)
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: user.id,
      updated_by: user.id,
    })
    .eq("id", entry.id)

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  // Update the bank transaction: status="zauctovana", journal_entry_id
  const { data: updatedTx, error: updateTxError } = await (db
    .from("bank_transactions") as any)
    .update({
      status: "zauctovana",
      journal_entry_id: entry.id,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateTxError) {
    return NextResponse.json({ error: updateTxError.message }, { status: 500 })
  }

  // Fetch complete entry with lines for response
  const { data: completeEntry } = await (db
    .from("journal_entries") as any)
    .select(`
      *,
      lines:journal_entry_lines(
        id, account_id, side, amount, description,
        account:chart_of_accounts(id, synteticky_ucet, analyticky_ucet, nazov)
      )
    `)
    .eq("id", entry.id)
    .single() as { data: any; error: any }

  return NextResponse.json({
    transaction: updatedTx,
    journal_entry: completeEntry || entry,
  })
}
