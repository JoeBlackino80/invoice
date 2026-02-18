import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseCSV, BANK_MAPPINGS } from "@/lib/bank/csv-parser"
import type { BankPreset, ColumnMapping } from "@/lib/bank/csv-parser"
import { runAutoMatching } from "@/lib/bank/auto-match"

// POST /api/bank-statements/import - import bankoveho vypisu z CSV
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Neplatny format requestu. Pouzite multipart/form-data." }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const bankAccountId = formData.get("bank_account_id") as string | null
  const companyId = formData.get("company_id") as string | null
  const bankPreset = formData.get("bank_preset") as string | null
  const statementNumber = formData.get("statement_number") as string | null
  const statementDate = formData.get("statement_date") as string | null

  if (!file) {
    return NextResponse.json({ error: "Subor je povinny" }, { status: 400 })
  }

  if (!bankAccountId) {
    return NextResponse.json({ error: "bank_account_id je povinny" }, { status: 400 })
  }

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Verify bank account exists
  const { data: account, error: accError } = await (db.from("bank_accounts") as any)
    .select("id, name, currency")
    .eq("id", bankAccountId)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (accError || !account) {
    return NextResponse.json({ error: "Bankovy ucet nenajdeny" }, { status: 404 })
  }

  // Read file content
  let csvText: string
  try {
    csvText = await file.text()
  } catch {
    return NextResponse.json({ error: "Nepodarilo sa precitat subor" }, { status: 400 })
  }

  // Determine column mapping
  let mapping: ColumnMapping | undefined
  if (bankPreset && bankPreset in BANK_MAPPINGS) {
    mapping = BANK_MAPPINGS[bankPreset as BankPreset]
  }

  // Parse CSV
  const parseResult = parseCSV(csvText, mapping)

  if (parseResult.transactions.length === 0) {
    return NextResponse.json({
      error: "Nepodarilo sa importovat ziadne transakcie",
      details: parseResult.errors,
    }, { status: 400 })
  }

  // Calculate opening and closing balance from transactions
  const sortedTransactions = [...parseResult.transactions].sort(
    (a, b) => a.date.localeCompare(b.date)
  )

  const firstDate = sortedTransactions[0].date
  const lastDate = sortedTransactions[sortedTransactions.length - 1].date
  const totalAmount = sortedTransactions.reduce((sum, tx) => sum + tx.amount, 0)

  // Get current balance for the account to compute opening balance of this statement
  const { data: existingTx } = await (db.from("bank_transactions") as any)
    .select("amount")
    .eq("bank_account_id", bankAccountId)
    .is("deleted_at", null)

  let currentBalance = account.opening_balance || 0
  if (existingTx) {
    for (const tx of existingTx) {
      currentBalance += tx.amount
    }
  }

  const openingBalance = currentBalance
  const closingBalance = currentBalance + totalAmount

  // Create bank statement record
  const { data: statement, error: stmtError } = await (db.from("bank_statements") as any)
    .insert({
      bank_account_id: bankAccountId,
      company_id: companyId,
      statement_number: statementNumber || null,
      date: statementDate || lastDate,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (stmtError) {
    return NextResponse.json({ error: "Nepodarilo sa vytvorit vypis: " + stmtError.message }, { status: 500 })
  }

  // Create bank transaction records
  const transactionsToInsert = sortedTransactions.map((tx) => ({
    bank_account_id: bankAccountId,
    bank_statement_id: statement.id,
    company_id: companyId,
    date: tx.date,
    amount: tx.amount,
    type: tx.type,
    counterparty_name: tx.counterparty_name || null,
    counterparty_iban: tx.counterparty_iban || null,
    variable_symbol: tx.variable_symbol || null,
    constant_symbol: tx.constant_symbol || null,
    specific_symbol: tx.specific_symbol || null,
    description: tx.description || null,
    reference: tx.reference || null,
    status: "neparovana",
    created_by: user.id,
    updated_by: user.id,
  }))

  // Insert in batches of 100 to avoid payload limits
  let insertedCount = 0
  const insertErrors: { row: number; message: string }[] = []
  const batchSize = 100

  for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
    const batch = transactionsToInsert.slice(i, i + batchSize)
    const { data: inserted, error: insertError } = await (db.from("bank_transactions") as any)
      .insert(batch)
      .select("id")

    if (insertError) {
      insertErrors.push({
        row: i + 1,
        message: insertError.message,
      })
    } else {
      insertedCount += (inserted || []).length
    }
  }

  // Auto-matching after successful import
  let matchResult = { matched: 0, unmatched: 0 }
  try {
    matchResult = await runAutoMatching(db, companyId, user.id, bankAccountId)
  } catch (e) {
    console.warn("Auto-matching error:", e)
  }

  return NextResponse.json({
    statement_id: statement.id,
    imported_count: insertedCount,
    total_rows: parseResult.totalRows,
    parse_errors: parseResult.errors,
    insert_errors: insertErrors,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    auto_matched: matchResult.matched,
    unmatched: matchResult.unmatched,
  }, { status: 201 })
}
