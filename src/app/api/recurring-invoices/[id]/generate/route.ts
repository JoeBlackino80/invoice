import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function calculateNextDate(currentDate: string, interval: string): string {
  const date = new Date(currentDate)
  switch (interval) {
    case "monthly":
      date.setMonth(date.getMonth() + 1)
      break
    case "quarterly":
      date.setMonth(date.getMonth() + 3)
      break
    case "annually":
      date.setFullYear(date.getFullYear() + 1)
      break
  }
  return date.toISOString().split("T")[0]
}

// POST /api/recurring-invoices/:id/generate - manuálne vygenerovanie faktúry z šablóny
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

  // Fetch the recurring invoice template
  const { data: template, error: fetchError } = await (db
    .from("recurring_invoices") as any)
    .select(`
      *,
      contact:contacts(
        id, name, ico, dic, ic_dph,
        street, city, zip, country
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !template) {
    return NextResponse.json({ error: "Opakovaná faktúra nenájdená" }, { status: 404 })
  }

  if (!template.is_active) {
    return NextResponse.json({ error: "Opakovaná faktúra je neaktívna" }, { status: 400 })
  }

  // Parse items from JSON if needed
  let templateItems = template.items
  if (typeof templateItems === "string") {
    try {
      templateItems = JSON.parse(templateItems)
    } catch {
      return NextResponse.json({ error: "Neplatné položky šablóny" }, { status: 500 })
    }
  }

  if (!templateItems || !Array.isArray(templateItems) || templateItems.length === 0) {
    return NextResponse.json({ error: "Šablóna nemá žiadne položky" }, { status: 400 })
  }

  // Map invoice type to sequence type
  const sequenceTypeMap: Record<string, string> = {
    vydana: "faktura_vydana",
    prijata: "faktura_prijata",
  }
  const sequenceType = sequenceTypeMap[template.type] || "faktura_vydana"

  // Generate invoice number
  const { data: invoiceNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: template.company_id,
      p_type: sequenceType,
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  // Create new invoice from the recurring template
  const { data: newInvoice, error: createError } = await (db
    .from("invoices") as any)
    .insert({
      company_id: template.company_id,
      type: template.type,
      number: invoiceNumber,
      contact_id: template.contact_id || null,
      issue_date: today,
      delivery_date: today,
      due_date: dueDate.toISOString().split("T")[0],
      currency: template.currency,
      exchange_rate: template.exchange_rate,
      variable_symbol: template.variable_symbol || null,
      constant_symbol: template.constant_symbol || null,
      specific_symbol: template.specific_symbol || null,
      reverse_charge: template.reverse_charge,
      notes: template.notes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Create invoice items from the template
  const invoiceItems = templateItems.map((item: any, index: number) => ({
    company_id: template.company_id,
    invoice_id: newInvoice.id,
    position: index,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
  }))

  const { error: itemsError } = await (db
    .from("invoice_items") as any)
    .insert(invoiceItems)

  if (itemsError) {
    // Rollback: delete the created invoice
    await (db.from("invoices") as any).delete().eq("id", newInvoice.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Update recurring invoice: set last_generation_date and calculate next_generation_date
  const nextDate = calculateNextDate(template.next_generation_date, template.interval)

  const { error: updateError } = await (db
    .from("recurring_invoices") as any)
    .update({
      last_generation_date: today,
      next_generation_date: nextDate,
      updated_by: user.id,
    })
    .eq("id", params.id)

  if (updateError) {
    // Invoice was created but recurring update failed - log but don't fail
    console.error("Chyba pri aktualizácii opakovanej faktúry:", updateError.message)
  }

  return NextResponse.json(newInvoice, { status: 201 })
}
