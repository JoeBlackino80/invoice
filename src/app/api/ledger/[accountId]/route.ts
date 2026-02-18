import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/ledger/[accountId] - Detail účtu s pohybmi
export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const { accountId } = params

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "date_from a date_to sú povinné" }, { status: 400 })
  }

  // Fetch account info
  const { data: account, error: accountError } = await (db.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov, typ, aktivny")
    .eq("id", accountId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (accountError || !account) {
    return NextResponse.json({ error: "Účet nebol nájdený" }, { status: 404 })
  }

  // Fetch opening balance: sum of all posted lines before date_from
  const { data: openingLines, error: openingError } = await (db.from("journal_entry_lines") as any)
    .select(`
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("account_id", accountId)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .lt("journal_entry.date", dateFrom)

  if (openingError) {
    return NextResponse.json({ error: openingError.message }, { status: 500 })
  }

  let openingBalance = 0
  for (const line of (openingLines || [])) {
    openingBalance += (Number(line.debit_amount) || 0) - (Number(line.credit_amount) || 0)
  }

  // Fetch all movements in the period
  const { data: movements, error: movementsError } = await (db.from("journal_entry_lines") as any)
    .select(`
      id,
      debit_amount,
      credit_amount,
      description,
      journal_entry:journal_entries!inner(
        id,
        company_id,
        status,
        date,
        number,
        description
      )
    `)
    .eq("account_id", accountId)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", dateFrom)
    .lte("journal_entry.date", dateTo)
    .order("journal_entry(date)", { ascending: true })

  if (movementsError) {
    return NextResponse.json({ error: movementsError.message }, { status: 500 })
  }

  // Sort movements by date and build running balance
  const sortedMovements = (movements || []).sort((a: any, b: any) => {
    const dateA = a.journal_entry?.date || ""
    const dateB = b.journal_entry?.date || ""
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1
    return 0
  })

  let runningBalance = openingBalance
  let totalMd = 0
  let totalD = 0

  const lines = sortedMovements.map((line: any) => {
    const md = Number(line.debit_amount) || 0
    const d = Number(line.credit_amount) || 0
    runningBalance += md - d
    totalMd += md
    totalD += d

    return {
      id: line.id,
      date: line.journal_entry?.date,
      document_number: line.journal_entry?.number || "",
      description: line.description || line.journal_entry?.description || "",
      journal_entry_id: line.journal_entry?.id,
      md_amount: md,
      d_amount: d,
      running_balance: runningBalance,
    }
  })

  const closingBalance = openingBalance + totalMd - totalD

  return NextResponse.json({
    account: {
      id: account.id,
      synteticky_ucet: account.synteticky_ucet,
      analyticky_ucet: account.analyticky_ucet,
      nazov: account.nazov,
      typ: account.typ,
      aktivny: account.aktivny,
    },
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    total_md: totalMd,
    total_d: totalD,
    lines,
  })
}
