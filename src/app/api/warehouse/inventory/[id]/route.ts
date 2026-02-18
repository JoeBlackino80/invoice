import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateInventoryAccountingEntries,
} from "@/lib/warehouse/inventory-manager"
import type { InventoryDifference, ProductType } from "@/lib/warehouse/inventory-manager"

// GET /api/warehouse/inventory/:id – detail inventúry
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: inventory, error } = await (db.from("warehouse_inventories") as any)
    .select("*")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Inventúra nenájdená" }, { status: 404 })
  }

  const { data: items, error: itemsError } = await (db.from("warehouse_inventory_items") as any)
    .select(`
      *,
      product:warehouse_products (id, name, sku)
    `)
    .eq("inventory_id", params.id)
    .order("product_id")

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...inventory,
      items: items || [],
    },
  })
}

// PUT /api/warehouse/inventory/:id – aktualizácia položiek inventúry (pred potvrdením)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check inventory is still draft
  const { data: inventory, error: invError } = await (db.from("warehouse_inventories") as any)
    .select("*")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (invError) {
    return NextResponse.json({ error: "Inventúra nenájdená" }, { status: 404 })
  }

  if (inventory.status !== "draft") {
    return NextResponse.json(
      { error: "Možno upravovať iba inventúry v stave 'draft'" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const { items } = body as {
    items: Array<{
      product_id: string
      actual_quantity: number
      expected_quantity: number
      unit_price: number
    }>
  }

  if (!items) {
    return NextResponse.json({ error: "items sú povinné" }, { status: 400 })
  }

  // Delete old items
  const { error: deleteError } = await (db.from("warehouse_inventory_items") as any)
    .delete()
    .eq("inventory_id", params.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Re-insert updated items
  const newItems = items.map((item) => {
    const diff = item.actual_quantity - item.expected_quantity
    let type: "manko" | "prebytok" | "zhoda" = "zhoda"
    if (diff < 0) type = "manko"
    else if (diff > 0) type = "prebytok"

    return {
      inventory_id: params.id,
      product_id: item.product_id,
      expected_quantity: item.expected_quantity,
      actual_quantity: item.actual_quantity,
      difference: diff,
      unit_price: item.unit_price,
      value_difference: Math.round(diff * item.unit_price * 100) / 100,
      type,
    }
  })

  const { error: insertError } = await (db.from("warehouse_inventory_items") as any)
    .insert(newItems)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update inventory totals
  const totalDifferences = newItems.filter((i) => i.type !== "zhoda").length
  const totalValueDifference = newItems.reduce((s, i) => s + i.value_difference, 0)

  const { error: updateError } = await (db.from("warehouse_inventories") as any)
    .update({
      total_differences: totalDifferences,
      total_value_difference: Math.round(totalValueDifference * 100) / 100,
    })
    .eq("id", params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { items: newItems } })
}

// POST /api/warehouse/inventory/:id – potvrdenie inventúry (action=confirm)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { action, product_type } = body as {
    action: string
    product_type?: ProductType
  }

  if (action !== "confirm") {
    return NextResponse.json({ error: "Neplatná akcia" }, { status: 400 })
  }

  const { data: inventory, error: invError } = await (db.from("warehouse_inventories") as any)
    .select("*")
    .eq("id", params.id)
    .single() as { data: any; error: any }

  if (invError) {
    return NextResponse.json({ error: "Inventúra nenájdená" }, { status: 404 })
  }

  if (inventory.status !== "draft") {
    return NextResponse.json(
      { error: "Inventúra už bola potvrdená" },
      { status: 400 }
    )
  }

  const { data: items, error: itemsError } = await (db.from("warehouse_inventory_items") as any)
    .select("*")
    .eq("inventory_id", params.id)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const pType: ProductType = product_type || "material"

  // Apply adjustments
  for (const item of items || []) {
    if (item.type === "zhoda") continue

    // Upsert warehouse_stock
    await (db.from("warehouse_stock_levels") as any).upsert(
      {
        warehouse_id: inventory.warehouse_id,
        product_id: item.product_id,
        quantity: item.actual_quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "warehouse_id,product_id" }
    )

    // Create stock movement
    const movementType = item.type === "manko" ? "inventura_manko" : "inventura_prebytok"
    await (db.from("stock_movements") as any).insert({
      company_id: inventory.company_id,
      warehouse_id: inventory.warehouse_id,
      product_id: item.product_id,
      movement_type: movementType,
      quantity: item.difference,
      unit_price: item.unit_price,
      total_price: item.value_difference,
      reference_type: "inventory",
      reference_id: inventory.id,
      note: `Inventúra ${inventory.inventory_date}: ${item.type === "manko" ? "manko" : "prebytok"} ${Math.abs(item.difference)} ks`,
      created_by: user.id,
      movement_date: inventory.inventory_date,
    })
  }

  // Generate accounting entries
  const differences: InventoryDifference[] = (items || []).map((item: any) => ({
    product_id: item.product_id,
    product_name: "",
    sku: "",
    expected_quantity: item.expected_quantity,
    actual_quantity: item.actual_quantity,
    difference: item.difference,
    unit_price: item.unit_price,
    value_difference: item.value_difference,
    type: item.type,
  }))

  const accountingEntries = generateInventoryAccountingEntries(differences, pType)
  for (const entry of accountingEntries) {
    await (db.from("journal_entries") as any).insert({
      company_id: inventory.company_id,
      entry_date: inventory.inventory_date,
      description: entry.description,
      debit_account: entry.debit_account,
      credit_account: entry.credit_account,
      amount: entry.amount,
      reference_type: "inventory",
      reference_id: inventory.id,
      created_by: user.id,
    })
  }

  // Mark confirmed
  const { error: confirmError } = await (db.from("warehouse_inventories") as any)
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: user.id })
    .eq("id", params.id)

  if (confirmError) {
    return NextResponse.json({ error: confirmError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: { accounting_entries: accountingEntries },
  })
}
