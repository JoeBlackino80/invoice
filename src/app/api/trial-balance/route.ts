import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/trial-balance - Obratová predvaha (Trial Balance)
export async function GET(request: Request) {
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

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "date_from a date_to sú povinné" }, { status: 400 })
  }

  // Fetch all accounts for this company
  const { data: accounts, error: accountsError } = await (db.from("chart_of_accounts") as any)
    .select("id, synteticky_ucet, analyticky_ucet, nazov, typ, aktivny")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("synteticky_ucet")
    .order("analyticky_ucet")

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      data: [],
      summary: {
        pociatocny_zostatok_md: 0,
        pociatocny_zostatok_d: 0,
        obraty_md: 0,
        obraty_d: 0,
        konecny_zostatok_md: 0,
        konecny_zostatok_d: 0,
      },
      is_balanced: true,
    })
  }

  const accountIds = accounts.map((a: any) => a.id)

  // Fetch opening balances: lines before date_from
  const { data: openingLines, error: openingError } = await (db.from("journal_entry_lines") as any)
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

  if (openingError) {
    return NextResponse.json({ error: openingError.message }, { status: 500 })
  }

  // Fetch period movements
  const { data: periodLines, error: periodError } = await (db.from("journal_entry_lines") as any)
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

  // Summary totals
  let summary_pociatocny_md = 0
  let summary_pociatocny_d = 0
  let summary_obraty_md = 0
  let summary_obraty_d = 0
  let summary_konecny_md = 0
  let summary_konecny_d = 0

  // Build trial balance rows
  const trialBalanceData = accounts
    .map((account: any) => {
      const opening = openingMap[account.id] || { md: 0, d: 0 }
      const period = periodMap[account.id] || { md: 0, d: 0 }

      const pociatocny_zostatok_md = opening.md
      const pociatocny_zostatok_d = opening.d
      const obraty_md = period.md
      const obraty_d = period.d
      const konecny_zostatok_md = pociatocny_zostatok_md + obraty_md
      const konecny_zostatok_d = pociatocny_zostatok_d + obraty_d

      const hasActivity = pociatocny_zostatok_md !== 0 || pociatocny_zostatok_d !== 0 ||
        obraty_md !== 0 || obraty_d !== 0

      return {
        id: account.id,
        synteticky_ucet: account.synteticky_ucet,
        analyticky_ucet: account.analyticky_ucet,
        nazov: account.nazov,
        typ: account.typ,
        pociatocny_zostatok_md,
        pociatocny_zostatok_d,
        obraty_md,
        obraty_d,
        konecny_zostatok_md,
        konecny_zostatok_d,
        has_activity: hasActivity,
      }
    })
    .filter((a: any) => a.has_activity)

  // Calculate summary
  for (const row of trialBalanceData) {
    summary_pociatocny_md += row.pociatocny_zostatok_md
    summary_pociatocny_d += row.pociatocny_zostatok_d
    summary_obraty_md += row.obraty_md
    summary_obraty_d += row.obraty_d
    summary_konecny_md += row.konecny_zostatok_md
    summary_konecny_d += row.konecny_zostatok_d
  }

  // Check if balanced (MD sums == D sums within rounding tolerance)
  const tolerance = 0.01
  const is_balanced =
    Math.abs(summary_obraty_md - summary_obraty_d) < tolerance &&
    Math.abs(summary_konecny_md - summary_konecny_d) < tolerance

  return NextResponse.json({
    data: trialBalanceData,
    summary: {
      pociatocny_zostatok_md: summary_pociatocny_md,
      pociatocny_zostatok_d: summary_pociatocny_d,
      obraty_md: summary_obraty_md,
      obraty_d: summary_obraty_d,
      konecny_zostatok_md: summary_konecny_md,
      konecny_zostatok_d: summary_konecny_d,
    },
    is_balanced,
  })
}
