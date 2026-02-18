import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  calculateABCAnalysis,
  getStockStatus,
  getStockValue,
} from "@/lib/warehouse/inventory-manager"
import type { ProductWithValue, StockValueItem } from "@/lib/warehouse/inventory-manager"

// GET /api/warehouse/reports – skladové reporty
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
  const reportType = searchParams.get("report_type")
  const warehouseId = searchParams.get("warehouse_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!reportType) {
    return NextResponse.json({ error: "report_type je povinný" }, { status: 400 })
  }

  switch (reportType) {
    case "stock-status":
      return handleStockStatus(db, companyId, warehouseId)
    case "stock-value":
      return handleStockValue(db, companyId, warehouseId)
    case "turnover":
      return handleTurnover(db, companyId, warehouseId, dateFrom, dateTo)
    case "abc-analysis":
      return handleABCAnalysis(db, companyId, warehouseId, dateFrom, dateTo)
    default:
      return NextResponse.json(
        { error: "Neplatný report_type. Povolené: stock-status, stock-value, turnover, abc-analysis" },
        { status: 400 }
      )
  }
}

// -----------------------------------------------------------------------------
// Stav zásob
// -----------------------------------------------------------------------------
async function handleStockStatus(db: any, companyId: string, warehouseId: string | null) {
  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price, min_stock, max_stock, category_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  let stockQuery = (db.from("warehouse_stock_levels") as any)
    .select("product_id, quantity, warehouse_id, warehouse:warehouses(id, name)")

  if (warehouseId) {
    stockQuery = stockQuery.eq("warehouse_id", warehouseId)
  }

  const { data: stockLevels, error: stockError } = await stockQuery

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  // Build stock map: product_id -> total quantity across warehouses
  const stockMap = new Map<string, { quantity: number; warehouse_id: string | null; warehouse_name: string | null }>()
  if (stockLevels) {
    for (const sl of stockLevels) {
      const existing = stockMap.get(sl.product_id)
      if (existing) {
        existing.quantity += sl.quantity || 0
      } else {
        stockMap.set(sl.product_id, {
          quantity: sl.quantity || 0,
          warehouse_id: sl.warehouse_id,
          warehouse_name: sl.warehouse?.name || null,
        })
      }
    }
  }

  const productsList = (products || []).map((p: any) => {
    const stock = stockMap.get(p.id)
    return {
      product_id: p.id,
      product_name: p.name,
      sku: p.sku || "",
      current_stock: stock?.quantity || 0,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      unit_price: p.purchase_price || 0,
      warehouse_id: stock?.warehouse_id || null,
      warehouse_name: stock?.warehouse_name || null,
    }
  })

  const report = getStockStatus(productsList)
  return NextResponse.json({ data: report })
}

// -----------------------------------------------------------------------------
// Hodnota skladu
// -----------------------------------------------------------------------------
async function handleStockValue(db: any, companyId: string, warehouseId: string | null) {
  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price, category_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  let stockQuery = (db.from("warehouse_stock_levels") as any)
    .select("product_id, quantity, warehouse_id, warehouse:warehouses(id, name)")

  if (warehouseId) {
    stockQuery = stockQuery.eq("warehouse_id", warehouseId)
  }

  const { data: stockLevels, error: stockError } = await stockQuery

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 })
  }

  const productMap = new Map<string, any>()
  for (const p of products || []) {
    productMap.set(p.id, p)
  }

  const items: StockValueItem[] = (stockLevels || [])
    .filter((sl: any) => productMap.has(sl.product_id))
    .map((sl: any) => {
      const prod = productMap.get(sl.product_id)
      const qty = sl.quantity || 0
      const price = prod.purchase_price || 0
      return {
        product_id: sl.product_id,
        product_name: prod.name,
        quantity: qty,
        unit_price: price,
        total_value: Math.round(qty * price * 100) / 100,
        category: prod.category_id || null,
        warehouse_id: sl.warehouse_id,
        warehouse_name: sl.warehouse?.name || null,
      }
    })

  const report = getStockValue(items)
  return NextResponse.json({ data: report })
}

