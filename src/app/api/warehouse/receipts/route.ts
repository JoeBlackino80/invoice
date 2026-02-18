import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { stockReceiptSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/receipts - zoznam príjemiek
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const warehouseId = searchParams.get("warehouse_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("stock_receipts") as any)
    .select(`
      *,
      warehouse:warehouses (id, name, code),
      supplier:contacts (id, name)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("receipt_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId)
  }

  if (dateFrom) {
    query = query.gte("receipt_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("receipt_date", dateTo)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/warehouse/receipts - vytvorenie príjemky
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...receiptData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = stockReceiptSchema.safeParse(receiptData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...headerData } = parsed.data

  // Calculate total
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )

  // Create receipt header
  const { data: receipt, error: receiptError } = await (db.from("stock_receipts") as any)
    .insert({
      company_id,
      warehouse_id: headerData.warehouse_id,
      supplier_id: headerData.supplier_id || null,
      receipt_number: headerData.receipt_number,
      receipt_date: headerData.receipt_date,
      note: headerData.note || null,
      total_amount: totalAmount,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (receiptError) {
    return NextResponse.json({ error: receiptError.message }, { status: 500 })
  }

  // Create receipt items
  const itemsToInsert = items.map((item, index) => ({
    receipt_id: receipt.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
    batch_number: item.batch_number || null,
    serial_number: item.serial_number || null,
    position: index,
  }))

  const { error: itemsError } = await (db.from("stock_receipt_items") as any)
    .insert(itemsToInsert)

  if (itemsError) {
    // Rollback receipt
    await (db.from("stock_receipts") as any).delete().eq("id", receipt.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Update stock levels and create movements for each item
  for (const item of items) {
    // Upsert stock level
    const { data: existingLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", headerData.warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (existingLevel) {
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: existingLevel.quantity + item.quantity })
        .eq("id", existingLevel.id)
    } else {
      await (db.from("warehouse_stock_levels") as any)
        .insert({
          warehouse_id: headerData.warehouse_id,
          product_id: item.product_id,
          quantity: item.quantity,
        })
    }

    // Create stock movement
    await (db.from("stock_movements") as any)
      .insert({
        company_id,
        product_id: item.product_id,
        warehouse_id: headerData.warehouse_id,
        movement_type: "prijem",
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        movement_date: headerData.receipt_date,
        reference_type: "receipt",
        reference_id: receipt.id,
        note: `Príjemka ${headerData.receipt_number}`,
        created_by: user.id,
      })
  }

  return NextResponse.json(receipt, { status: 201 })
}
