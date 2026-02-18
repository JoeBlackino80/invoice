import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { invoiceSchema } from "@/lib/validations/invoice"

// GET /api/invoices/:id
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

  const { data, error } = await db
    .from("invoices")
    .select(`
      *,
      invoice_items (*),
      invoice_payments (*),
      contact:contacts (
        id,
        name,
        ico,
        ic_dph,
        street,
        city,
        zip
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/invoices/:id
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

  // Check if invoice exists and is in draft status
  const { data: existingInvoice, error: fetchError } = await db
    .from("invoices")
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  if (existingInvoice.status !== "draft") {
    return NextResponse.json({
      error: "Možno upravovať iba faktúry v stave 'draft'"
    }, { status: 400 })
  }

  const body = await request.json()
  const parsed = invoiceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Extract items from parsed data
  const { items, ...invoiceHeaderData } = parsed.data

  // Update invoice header
  const { data: updatedInvoice, error: updateError } = await (db
    .from("invoices") as any)
    .update({
      ...invoiceHeaderData,
      contact_id: parsed.data.contact_id || null,
      parent_invoice_id: parsed.data.parent_invoice_id || null,
      variable_symbol: parsed.data.variable_symbol || null,
      constant_symbol: parsed.data.constant_symbol || null,
      specific_symbol: parsed.data.specific_symbol || null,
      reverse_charge_text: parsed.data.reverse_charge_text || null,
      vat_exemption_reason: parsed.data.vat_exemption_reason || null,
      notes: parsed.data.notes || null,
      internal_notes: parsed.data.internal_notes || null,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Delete existing items
  const { error: deleteItemsError } = await db
    .from("invoice_items")
    .delete()
    .eq("invoice_id", params.id)

  if (deleteItemsError) {
    return NextResponse.json({ error: deleteItemsError.message }, { status: 500 })
  }

  // Get company_id from the updated invoice
  const { data: invoiceData } = await db
    .from("invoices")
    .select("company_id")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (!invoiceData) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  // Re-insert new items
  const itemsToInsert = items.map((item, index) => ({
    company_id: invoiceData.company_id,
    invoice_id: params.id,
    position: index,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
    product_id: item.product_id || null,
  }))

  const { data: insertedItems, error: itemsError } = await (db
    .from("invoice_items") as any)
    .insert(itemsToInsert)
    .select()

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Return updated invoice with items
  return NextResponse.json({
    ...updatedInvoice,
    items: insertedItems,
  })
}

// DELETE /api/invoices/:id (soft delete)
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

  // Check if invoice exists and is in draft status
  const { data: existingInvoice, error: fetchError } = await db
    .from("invoices")
    .select("status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  if (existingInvoice.status !== "draft") {
    return NextResponse.json({
      error: "Možno odstrániť iba faktúry v stave 'draft'"
    }, { status: 400 })
  }

  const { error } = await (db
    .from("invoices") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
