import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { recurringInvoiceSchema } from "@/lib/validations/recurring-invoice"

// GET /api/recurring-invoices/:id
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await (db
    .from("recurring_invoices") as any)
    .select(`
      *,
      contact:contacts(id, name, ico, dic, ic_dph, street, city, zip)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Opakovaná faktúra nenájdená" }, { status: 404 })
  }

  // Parse items from JSON string if stored as string
  if (data && typeof data.items === "string") {
    try {
      data.items = JSON.parse(data.items)
    } catch {
      data.items = []
    }
  }

  return NextResponse.json(data)
}

// PUT /api/recurring-invoices/:id
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if recurring invoice exists
  const { data: existing, error: fetchError } = await (db
    .from("recurring_invoices") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Opakovaná faktúra nenájdená" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = recurringInvoiceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: updated, error: updateError } = await (db
    .from("recurring_invoices") as any)
    .update({
      type: parsed.data.type,
      contact_id: parsed.data.contact_id || null,
      interval: parsed.data.interval,
      next_generation_date: parsed.data.next_generation_date,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      variable_symbol: parsed.data.variable_symbol || null,
      reverse_charge: parsed.data.reverse_charge,
      notes: parsed.data.notes || null,
      is_active: parsed.data.is_active,
      items: JSON.stringify(parsed.data.items),
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/recurring-invoices/:id (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if recurring invoice exists
  const { data: existing, error: fetchError } = await (db
    .from("recurring_invoices") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Opakovaná faktúra nenájdená" }, { status: 404 })
  }

  const { error } = await (db
    .from("recurring_invoices") as any)
    .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
