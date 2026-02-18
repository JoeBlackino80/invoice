import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  if (!companyId) return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })

  const db = createAdminClient()

  const { data: invoices, error } = await (db.from("invoices") as any)
    .select("id, number, type, status, issue_date, due_date, subtotal, vat_amount, total, paid_amount")
    .eq("company_id", companyId)
    .eq("contact_id", params.id)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary
  let totalAmount = 0, totalPaid = 0, totalUnpaid = 0
  for (const inv of (invoices || [])) {
    totalAmount += Number(inv.total) || 0
    totalPaid += Number(inv.paid_amount) || 0
    if (inv.status !== "uhradena" && inv.status !== "stornovana") {
      totalUnpaid += (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)
    }
  }

  return NextResponse.json({
    data: invoices || [],
    summary: {
      count: (invoices || []).length,
      total: Math.round(totalAmount * 100) / 100,
      paid: Math.round(totalPaid * 100) / 100,
      unpaid: Math.round(totalUnpaid * 100) / 100,
    }
  })
}
