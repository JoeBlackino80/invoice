import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import { invoiceSchema } from "@/lib/validations/invoice"

// POST /api/invoices/batch - create multiple invoices at once
export const POST = apiHandler(async (request, { user, db, log }) => {
  const body = await request.json()
  const { company_id, invoices: invoiceList } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!Array.isArray(invoiceList) || invoiceList.length === 0) {
    return NextResponse.json({ error: "Zoznam faktúr je prázdny" }, { status: 400 })
  }

  if (invoiceList.length > 50) {
    return NextResponse.json({ error: "Maximálne 50 faktúr naraz" }, { status: 400 })
  }

  // Verify access
  const { data: role } = await db
    .from("user_company_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single()

  if (!role) {
    return NextResponse.json({ error: "Nemáte prístup k tejto firme" }, { status: 403 })
  }

  const results: Array<{
    index: number
    success: boolean
    invoice_id?: string
    number?: string
    error?: string
  }> = []

  for (let i = 0; i < invoiceList.length; i++) {
    const invoiceData = invoiceList[i]

    // Validate
    const parsed = invoiceSchema.safeParse(invoiceData)
    if (!parsed.success) {
      const firstError = parsed.error.issues?.[0]?.message || "Chyba validácie"
      results.push({ index: i, success: false, error: firstError })
      continue
    }

    // Generate number
    const sequenceTypeMap: Record<string, string> = {
      vydana: "faktura_vydana",
      prijata: "faktura_prijata",
      zalohova: "zalohova_faktura",
      dobropis: "dobropis",
      proforma: "proforma",
    }
    const sequenceType = sequenceTypeMap[parsed.data.type] || "faktura_vydana"

    const { data: invoiceNumber, error: numErr } = await (db.rpc as any)(
      "generate_next_number",
      { p_company_id: company_id, p_type: sequenceType }
    )

    if (numErr) {
      results.push({ index: i, success: false, error: `Chyba generovania čísla: ${numErr.message}` })
      continue
    }

    const { items, ...headerData } = parsed.data

    // Insert invoice
    const { data: invoice, error: invErr } = await (db.from("invoices") as any)
      .insert({
        ...headerData,
        company_id,
        number: invoiceNumber,
        contact_id: parsed.data.contact_id || null,
        parent_invoice_id: parsed.data.parent_invoice_id || null,
        variable_symbol: parsed.data.variable_symbol || null,
        constant_symbol: parsed.data.constant_symbol || null,
        specific_symbol: parsed.data.specific_symbol || null,
        reverse_charge_text: parsed.data.reverse_charge_text || null,
        vat_exemption_reason: parsed.data.vat_exemption_reason || null,
        notes: parsed.data.notes || null,
        internal_notes: parsed.data.internal_notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, number")
      .single() as { data: any; error: any }

    if (invErr) {
      results.push({ index: i, success: false, error: invErr.message })
      continue
    }

    // Insert items
    const itemsToInsert = items.map((item, idx) => ({
      company_id,
      invoice_id: invoice.id,
      position: idx,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      product_id: item.product_id || null,
    }))

    const { error: itemsErr } = await (db.from("invoice_items") as any)
      .insert(itemsToInsert)

    if (itemsErr) {
      // Rollback invoice
      await (db.from("invoices") as any).delete().eq("id", invoice.id)
      results.push({ index: i, success: false, error: `Chyba položiek: ${itemsErr.message}` })
      continue
    }

    results.push({
      index: i,
      success: true,
      invoice_id: invoice.id,
      number: invoice.number,
    })
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  log.info(`Batch invoice creation: ${successCount} ok, ${failCount} failed`, {
    total: invoiceList.length,
  })

  return NextResponse.json({
    success: failCount === 0,
    total: invoiceList.length,
    created: successCount,
    failed: failCount,
    results,
  }, { status: failCount === 0 ? 201 : 207 })
})
