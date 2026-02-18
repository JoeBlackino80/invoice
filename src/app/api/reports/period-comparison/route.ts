import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { comparePeriods } from "@/lib/reports/financial-reports"

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
  const period1From = searchParams.get("period1_from")
  const period1To = searchParams.get("period1_to")
  const period2From = searchParams.get("period2_from")
  const period2To = searchParams.get("period2_to")

  if (!companyId || !period1From || !period1To || !period2From || !period2To) {
    return NextResponse.json(
      {
        error:
          "company_id, period1_from, period1_to, period2_from, period2_to su povinne",
      },
      { status: 400 }
    )
  }

  // Fetch invoices for period 1
  const { data: p1Invoices, error: e1 } = await (
    db.from("invoices") as any
  )
    .select("id, type, total_amount, issue_date")
    .eq("company_id", companyId)
    .gte("issue_date", period1From)
    .lte("issue_date", period1To)
    .is("deleted_at", null)

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 })
  }

  // Fetch invoices for period 2
  const { data: p2Invoices, error: e2 } = await (
    db.from("invoices") as any
  )
    .select("id, type, total_amount, issue_date")
    .eq("company_id", companyId)
    .gte("issue_date", period2From)
    .lte("issue_date", period2To)
    .is("deleted_at", null)

  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  function calcPeriodData(invoices: any[]) {
    let revenue = 0
    let expenses = 0
    let invoiceCount = 0

    for (const inv of invoices || []) {
      const amount = Number(inv.total_amount || 0)
      if (inv.type === "vydana" || inv.type === "proforma") {
        revenue += amount
        invoiceCount += 1
      } else if (inv.type === "prijata") {
        expenses += amount
      }
    }

    return {
      revenue,
      expenses,
      profit: revenue - expenses,
      invoice_count: invoiceCount,
      average_invoice: invoiceCount > 0 ? revenue / invoiceCount : 0,
    }
  }

  const period1Data = calcPeriodData(p1Invoices)
  const period2Data = calcPeriodData(p2Invoices)

  const comparison = comparePeriods(
    period1Data,
    period2Data,
    { from: period1From, to: period1To },
    { from: period2From, to: period2To }
  )

  return NextResponse.json(comparison)
}
