import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/quotes/:id/convert - konvertovať cenovú ponuku na faktúru
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Fetch original quote
  const { data: quote, error: fetchError } = await db
    .from("quotes")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !quote) {
    return NextResponse.json({ error: "Cenová ponuka nenájdená" }, { status: 404 })
  }

  if (quote.status === "converted") {
    return NextResponse.json({
      error: "Táto ponuka už bola konvertovaná"
    }, { status: 400 })
  }

  // Generate new invoice number
  const { data: invoiceNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: quote.company_id,
      p_type: "faktura_vydana",
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  const items = quote.items || []

  // Create invoice
  const { data: newInvoice, error: createError } = await (db
    .from("invoices") as any)
    .insert({
      company_id: quote.company_id,
      type: "vydana",
      number: invoiceNumber,
      contact_id: quote.contact_id,
      issue_date: today,
      delivery_date: today,
      due_date: dueDate.toISOString().split("T")[0],
      currency: quote.currency,
      exchange_rate: 1,
      notes: `Vytvorená z cenovej ponuky ${quote.number}`,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Copy items to invoice_items
  if (items.length > 0) {
    const invoiceItems = items.map((item: any, index: number) => ({
      company_id: quote.company_id,
      invoice_id: newInvoice.id,
      position: index,
      description: item.description,
      quantity: item.quantity || 1,
      unit: item.unit || "ks",
      unit_price: item.unit_price,
      vat_rate: item.vat_rate || 23,
    }))

    await (db.from("invoice_items") as any).insert(invoiceItems)
  }

  // Update quote status to converted
  await (db.from("quotes") as any)
    .update({
      status: "converted",
      conversion_invoice_id: newInvoice.id,
      updated_by: user.id,
    })
    .eq("id", params.id)

  return NextResponse.json(newInvoice, { status: 201 })
}
