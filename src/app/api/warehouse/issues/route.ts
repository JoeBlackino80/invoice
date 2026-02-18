import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { stockIssueSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/issues - zoznam výdajok
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
  const reason = searchParams.get("reason")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("stock_issues") as any)
    .select(`
      *,
      warehouse:warehouses (id, name, code),
      customer:contacts (id, name)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId)
  }

  if (reason) {
    query = query.eq("reason", reason)
  }

  if (dateFrom) {
    query = query.gte("issue_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("issue_date", dateTo)
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

// POST /api/warehouse/issues - vytvorenie výdajky
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...issueData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = stockIssueSchema.safeParse(issueData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...headerData } = parsed.data

  // Validate sufficient stock for each product
  const insufficientItems: string[] = []
  for (const item of items) {
    const { data: stockLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("quantity")
      .eq("warehouse_id", headerData.warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    const available = stockLevel?.quantity || 0
    if (available < item.quantity) {
      insufficientItems.push(item.product_id)
    }
  }

  if (insufficientItems.length > 0) {
    return NextResponse.json(
      { error: "Nedostatočné zásoby pre niektoré produkty", insufficient_products: insufficientItems },
      { status: 400 }
    )
  }

  // Create issue header
  const { data: issue, error: issueError } = await (db.from("stock_issues") as any)
    .insert({
      company_id,
      warehouse_id: headerData.warehouse_id,
      customer_id: headerData.customer_id || null,
      issue_number: headerData.issue_number,
      issue_date: headerData.issue_date,
      note: headerData.note || null,
      reason: headerData.reason,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (issueError) {
    return NextResponse.json({ error: issueError.message }, { status: 500 })
  }

  // Create issue items
  const itemsToInsert = items.map((item, index) => ({
    issue_id: issue.id,
    product_id: item.product_id,
    quantity: item.quantity,
    position: index,
  }))

  const { error: itemsError } = await (db.from("stock_issue_items") as any)
    .insert(itemsToInsert)

  if (itemsError) {
    await (db.from("stock_issues") as any).delete().eq("id", issue.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Decrease stock levels and create movements
  for (const item of items) {
    const { data: stockLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", headerData.warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (stockLevel) {
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: stockLevel.quantity - item.quantity })
        .eq("id", stockLevel.id)
    }

    // Create stock movement
    await (db.from("stock_movements") as any)
      .insert({
        company_id,
        product_id: item.product_id,
        warehouse_id: headerData.warehouse_id,
        movement_type: "vydaj",
        quantity: -item.quantity,
        unit_price: 0,
        total_price: 0,
        movement_date: headerData.issue_date,
        reference_type: "issue",
        reference_id: issue.id,
        note: `Výdajka ${headerData.issue_number} - ${headerData.reason}`,
        created_by: user.id,
      })
  }

  return NextResponse.json(issue, { status: 201 })
}
