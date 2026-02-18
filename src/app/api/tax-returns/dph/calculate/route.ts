import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDPH } from "@/lib/tax/dph-calculator"

// POST /api/tax-returns/dph/calculate - vypocet DPH za obdobie
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, period_from, period_to } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!period_from || !period_to) {
    return NextResponse.json({ error: "period_from a period_to su povinne" }, { status: 400 })
  }

  // Fetch all invoices in the period with items
  const { data: invoices, error: invoicesError } = await (db
    .from("invoices") as any)
    .select(`
      id,
      type,
      number,
      issue_date,
      subtotal,
      vat_amount,
      total,
      status,
      contact_id,
      invoice_items (
        id,
        description,
        quantity,
        unit_price,
        vat_rate,
        subtotal,
        vat_amount,
        total
      )
    `)
    .eq("company_id", company_id)
    .is("deleted_at", null)
    .gte("issue_date", period_from)
    .lte("issue_date", period_to)
    .in("type", ["vydana", "prijata", "dobropis", "zalohova", "proforma"])
    .neq("status", "stornovana")

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  // Calculate DPH
  const dphData = calculateDPH(invoices || [], period_from, period_to)

  return NextResponse.json(dphData)
}
