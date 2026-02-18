import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateSV } from "@/lib/tax/sv-calculator"

// POST /api/tax-returns/sv/calculate - Vypocitat suhrnny vykaz
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

  // Fetch issued invoices for the period
  const { data: invoices, error: invoicesError } = await (db.from("invoices") as any)
    .select("id, type, subtotal, vat_amount, total, contact_id, reverse_charge_text, issue_date")
    .eq("company_id", company_id)
    .eq("type", "vydana")
    .gte("issue_date", period_from)
    .lte("issue_date", period_to)
    .is("deleted_at", null)

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  // Collect unique contact IDs
  const contactIds = Array.from(new Set(
    (invoices || [])
      .filter((inv: any) => inv.contact_id)
      .map((inv: any) => inv.contact_id)
  ))

  let contacts: any[] = []
  if (contactIds.length > 0) {
    const { data: contactsData, error: contactsError } = await (db.from("contacts") as any)
      .select("id, name, ico, dic, ic_dph, country")
      .in("id", contactIds)
      .is("deleted_at", null)

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 })
    }

    contacts = contactsData || []
  }

  // Calculate SV
  const svData = calculateSV(
    invoices || [],
    contacts,
    period_from,
    period_to
  )

  return NextResponse.json({
    data: svData,
    period: { period_from, period_to },
    invoice_count: (invoices || []).length,
    eu_contact_count: contacts.filter((c: any) => c.ic_dph).length,
  })
}
