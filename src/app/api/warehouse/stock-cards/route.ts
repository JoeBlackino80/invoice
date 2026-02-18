import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/warehouse/stock-cards – skladová karta produktu
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
  const productId = searchParams.get("product_id")
  const warehouseId = searchParams.get("warehouse_id")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const companyId = searchParams.get("company_id")

  if (!productId) {
    return NextResponse.json({ error: "product_id je povinný" }, { status: 400 })
  }

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  // Get product info
  const { data: product, error: productError } = await (db.from("warehouse_products") as any)
    .select("id, name, sku, purchase_price, category_id, unit")
    .eq("id", productId)
    .single() as { data: any; error: any }

  if (productError) {
    return NextResponse.json({ error: "Produkt nenájdený" }, { status: 404 })
  }

  // Build movements query
  let query = (db.from("stock_movements") as any)
    .select("*")
    .eq("product_id", productId)
    .eq("company_id", companyId)
    .order("movement_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId)
  }

  if (dateFrom) {
    query = query.gte("movement_date", dateFrom)
  }

  if (dateTo) {
    query = query.lte("movement_date", dateTo)
  }

  const { data: movements, error: movementsError } = await query

  if (movementsError) {
    return NextResponse.json({ error: movementsError.message }, { status: 500 })
  }

  // Calculate opening stock (movements before dateFrom)
  let openingStock = 0
  if (dateFrom) {
    const { data: priorMovements, error: priorError } = await (db.from("stock_movements") as any)
      .select("quantity, movement_type")
      .eq("product_id", productId)
      .eq("company_id", companyId)
      .lt("movement_date", dateFrom)

    if (!priorError && priorMovements) {
      for (const m of priorMovements) {
        openingStock += m.quantity || 0
      }
    }
  }

  // Build running balance
  let runningBalance = openingStock
  const movementsWithBalance = (movements || []).map((m: any) => {
    const qty = m.quantity || 0
    runningBalance += qty

    // Determine if it's receipt (príjem) or issue (výdaj) or transfer
    let direction: "prijem" | "vydaj" | "prevod" | "inventura" = "prijem"
    const mt = (m.movement_type || "").toLowerCase()
    if (mt.includes("vydaj") || mt.includes("issue") || mt.includes("predaj") || mt.includes("spotreba")) {
      direction = "vydaj"
    } else if (mt.includes("prevod") || mt.includes("transfer")) {
      direction = "prevod"
    } else if (mt.includes("inventura")) {
      direction = "inventura"
    }

    return {
      id: m.id,
      date: m.movement_date,
      movement_type: m.movement_type,
      direction,
      document_number: m.document_number || m.reference_id || null,
      quantity: qty,
      unit_price: m.unit_price || 0,
      total_price: m.total_price || 0,
      running_balance: runningBalance,
      note: m.note || null,
      warehouse_id: m.warehouse_id,
    }
  })

  const closingStock = runningBalance

  // Total receipts and issues
  const totalReceipts = movementsWithBalance
    .filter((m: any) => m.quantity > 0)
    .reduce((s: number, m: any) => s + m.quantity, 0)
  const totalIssues = Math.abs(
    movementsWithBalance
      .filter((m: any) => m.quantity < 0)
      .reduce((s: number, m: any) => s + m.quantity, 0)
  )

  // Calculate average cost = total cost of receipts / total receipt quantity
  const receiptMovements = movementsWithBalance.filter((m: any) => m.quantity > 0 && m.unit_price > 0)
  const totalReceiptCost = receiptMovements.reduce((s: number, m: any) => s + (m.quantity * m.unit_price), 0)
  const totalReceiptQty = receiptMovements.reduce((s: number, m: any) => s + m.quantity, 0)
  const averageCost = totalReceiptQty > 0 ? Math.round((totalReceiptCost / totalReceiptQty) * 100) / 100 : 0

  // Last movement date
  const lastMovementDate = movementsWithBalance.length > 0
    ? movementsWithBalance[movementsWithBalance.length - 1].date
    : null

  return NextResponse.json({
    data: {
      product,
      opening_stock: openingStock,
      closing_stock: closingStock,
      total_receipts: totalReceipts,
      total_issues: totalIssues,
      average_cost: averageCost,
      last_movement_date: lastMovementDate,
      movements: movementsWithBalance,
    },
  })
}
