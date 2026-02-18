import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateOpeningBalances } from "@/lib/closing/operations"

// GET /api/closing/opening-balances - Ziskanie pociatocnych stavov pre fiskalny rok
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const fiscalYearId = searchParams.get("fiscal_year_id")
  const fiscalYearStart = searchParams.get("fiscal_year_start")
  const fiscalYearEnd = searchParams.get("fiscal_year_end")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!fiscalYearStart || !fiscalYearEnd) {
    return NextResponse.json({ error: "fiscal_year_start a fiscal_year_end su povinne" }, { status: 400 })
  }

  try {
    // Fetch all balance sheet accounts (classes 0-4) and their year-end balances
    const { data: accounts, error: accountsError } = await (db.from("chart_of_accounts") as any)
      .select("id, synteticky_ucet, analyticky_ucet, nazov, typ")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .or("synteticky_ucet.like.0%,synteticky_ucet.like.1%,synteticky_ucet.like.2%,synteticky_ucet.like.3%,synteticky_ucet.like.4%")
      .order("synteticky_ucet")

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const accountIds = accounts.map((a: any) => a.id)

    // Get posted journal entry lines for the fiscal year
    const { data: lines, error: linesError } = await (db.from("journal_entry_lines") as any)
      .select(`
        account_id,
        side,
        amount,
        journal_entry:journal_entries!inner(id, company_id, status, date)
      `)
      .eq("journal_entry.company_id", companyId)
      .eq("journal_entry.status", "posted")
      .gte("journal_entry.date", fiscalYearStart)
      .lte("journal_entry.date", fiscalYearEnd)
      .in("account_id", accountIds)

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }

    // Aggregate balances
    const balanceMap: Record<string, { totalMD: number; totalD: number }> = {}
    for (const line of (lines || [])) {
      if (!balanceMap[line.account_id]) {
        balanceMap[line.account_id] = { totalMD: 0, totalD: 0 }
      }
      const amount = Number(line.amount) || 0
      if (line.side === "MD") {
        balanceMap[line.account_id].totalMD += amount
      } else {
        balanceMap[line.account_id].totalD += amount
      }
    }

    const result = accounts
      .map((account: any) => {
        const bal = balanceMap[account.id] || { totalMD: 0, totalD: 0 }
        const netBalance = bal.totalMD - bal.totalD
        return {
          account_id: account.id,
          synteticky_ucet: account.synteticky_ucet,
          analyticky_ucet: account.analyticky_ucet,
          nazov: account.nazov,
          typ: account.typ,
          total_md: Math.round(bal.totalMD * 100) / 100,
          total_d: Math.round(bal.totalD * 100) / 100,
          net_balance: Math.round(netBalance * 100) / 100,
          opening_debit: netBalance > 0 ? Math.round(netBalance * 100) / 100 : 0,
          opening_credit: netBalance < 0 ? Math.round(Math.abs(netBalance) * 100) / 100 : 0,
        }
      })
      .filter((a: any) => Math.abs(a.net_balance) >= 0.01)

    const totalOpeningDebit = result.reduce((sum: number, a: any) => sum + a.opening_debit, 0)
    const totalOpeningCredit = result.reduce((sum: number, a: any) => sum + a.opening_credit, 0)

    return NextResponse.json({
      data: result,
      summary: {
        total_opening_debit: Math.round(totalOpeningDebit * 100) / 100,
        total_opening_credit: Math.round(totalOpeningCredit * 100) / 100,
        accounts_count: result.length,
        is_balanced: Math.abs(totalOpeningDebit - totalOpeningCredit) < 0.01,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa nacitat pociatocne stavy" }, { status: 500 })
  }
}

// POST /api/closing/opening-balances - Generovanie pociatocnych stavov z predchadzajuceho roka
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, fiscal_year_id, fiscal_year_start, fiscal_year_end } = body

  if (!company_id || !fiscal_year_id || !fiscal_year_start || !fiscal_year_end) {
    return NextResponse.json({
      error: "company_id, fiscal_year_id, fiscal_year_start a fiscal_year_end su povinne",
    }, { status: 400 })
  }

  try {
    // Check if opening balances were already generated
    const { data: existingOp } = await (db.from("closing_operations") as any)
      .select("id, journal_entry_id")
      .eq("company_id", company_id)
      .eq("fiscal_year_id", fiscal_year_id)
      .eq("type", "balance_close")
      .is("deleted_at", null)
      .limit(1)

    if (existingOp && existingOp.length > 0) {
      return NextResponse.json({
        error: "Pociatocne stavy uz boli generovane pre toto obdobie.",
        existing: existingOp[0],
      }, { status: 409 })
    }

    const result = await generateOpeningBalances(
      company_id,
      fiscal_year_id,
      fiscal_year_start,
      fiscal_year_end,
      user.id, db)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Record the operation
    await (db.from("closing_operations") as any)
      .insert({
        company_id,
        fiscal_year_id,
        type: "balance_close",
        journal_entry_id: result.journalEntryId || null,
        total_amount: result.totalAmount || 0,
        accounts_count: result.accountsCount || 0,
        created_by: user.id,
      })

    return NextResponse.json({
      success: true,
      journal_entry_id: result.journalEntryId,
      total_amount: result.totalAmount,
      accounts_count: result.accountsCount,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa generovat pociatocne stavy" }, { status: 500 })
  }
}
