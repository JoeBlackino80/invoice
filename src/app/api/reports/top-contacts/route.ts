import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTopCustomers, getTopSuppliers } from "@/lib/reports/financial-reports"

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
  const type = searchParams.get("type") || "customers"
  const limit = parseInt(searchParams.get("limit") || "10")
  const year =
    searchParams.get("year") || String(new Date().getFullYear())

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  const invoiceType = type === "customers" ? "vydana" : "prijata"
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { data: invoices, error } = await (db.from("invoices") as any)
    .select(
      `
      id,
      type,
      status,
      total_amount,
      paid_amount,
      issue_date,
      due_date,
      paid_at,
      customer_name,
      supplier_name,
      contact_id,
      contact:contacts(id, name)
    `
    )
    .eq("company_id", companyId)
    .eq("type", invoiceType)
    .gte("issue_date", yearStart)
    .lte("issue_date", yearEnd)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const contacts =
    type === "customers"
      ? getTopCustomers(invoices || [], limit)
      : getTopSuppliers(invoices || [], limit)

  const totalAmount = (invoices || []).reduce(
    (s: number, inv: any) => s + Number(inv.total_amount || 0),
    0
  )

  const uniqueContacts = new Set(
    (invoices || []).map((inv: any) => inv.contact_id || inv.customer_name || inv.supplier_name)
  )

  return NextResponse.json({
    contacts,
    summary: {
      total_amount: Math.round(totalAmount * 100) / 100,
      active_count: uniqueContacts.size,
      year: parseInt(year),
    },
  })
}
