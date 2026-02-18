import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Pomocná funkcia na overenie portál tokenu
async function verifyPortalToken(db: any, token: string) {
  const { data, error } = await (db
    .from("portal_tokens") as any)
    .select("id, contact_id, company_id, expires_at")
    .eq("token", token)
    .single() as { data: any; error: any }

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null

  return data
}

// GET /api/portal/invoices/:id - Detail faktúry pre portál kontakt
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const db = createAdminClient()

  const portalToken = request.headers.get("x-portal-token")
  if (!portalToken) {
    return NextResponse.json({ error: "Chýba prístupový token" }, { status: 401 })
  }

  const session = await verifyPortalToken(db, portalToken)
  if (!session) {
    return NextResponse.json({ error: "Neplatný alebo expirovaný token" }, { status: 401 })
  }

  // Načítať faktúru s položkami
  const { data: invoice, error } = await (db
    .from("invoices") as any)
    .select(`
      id,
      number,
      type,
      issue_date,
      delivery_date,
      due_date,
      total_amount,
      total_with_vat,
      currency,
      status,
      variable_symbol,
      constant_symbol,
      specific_symbol,
      notes,
      customer_name,
      customer_ico,
      customer_dic,
      customer_ic_dph,
      customer_address,
      supplier_name,
      supplier_ico,
      supplier_dic,
      supplier_ic_dph,
      supplier_address,
      supplier_iban,
      supplier_bank_name,
      invoice_items (
        id,
        description,
        quantity,
        unit,
        unit_price,
        vat_rate,
        total_without_vat,
        vat_amount,
        total_with_vat
      ),
      invoice_payments (
        id,
        amount,
        currency,
        method,
        status,
        transaction_id,
        paid_at,
        created_at
      )
    `)
    .eq("id", params.id)
    .eq("company_id", session.company_id)
    .eq("contact_id", session.contact_id)
    .is("deleted_at", null)
    .neq("status", "draft")
    .single() as { data: any; error: any }

  if (error || !invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  return NextResponse.json(invoice)
}