// -----------------------------------------------------------------------------
// Obratovka (turnover)
// -----------------------------------------------------------------------------
async function handleTurnover(
  db: any,
  companyId: string,
  warehouseId: string | null,
  dateFrom: string | null,
  dateTo: string | null
) {
  // Get products
  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  const productIds = (products || []).map((p: any) => p.id)
  if (productIds.length === 0) {
    return NextResponse.json({ data: { products: [], totals: { opening: 0, receipts: 0, issues: 0, closing: 0 } } })
  }

  // Get opening stock (movements before dateFrom)
  const openingMap = new Map<string, number>()
  if (dateFrom) {
    let priorQuery = (db.from("stock_movements") as any)
      .select("product_id, quantity")
      .eq("company_id", companyId)
      .in("product_id", productIds)
      .lt("movement_date", dateFrom)

    if (warehouseId) {
      priorQuery = priorQuery.eq("warehouse_id", warehouseId)
    }

    const { data: priorMovements } = await priorQuery

    for (const m of priorMovements || []) {
      const existing = openingMap.get(m.product_id) || 0
      openingMap.set(m.product_id, existing + (m.quantity || 0))
    }
  }

  // Get movements in period
  let movementsQuery = (db.from("stock_movements") as any)
    .select("product_id, quantity, movement_type")
    .eq("company_id", companyId)
    .in("product_id", productIds)

  if (warehouseId) {
    movementsQuery = movementsQuery.eq("warehouse_id", warehouseId)
  }
  if (dateFrom) {
    movementsQuery = movementsQuery.gte("movement_date", dateFrom)
  }
  if (dateTo) {
    movementsQuery = movementsQuery.lte("movement_date", dateTo)
  }

  const { data: movements, error: movementsError } = await movementsQuery

  if (movementsError) {
    return NextResponse.json({ error: movementsError.message }, { status: 500 })
  }

  // Aggregate receipts and issues per product
  const receiptsMap = new Map<string, number>()
  const issuesMap = new Map<string, number>()

  for (const m of movements || []) {
    const qty = m.quantity || 0
    if (qty > 0) {
      receiptsMap.set(m.product_id, (receiptsMap.get(m.product_id) || 0) + qty)
    } else if (qty < 0) {
      issuesMap.set(m.product_id, (issuesMap.get(m.product_id) || 0) + Math.abs(qty))
    }
  }

  const productMap = new Map<string, any>()
  for (const p of products || []) {
    productMap.set(p.id, p)
  }

  // Get all unique product IDs that had any activity
  const activeProductIds = Array.from(
    new Set([
      ...Array.from(openingMap.keys()),
      ...Array.from(receiptsMap.keys()),
      ...Array.from(issuesMap.keys()),
    ])
  )

  const turnoverProducts = activeProductIds
    .filter((pid) => productMap.has(pid))
    .map((pid) => {
      const prod = productMap.get(pid)
      const opening = openingMap.get(pid) || 0
      const receipts = receiptsMap.get(pid) || 0
      const issues = issuesMap.get(pid) || 0
      const closing = opening + receipts - issues

      return {
        product_id: pid,
        product_name: prod.name,
        sku: prod.sku || "",
        unit_price: prod.purchase_price || 0,
        opening_stock: opening,
        receipts,
        issues,
        closing_stock: closing,
      }
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "sk"))

  const totals = {
    opening: turnoverProducts.reduce((s, p) => s + p.opening_stock, 0),
    receipts: turnoverProducts.reduce((s, p) => s + p.receipts, 0),
    issues: turnoverProducts.reduce((s, p) => s + p.issues, 0),
    closing: turnoverProducts.reduce((s, p) => s + p.closing_stock, 0),
  }

  return NextResponse.json({ data: { products: turnoverProducts, totals } })
}

// -----------------------------------------------------------------------------
// ABC Analýza
// -----------------------------------------------------------------------------
async function handleABCAnalysis(
  db: any,
  companyId: string,
  warehouseId: string | null,
  dateFrom: string | null,
  dateTo: string | null
) {
  const { data: products, error: productsError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price, category_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  const productIds = (products || []).map((p: any) => p.id)
  if (productIds.length === 0) {
    return NextResponse.json({
      data: calculateABCAnalysis([]),
    })
  }

  // Get consumption (issues) in period for value calculation
  let movementsQuery = (db.from("stock_movements") as any)
    .select("product_id, quantity, unit_price, total_price")
    .eq("company_id", companyId)
    .in("product_id", productIds)
    .lt("quantity", 0) // Only issues/consumption

  if (warehouseId) {
    movementsQuery = movementsQuery.eq("warehouse_id", warehouseId)
  }
  if (dateFrom) {
    movementsQuery = movementsQuery.gte("movement_date", dateFrom)
  }
  if (dateTo) {
    movementsQuery = movementsQuery.lte("movement_date", dateTo)
  }

  const { data: movements, error: movementsError } = await movementsQuery

  if (movementsError) {
    return NextResponse.json({ error: movementsError.message }, { status: 500 })
  }

  // Calculate annual consumption value per product
  const consumptionMap = new Map<string, number>()
  for (const m of movements || []) {
    const value = Math.abs(m.total_price || (m.quantity || 0) * (m.unit_price || 0))
    consumptionMap.set(m.product_id, (consumptionMap.get(m.product_id) || 0) + value)
  }

  // Get current stock
  let stockQuery = (db.from("warehouse_stock_levels") as any)
    .select("product_id, quantity")

  if (warehouseId) {
    stockQuery = stockQuery.eq("warehouse_id", warehouseId)
  }

  const { data: stockLevels } = await stockQuery
  const stockMap = new Map<string, number>()
  for (const sl of stockLevels || []) {
    stockMap.set(sl.product_id, (stockMap.get(sl.product_id) || 0) + (sl.quantity || 0))
  }

  const productsWithValue: ProductWithValue[] = (products || []).map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    sku: p.sku || "",
    category: p.category_id || null,
    annual_consumption_value: consumptionMap.get(p.id) || 0,
    current_stock: stockMap.get(p.id) || 0,
    unit_price: p.purchase_price || 0,
  }))

  const result = calculateABCAnalysis(productsWithValue)
  return NextResponse.json({ data: result })
}
