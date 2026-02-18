import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateFinancialIndicators } from "@/lib/reports/financial-reports"

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  // Fetch invoice data to compute financial indicators
  const currentYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`

  const { data: invoices, error } = await (db.from("invoices") as any)
    .select("id, type, status, total_amount, paid_amount, issue_date, due_date, paid_at")
    .eq("company_id", companyId)
    .gte("issue_date", yearStart)
    .lte("issue_date", yearEnd)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate financial data from invoices
  let trzby = 0
  let naklady = 0
  let pohladavky = 0
  let zavazky = 0

  for (const inv of invoices || []) {
    const amount = Number(inv.total_amount || 0)
    const paid = Number(inv.paid_amount || 0)
    const outstanding = amount - paid

    if (inv.type === "vydana" || inv.type === "proforma") {
      trzby += amount
      if (outstanding > 0) {
        pohladavky += outstanding
      }
    } else if (inv.type === "prijata") {
      naklady += amount
      if (outstanding > 0) {
        zavazky += outstanding
      }
    }
  }

  const cistyZisk = trzby - naklady

  // Build approximate balance sheet data from invoices
  const data = {
    obezne_aktiva: pohladavky + cistyZisk * 0.3,
    zasoby: 0,
    kratkodobe_zavazky: zavazky,
    cudzie_zdroje: zavazky,
    celkove_aktiva: Math.max(trzby * 0.5, pohladavky + cistyZisk * 0.3),
    vlastne_imanie: Math.max(1, trzby * 0.5 - zavazky),
    cisty_zisk: cistyZisk,
    trzby,
    naklady,
    pohladavky,
    zavazky,
    naklady_na_predany_tovar: naklady * 0.7,
  }

  const indicators = calculateFinancialIndicators(data)

  return NextResponse.json({ indicators, year: currentYear })
}
