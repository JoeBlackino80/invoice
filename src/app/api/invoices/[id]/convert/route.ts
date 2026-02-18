import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/invoices/:id/convert - konvertovať proformu/zálohu na ostrú faktúru
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

  // Fetch original invoice with items
  const { data: original, error: fetchError } = await db
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !original) {
    return NextResponse.json({ error: "Doklad nenájdený" }, { status: 404 })
  }

  if (original.type !== "proforma" && original.type !== "zalohova") {
    return NextResponse.json({
      error: "Konvertovať je možné iba proformu alebo zálohovú faktúru"
    }, { status: 400 })
  }

  const { data: originalItems } = await db
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", params.id)
    .order("position") as { data: any[]; error: any }

  // Generate new invoice number
  const { data: invoiceNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: original.company_id,
      p_type: "faktura_vydana",
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  // Create new invoice from the proforma/advance
  const { data: newInvoice, error: createError } = await (db
    .from("invoices") as any)
    .insert({
      company_id: original.company_id,
      type: "vydana",
      number: invoiceNumber,
      contact_id: original.contact_id,
      parent_invoice_id: params.id,
      issue_date: today,
      delivery_date: today,
      due_date: dueDate.toISOString().split("T")[0],
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      variable_symbol: original.variable_symbol,
      constant_symbol: original.constant_symbol,
      specific_symbol: original.specific_symbol,
      reverse_charge: original.reverse_charge,
      supplier_name: original.supplier_name,
      supplier_ico: original.supplier_ico,
      supplier_dic: original.supplier_dic,
      supplier_ic_dph: original.supplier_ic_dph,
      supplier_street: original.supplier_street,
      supplier_city: original.supplier_city,
      supplier_zip: original.supplier_zip,
      supplier_country: original.supplier_country,
      supplier_iban: original.supplier_iban,
      supplier_bic: original.supplier_bic,
      customer_name: original.customer_name,
      customer_ico: original.customer_ico,
      customer_dic: original.customer_dic,
      customer_ic_dph: original.customer_ic_dph,
      customer_street: original.customer_street,
      customer_city: original.customer_city,
      customer_zip: original.customer_zip,
      customer_country: original.customer_country,
      notes: `Vytvorená z ${original.type === "proforma" ? "proformy" : "zálohovej faktúry"} ${original.number}`,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Copy items
  if (originalItems && originalItems.length > 0) {
    const newItems = originalItems.map((item: any, index: number) => ({
      company_id: original.company_id,
      invoice_id: newInvoice.id,
      position: index,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      product_id: item.product_id,
    }))

    await (db.from("invoice_items") as any).insert(newItems)
  }

  // Mark original as converted (stornovana)
  await (db.from("invoices") as any)
    .update({ status: "stornovana", updated_by: user.id })
    .eq("id", params.id)

  return NextResponse.json(newInvoice, { status: 201 })
}
