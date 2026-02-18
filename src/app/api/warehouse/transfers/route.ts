import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { stockTransferSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/transfers - zoznam prevodiek
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("stock_transfers") as any)
    .select(`
      *,
      from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey (id, name, code),
      to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey (id, name, code)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("transfer_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (dateFrom) {
    query = query.gte("transfer_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("transfer_date", dateTo)
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

// POST /api/warehouse/transfers - vytvorenie prevodky
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...transferData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = stockTransferSchema.safeParse(transferData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...headerData } = parsed.data

  if (headerData.from_warehouse_id === headerData.to_warehouse_id) {
    return NextResponse.json(
      { error: "Zdrojový a cieľový sklad nemôžu byť rovnaké" },
      { status: 400 }
    )
  }

  // Validate sufficient stock in source warehouse
  const insufficientItems: string[] = []
  for (const item of items) {
    const { data: stockLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("quantity")
      .eq("warehouse_id", headerData.from_warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    const available = stockLevel?.quantity || 0
    if (available < item.quantity) {
      insufficientItems.push(item.product_id)
    }
  }

  if (insufficientItems.length > 0) {
    return NextResponse.json(
      { error: "Nedostatočné zásoby v zdrojovom sklade", insufficient_products: insufficientItems },
      { status: 400 }
    )
  }

  // Create transfer header
  const { data: transfer, error: transferError } = await (db.from("stock_transfers") as any)
    .insert({
      company_id,
      from_warehouse_id: headerData.from_warehouse_id,
      to_warehouse_id: headerData.to_warehouse_id,
      transfer_number: headerData.transfer_number,
      transfer_date: headerData.transfer_date,
      note: headerData.note || null,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (transferError) {
    return NextResponse.json({ error: transferError.message }, { status: 500 })
  }

  // Create transfer items
  const itemsToInsert = items.map((item, index) => ({
    transfer_id: transfer.id,
    product_id: item.product_id,
    quantity: item.quantity,
    position: index,
  }))

  const { error: itemsError } = await (db.from("stock_transfer_items") as any)
    .insert(itemsToInsert)

  if (itemsError) {
    await (db.from("stock_transfers") as any).delete().eq("id", transfer.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Update stock levels and create movements for each item
  for (const item of items) {
    // Decrease from source warehouse
    const { data: sourceLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", headerData.from_warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (sourceLevel) {
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: sourceLevel.quantity - item.quantity })
        .eq("id", sourceLevel.id)
    }

    // Increase in target warehouse
    const { data: targetLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", headerData.to_warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (targetLevel) {
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: targetLevel.quantity + item.quantity })
        .eq("id", targetLevel.id)
    } else {
      await (db.from("warehouse_stock_levels") as any)
        .insert({
          warehouse_id: headerData.to_warehouse_id,
          product_id: item.product_id,
          quantity: item.quantity,
        })
    }

    // Create stock movement for source (vydaj)
    await (db.from("stock_movements") as any)
      .insert({
        company_id,
        product_id: item.product_id,
        warehouse_id: headerData.from_warehouse_id,
        movement_type: "prevod_vydaj",
        quantity: -item.quantity,
        unit_price: 0,
        total_price: 0,
        movement_date: headerData.transfer_date,
        reference_type: "transfer",
        reference_id: transfer.id,
        note: `Prevodka ${headerData.transfer_number} - výdaj`,
        created_by: user.id,
      })

    // Create stock movement for target (prijem)
    await (db.from("stock_movements") as any)
      .insert({
        company_id,
        product_id: item.product_id,
        warehouse_id: headerData.to_warehouse_id,
        movement_type: "prevod_prijem",
        quantity: item.quantity,
        unit_price: 0,
        total_price: 0,
        movement_date: headerData.transfer_date,
        reference_type: "transfer",
        reference_id: transfer.id,
        note: `Prevodka ${headerData.transfer_number} - príjem`,
        created_by: user.id,
      })
  }

  return NextResponse.json(transfer, { status: 201 })
}
