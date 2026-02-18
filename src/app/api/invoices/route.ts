import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import { invoiceSchema } from "@/lib/validations/invoice"

// GET /api/invoices - zoznam faktúr
export const GET = apiHandler(async (request, { user, db, log }) => {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const search = searchParams.get("search")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Verify user has access to this company
  const { data: role } = await db
    .from("user_company_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single()

  if (!role) {
    return NextResponse.json({ error: "Nemáte prístup k tejto firme" }, { status: 403 })
  }

  let query = db
    .from("invoices")
    .select(`
      *,
      contact:contacts(id, name, ico)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) {
    query = query.eq("type", type)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(`number.ilike.%${search}%,variable_symbol.ilike.%${search}%,customer_name.ilike.%${search}%,supplier_name.ilike.%${search}%`)
  }

  if (dateFrom) {
    query = query.gte("issue_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("issue_date", dateTo)
  }

  const { data, error, count } = await query

  if (error) {
    log.error("Failed to fetch invoices", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Summary aggregation (same filters, no pagination)
  let aggQuery = (db.from("invoices") as any)
    .select("subtotal, vat_amount, total, paid_amount, status")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  // Apply same filters as above
  if (type) aggQuery = aggQuery.eq("type", type)
  if (status) aggQuery = aggQuery.eq("status", status)
  if (search) aggQuery = aggQuery.or(`number.ilike.%${search}%,customer_name.ilike.%${search}%,supplier_name.ilike.%${search}%`)
  if (dateFrom) aggQuery = aggQuery.gte("issue_date", dateFrom)
  if (dateTo) aggQuery = aggQuery.lte("issue_date", dateTo)

  const { data: allForAgg } = await aggQuery

  const summary = { total_subtotal: 0, total_vat: 0, total_with_vat: 0, total_unpaid: 0 }
  if (allForAgg) {
    for (const inv of allForAgg) {
      summary.total_subtotal += Number(inv.subtotal) || 0
      summary.total_vat += Number(inv.vat_amount) || 0
      summary.total_with_vat += Number(inv.total) || 0
      if (inv.status !== "uhradena" && inv.status !== "stornovana") {
        summary.total_unpaid += (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)
      }
    }
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
    summary,
  })
})

// POST /api/invoices - vytvorenie faktúry
export const POST = apiHandler(async (request, { user, db, log }) => {
  const body = await request.json()
  const { company_id, ...invoiceData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Verify user has access to this company
  const { data: role } = await db
    .from("user_company_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single()

  if (!role) {
    return NextResponse.json({ error: "Nemáte prístup k tejto firme" }, { status: 403 })
  }

  const parsed = invoiceSchema.safeParse(invoiceData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Map invoice type to sequence type
  const sequenceTypeMap: Record<string, string> = {
    vydana: "faktura_vydana",
    prijata: "faktura_prijata",
    zalohova: "zalohova_faktura",
    dobropis: "dobropis",
    proforma: "proforma",
  }

  const sequenceType = sequenceTypeMap[parsed.data.type] || "faktura_vydana"

  // Generate invoice number
  const { data: invoiceNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: company_id,
      p_type: sequenceType,
    })

  if (numberError) {
    log.error("Failed to generate invoice number", numberError)
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  // Extract items from parsed data
  const { items, ...invoiceHeaderData } = parsed.data

  // Insert invoice header
  const { data: invoice, error: invoiceError } = await (db
    .from("invoices") as any)
    .insert({
      ...invoiceHeaderData,
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
    .select()
    .single() as { data: any; error: any }

  if (invoiceError) {
    log.error("Failed to create invoice", invoiceError)
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  // Insert invoice items
  const itemsToInsert = items.map((item, index) => ({
    company_id,
    invoice_id: invoice.id,
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
    log.error("Failed to create invoice items, rolling back", itemsError)
    // Rollback: delete the invoice
    await (db.from("invoices") as any).delete().eq("id", invoice.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...invoice,
    items: insertedItems,
  }, { status: 201 })
})
