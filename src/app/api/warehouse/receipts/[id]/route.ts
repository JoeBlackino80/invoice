import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/warehouse/receipts/:id - detail príjemky
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

  const { data: receipt, error } = await (db.from("stock_receipts") as any)
    .select(`
      *,
      warehouse:warehouses (id, name, code),
      supplier:contacts (id, name),
      items:stock_receipt_items (
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        batch_number,
        serial_number,
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

  return NextResponse.json(receipt)
}

// DELETE /api/warehouse/receipts/:id - storno príjemky
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

  // Get receipt with items to reverse stock
  const { data: receipt, error: receiptError } = await (db.from("stock_receipts") as any)
    .select(`
      *,
      items:stock_receipt_items (
        product_id,
        quantity
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (receiptError || !receipt) {
    return NextResponse.json({ error: "Príjemka nenájdená" }, { status: 404 })
  }

  // Reverse stock levels for each item
  for (const item of receipt.items || []) {
    const { data: stockLevel } = await (db.from("warehouse_stock_levels") as any)
      .select("id, quantity")
      .eq("warehouse_id", receipt.warehouse_id)
      .eq("product_id", item.product_id)
      .maybeSingle() as { data: any; error: any }

    if (stockLevel) {
      const newQty = Math.max(0, stockLevel.quantity - item.quantity)
      await (db.from("warehouse_stock_levels") as any)
        .update({ quantity: newQty })
        .eq("id", stockLevel.id)
    }

    // Create reversal movement
    await (db.from("stock_movements") as any)
      .insert({
        company_id: receipt.company_id,
        product_id: item.product_id,
        warehouse_id: receipt.warehouse_id,
        movement_type: "storno_prijem",
        quantity: -item.quantity,
        unit_price: 0,
        total_price: 0,
        movement_date: new Date().toISOString().split("T")[0],
        reference_type: "receipt_cancel",
        reference_id: receipt.id,
        note: `Storno príjemky ${receipt.receipt_number || receipt.id}`,
        created_by: user.id,
      })
  }

  // Soft delete receipt
  const { error } = await (db.from("stock_receipts") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
