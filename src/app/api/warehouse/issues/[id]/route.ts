import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/warehouse/issues/:id - detail výdajky
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

  const { data: issue, error } = await (db.from("stock_issues") as any)
    .select(`
      *,
      warehouse:warehouses (id, name, code),
      customer:contacts (id, name),
      items:stock_issue_items (
        id,
        product_id,
        quantity,
        position,
        product:warehouse_products (id, name, sku, unit)
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(issue)
}

// DELETE /api/warehouse/issues/:id - storno výdajky
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

  // Get issue with items to reverse stock
  const { data: issue, error: issueError } = await (db.from("stock_issues") as any)
    .select(`
      *,
      items:stock_issue_items (
        product_id,
        quantity
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (issueError || !issue) {
    return NextResponse.json({ error: "Výdajka nenájdená" }, { status: 404 })
  }

  // Reverse stock levels for each item
  for (const item of issue.items || []) {
    const { data: stockLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", issue.warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (stockLevel) {
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: stockLevel.quantity + item.quantity })
        .eq("id", stockLevel.id)
    } else {
      await (db.from("warehouse_stock_levels") as any)
        .insert({
          warehouse_id: issue.warehouse_id,
          product_id: item.product_id,
          quantity: item.quantity,
        })
    }

    // Create reversal movement
    await (db.from("stock_movements") as any)
      .insert({
        company_id: issue.company_id,
        product_id: item.product_id,
        warehouse_id: issue.warehouse_id,
        movement_type: "storno_vydaj",
        quantity: item.quantity,
        unit_price: 0,
        total_price: 0,
        movement_date: new Date().toISOString().split("T")[0],
        reference_type: "issue_cancel",
        reference_id: issue.id,
        note: `Storno výdajky ${issue.issue_number || issue.id}`,
        created_by: user.id,
      })
  }

  // Soft delete issue
  const { error } = await (db.from("stock_issues") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
