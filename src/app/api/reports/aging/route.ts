import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateAgingReport } from "@/lib/reports/financial-reports"

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
  const type = (searchParams.get("type") || "receivables") as
    | "receivables"
    | "payables"
  const asOfDate =
    searchParams.get("as_of_date") || new Date().toISOString().slice(0, 10)

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  // receivables = vydane faktury (issued), payables = prijate faktury (received)
  const invoiceType = type === "receivables" ? "vydana" : "prijata"

  const { data: invoices, error } = await (db.from("invoices") as any)
    .select(
      `
      id,
      number,
      type,
      status,
      issue_date,
      due_date,
      total_amount,
      paid_amount,
      customer_name,
      supplier_name,
      contact_id,
      contact:contacts(id, name)
    `
    )
    .eq("company_id", companyId)
    .eq("type", invoiceType)
    .in("status", ["sent", "overdue", "partially_paid"])
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const report = calculateAgingReport(invoices || [], asOfDate, type)

  return NextResponse.json(report)
}
