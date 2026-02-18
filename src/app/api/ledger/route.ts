import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/ledger - Hlavná kniha (General Ledger)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const accountId = searchParams.get("account_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const costCenterId = searchParams.get("cost_center_id")
  const projectId = searchParams.get("project_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "date_from a date_to sú povinné" }, { status: 400 })
  }

  // Fetch all active accounts for this company
  let accountsQuery = (db.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov, typ, aktivny")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("synteticky_ucet")
    .order("analyticky_ucet")

  if (accountId) {
    accountsQuery = accountsQuery.eq("id", accountId)
  }

  const { data: accounts, error: accountsError } = await accountsQuery

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      data: [],
      summary: {
        total_pociatocny_zostatok_md: 0,
        total_pociatocny_zostatok_d: 0,
        total_obraty_md: 0,
        total_obraty_d: 0,
        total_konecny_zostatok_md: 0,
        total_konecny_zostatok_d: 0,
      },
    })
  }

  const accountIds = accounts.map((a: any) => a.id)

  // Fetch opening balances: sum of all posted journal entry lines before date_from
  let openingQuery = (db.from("journal_entry_lines") as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .lt("journal_entry.date", dateFrom)
    .in("account_id", accountIds)

  if (costCenterId) {
    openingQuery = openingQuery.eq("cost_center_id", costCenterId)
  }
  if (projectId) {
    openingQuery = openingQuery.eq("project_id", projectId)
  }

  const { data: openingLines, error: openingError } = await openingQuery

  if (openingError) {
    return NextResponse.json({ error: openingError.message }, { status: 500 })
  }

  // Fetch period movements: journal entry lines within date range
  let periodQuery = (db.from("journal_entry_lines") as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      journal_entry:journal_entries!inner(id, company_id, status, date)
    `)
    .eq("journal_entry.company_id", companyId)
    .eq("journal_entry.status", "posted")
    .gte("journal_entry.date", dateFrom)
    .lte("journal_entry.date", dateTo)
    .in("account_id", accountIds)

  if (costCenterId) {
    periodQuery = periodQuery.eq("cost_center_id", costCenterId)
  }
  if (projectId) {
    periodQuery = periodQuery.eq("project_id", projectId)
  }

  const { data: periodLines, error: periodError } = await periodQuery

  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 })
  }

  // Build opening balances map
  const openingMap: Record<string, { md: number; d: number }> = {}
  for (const line of (openingLines || [])) {
    if (!openingMap[line.account_id]) {
      openingMap[line.account_id] = { md: 0, d: 0 }
    }
    openingMap[line.account_id].md += Number(line.debit_amount) || 0
    openingMap[line.account_id].d += Number(line.credit_amount) || 0
  }

  // Build period movements map
  const periodMap: Record<string, { md: number; d: number }> = {}
  for (const line of (periodLines || [])) {
    if (!periodMap[line.account_id]) {
      periodMap[line.account_id] = { md: 0, d: 0 }
    }
    periodMap[line.account_id].md += Number(line.debit_amount) || 0
    periodMap[line.account_id].d += Number(line.credit_amount) || 0
  }

  // Combine accounts with their balances
  const ledgerData = accounts
    .map((account: any) => {
      const opening = openingMap[account.id] || { md: 0, d: 0 }
      const period = periodMap[account.id] || { md: 0, d: 0 }

      const pociatocny_zostatok = opening.md - opening.d
      const obraty_md = period.md
      const obraty_d = period.d
      const konecny_zostatok = pociatocny_zostatok + obraty_md - obraty_d

      return {
        id: account.id,
        synteticky_ucet: account.synteticky_ucet,
        analyticky_ucet: account.analyticky_ucet,
        nazov: account.nazov,
        typ: account.typ,
        aktivny: account.aktivny,
        pociatocny_zostatok,
        obraty_md,
        obraty_d,
        konecny_zostatok,
        has_movements: opening.md !== 0 || opening.d !== 0 || period.md !== 0 || period.d !== 0,
      }
    })
    .filter((a: any) => a.has_movements || accountId)

  // Calculate summary totals
  let total_pociatocny_zostatok_md = 0
  let total_pociatocny_zostatok_d = 0
  let total_obraty_md = 0
  let total_obraty_d = 0
  let total_konecny_zostatok_md = 0
  let total_konecny_zostatok_d = 0

  for (const item of ledgerData) {
    if (item.pociatocny_zostatok >= 0) {
      total_pociatocny_zostatok_md += item.pociatocny_zostatok
    } else {
      total_pociatocny_zostatok_d += Math.abs(item.pociatocny_zostatok)
    }
    total_obraty_md += item.obraty_md
    total_obraty_d += item.obraty_d
    if (item.konecny_zostatok >= 0) {
      total_konecny_zostatok_md += item.konecny_zostatok
    } else {
      total_konecny_zostatok_d += Math.abs(item.konecny_zostatok)
    }
  }

  return NextResponse.json({
    data: ledgerData,
    summary: {
      total_pociatocny_zostatok_md,
      total_pociatocny_zostatok_d,
      total_obraty_md,
      total_obraty_d,
      total_konecny_zostatok_md,
      total_konecny_zostatok_d,
    },
  })
}
