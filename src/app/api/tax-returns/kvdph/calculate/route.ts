import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateKVDPH } from "@/lib/tax/kvdph-calculator"

// POST /api/tax-returns/kvdph/calculate - vypocet KV DPH za obdobie
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
      reverse_charge,
      parent_invoice_id,
      invoice_items (
        id,
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
    .in("type", ["vydana", "prijata", "dobropis"])
    .neq("status", "stornovana")

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  // Fetch all contacts for the company
  const { data: contacts, error: contactsError } = await (db
    .from("contacts") as any)
    .select("id, name, ico, dic, ic_dph")
    .eq("company_id", company_id)
    .is("deleted_at", null)

  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 500 })
  }

  // Calculate KV DPH
  const kvdphData = calculateKVDPH(
    invoices || [],
    contacts || [],
    period_from,
    period_to
  )

  // Return with section counts for summary
  return NextResponse.json({
    ...kvdphData,
    counts: {
      a1: kvdphData.a1.length,
      a2: kvdphData.a2.length,
      b1: kvdphData.b1.length,
      b2: kvdphData.b2.length,
      b3: kvdphData.b3.length,
      c1: kvdphData.c1.length,
      c2: kvdphData.c2.length,
      d1: kvdphData.d1.length,
      d2: kvdphData.d2.length,
    },
  })
}
