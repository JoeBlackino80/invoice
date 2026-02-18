import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  calculateInventoryDifferences,
  generateInventoryAccountingEntries,
} from "@/lib/warehouse/inventory-manager"
import type { ProductType } from "@/lib/warehouse/inventory-manager"

// GET /api/warehouse/inventory – zoznam inventúr alebo aktuálny stav produktov v sklade
export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const warehouseId = searchParams.get("warehouse_id")
  const mode = searchParams.get("mode") // "list" for past inventories, default = current stock

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // List past inventories
  if (mode === "list") {
    let query = (db.from("warehouse_inventories") as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  }

  // Get current stock for a warehouse (expected quantities)
  if (!warehouseId) {
    return NextResponse.json(
      { error: "warehouse_id je povinný pre zobrazenie stavu" },
      { status: 400 }
    )
  }

  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price, category_id, unit")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  // Get stock levels from warehouse_stock or stock_movements
  const { data: stockLevels, error: stockError } = await (db.from("warehouse_stock_levels") as any)
    .select("product_id, quantity")
    .eq("warehouse_id", warehouseId)

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  const stockMap = new Map<string, number>()
  if (stockLevels) {
    for (const sl of stockLevels) {
      stockMap.set(sl.product_id, sl.quantity || 0)
    }
  }

  const items = (products || []).map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    sku: p.sku || "",
    expected_quantity: stockMap.get(p.id) || 0,
    unit_price: p.purchase_price || 0,
    category: p.category_id || null,
    unit: p.unit || "ks",
  }))

  return NextResponse.json({ data: items })
}

// POST /api/warehouse/inventory – uloženie inventúry
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const {
    company_id,
    warehouse_id,
    items,
    inventory_date,
    confirm,
    product_type,
  } = body as {
    company_id: string
    warehouse_id: string
    items: Array<{ product_id: string; actual_quantity: number }>
    inventory_date: string
    confirm?: boolean
    product_type?: ProductType
  }

  if (!company_id || !warehouse_id || !items || !inventory_date) {
    return NextResponse.json(
      { error: "company_id, warehouse_id, items a inventory_date sú povinné" },
      { status: 400 }
    )
  }

  // Get expected quantities
  const productIds = items.map((i) => i.product_id)
  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price")
    .in("id", productIds)

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  const { data: stockLevels, error: stockError } = await (db.from("warehouse_stock_levels") as any)
    .select("product_id, quantity")
    .eq("warehouse_id", warehouse_id)
    .in("product_id", productIds)

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  const stockMap = new Map<string, number>()
  if (stockLevels) {
    for (const sl of stockLevels) {
      stockMap.set(sl.product_id, sl.quantity || 0)
    }
  }

  const expected = (products || []).map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    sku: p.sku || "",
    quantity: stockMap.get(p.id) || 0,
    unit_price: p.purchase_price || 0,
  }))

  const differences = calculateInventoryDifferences(expected, items)
  const status = confirm ? "confirmed" : "draft"

  // Create inventory record
  const { data: inventory, error: inventoryError } = await (db.from("warehouse_inventories") as any)
    .insert({
      company_id,
      warehouse_id,
      inventory_date,
      status,
      created_by: user.id,
      total_differences: differences.filter((d) => d.type !== "zhoda").length,
      total_value_difference: differences.reduce((s, d) => s + d.value_difference, 0),
    })
    .select()
    .single() as { data: any; error: any }

  if (inventoryError) {
    return NextResponse.json({ error: inventoryError.message }, { status: 500 })
  }

  // Save inventory items
  const inventoryItems = differences.map((d) => ({
    inventory_id: inventory.id,
    product_id: d.product_id,
    expected_quantity: d.expected_quantity,
    actual_quantity: d.actual_quantity,
    difference: d.difference,
    unit_price: d.unit_price,
    value_difference: d.value_difference,
    type: d.type,
  }))

  const { error: itemsError } = await (db.from("warehouse_inventory_items") as any)
    .insert(inventoryItems)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // If confirmed, apply adjustments
  if (confirm) {
    const pType: ProductType = product_type || "material"

    // Adjust stock levels
    for (const diff of differences) {
      if (diff.type === "zhoda") continue

      // Upsert warehouse_stock
      const { error: upsertError } = await (db.from("warehouse_stock_levels") as any)
        .upsert(
          {
            warehouse_id,
            product_id: diff.product_id,
            quantity: diff.actual_quantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "warehouse_id,product_id" }
        )

      if (upsertError) {
        console.error("Chyba pri aktualizácii stavu:", upsertError.message)
      }

      // Create stock movement
      const movementType = diff.type === "manko" ? "inventura_manko" : "inventura_prebytok"
      await (db.from("stock_movements") as any).insert({
        company_id,
        warehouse_id,
        product_id: diff.product_id,
        movement_type: movementType,
        quantity: diff.difference,
        unit_price: diff.unit_price,
        total_price: diff.value_difference,
        reference_type: "inventory",
        reference_id: inventory.id,
        note: `Inventúra ${inventory_date}: ${diff.type === "manko" ? "manko" : "prebytok"} ${Math.abs(diff.difference)} ks`,
        created_by: user.id,
        movement_date: inventory_date,
      })
    }

    // Generate accounting entries
    const accountingEntries = generateInventoryAccountingEntries(differences, pType)
    for (const entry of accountingEntries) {
      await (db.from("journal_entries") as any).insert({
        company_id,
        entry_date: inventory_date,
        description: entry.description,
        debit_account: entry.debit_account,
        credit_account: entry.credit_account,
        amount: entry.amount,
        reference_type: "inventory",
        reference_id: inventory.id,
        created_by: user.id,
      })
    }
  }

  return NextResponse.json({
    data: {
      inventory,
      differences,
      accounting_entries: confirm
        ? generateInventoryAccountingEntries(differences, product_type || "material")
        : [],
    },
  })
}
