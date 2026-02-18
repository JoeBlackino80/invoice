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

  const { data: invoices } = await (db.from("invoices") as any)
    .select("id, number, type, issue_date, due_date, total, paid_amount, status")
    .eq("company_id", companyId)
    .eq("contact_id", params.id)
    .is("deleted_at", null)
    .neq("status", "stornovana")
    .order("issue_date", { ascending: true })

  const saldoItems = (invoices || []).map((inv: any) => ({
    invoice_id: inv.id,
    number: inv.number,
    type: inv.type,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    total: Number(inv.total) || 0,
    paid: Number(inv.paid_amount) || 0,
    outstanding: Math.max(0, (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)),
    status: inv.status,
  }))

  const grandTotal = saldoItems.reduce((s: number, i: any) => s + i.outstanding, 0)

  return NextResponse.json({
    items: saldoItems,
    grand_total: Math.round(grandTotal * 100) / 100,
  })
}
