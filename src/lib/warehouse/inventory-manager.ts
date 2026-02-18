// =============================================================================
// Warehouse Inventory Manager
// Inventúra, ABC analýza, stav zásob
// =============================================================================

// -----------------------------------------------------------------------------
// Types / Interfaces
// -----------------------------------------------------------------------------

export interface InventoryItem {
  product_id: string
  product_name: string
  sku: string
  expected_quantity: number
  actual_quantity: number
  difference: number
  unit_price: number
  value_difference: number
}

export interface InventoryDifference {
  product_id: string
  product_name: string
  sku: string
  expected_quantity: number
  actual_quantity: number
  difference: number
  unit_price: number
  value_difference: number
  type: "manko" | "prebytok" | "zhoda"
}

export interface AccountingEntry {
  description: string
  debit_account: string
  credit_account: string
  amount: number
  product_id: string
  product_name: string
  entry_type: "manko" | "prebytok"
}

export interface ProductWithValue {
  product_id: string
  product_name: string
  sku: string
  category: string | null
  annual_consumption_value: number
  current_stock: number
  unit_price: number
}

export interface ABCCategory {
  category: "A" | "B" | "C"
  products: ABCProduct[]
  total_value: number
  percentage_of_total: number
  product_count: number
  recommendation: string
}

export interface ABCProduct {
  product_id: string
  product_name: string
  sku: string
  annual_consumption_value: number
  cumulative_percentage: number
  category: "A" | "B" | "C"
}

export interface ABCResult {
  categories: ABCCategory[]
  total_value: number
  products: ABCProduct[]
}

export interface StockStatusProduct {
  product_id: string
  product_name: string
  sku: string
  current_stock: number
  min_stock: number | null
  max_stock: number | null
  unit_price: number
  status: "pod_minimum" | "nad_maximum" | "nulovy_stav" | "v_norme"
  warehouse_id: string | null
  warehouse_name: string | null
}

export interface StockStatusReport {
  products: StockStatusProduct[]
  below_min_count: number
  above_max_count: number
  zero_stock_count: number
  normal_count: number
  total_products: number
}

export interface StockValueItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_value: number
  category: string | null
  warehouse_id: string | null
  warehouse_name: string | null
}

export interface StockValueReport {
  total_value: number
  by_category: Array<{ category: string; value: number; count: number }>
  by_warehouse: Array<{ warehouse_id: string; warehouse_name: string; value: number; count: number }>
  items: StockValueItem[]
}

export type ProductType = "material" | "tovar"

// -----------------------------------------------------------------------------
// Inventúra – rozdielové výpočty
// -----------------------------------------------------------------------------

export function calculateInventoryDifferences(
  expected: Array<{ product_id: string; product_name: string; sku: string; quantity: number; unit_price: number }>,
  actual: Array<{ product_id: string; actual_quantity: number }>
): InventoryDifference[] {
  const actualMap = new Map<string, number>()
  for (const item of actual) {
    actualMap.set(item.product_id, item.actual_quantity)
  }

  return expected.map((exp) => {
    const actualQty = actualMap.get(exp.product_id) ?? exp.quantity
    const diff = actualQty - exp.quantity
    const valueDiff = diff * exp.unit_price

    let type: "manko" | "prebytok" | "zhoda" = "zhoda"
    if (diff < 0) type = "manko"
    else if (diff > 0) type = "prebytok"

    return {
      product_id: exp.product_id,
      product_name: exp.product_name,
      sku: exp.sku,
      expected_quantity: exp.quantity,
      actual_quantity: actualQty,
      difference: diff,
      unit_price: exp.unit_price,
      value_difference: Math.round(valueDiff * 100) / 100,
      type,
    }
  })
}

// -----------------------------------------------------------------------------
// Účtovné zápisy pre inventúrne rozdiely
// -----------------------------------------------------------------------------

export function generateInventoryAccountingEntries(
  differences: InventoryDifference[],
  productType: ProductType = "material"
): AccountingEntry[] {
  const entries: AccountingEntry[] = []

  for (const diff of differences) {
    if (diff.type === "zhoda") continue

    const amount = Math.abs(diff.value_difference)

    if (diff.type === "manko") {
      // Manko: 549 (Manká a škody) / 112 (Materiál na sklade) alebo 132 (Tovar na sklade)
      entries.push({
        description: `Manko - ${diff.product_name} (${Math.abs(diff.difference)} ks)`,
        debit_account: "549",
        credit_account: productType === "material" ? "112" : "132",
        amount,
        product_id: diff.product_id,
        product_name: diff.product_name,
        entry_type: "manko",
      })
    } else if (diff.type === "prebytok") {
      // Prebytok: 112/132 (zásoby) / 648 (Ostatné výnosy z hospodárskej činnosti)
      entries.push({
        description: `Prebytok - ${diff.product_name} (${diff.difference} ks)`,
        debit_account: productType === "material" ? "112" : "132",
        credit_account: "648",
        amount,
        product_id: diff.product_id,
        product_name: diff.product_name,
        entry_type: "prebytok",
      })
    }
  }

  return entries
}

// -----------------------------------------------------------------------------
// ABC Analýza
// -----------------------------------------------------------------------------

export function calculateABCAnalysis(products: ProductWithValue[]): ABCResult {
  if (products.length === 0) {
    return {
      categories: [
        { category: "A", products: [], total_value: 0, percentage_of_total: 0, product_count: 0, recommendation: "Vysoká priorita - pravidelná kontrola a presné plánovanie" },
        { category: "B", products: [], total_value: 0, percentage_of_total: 0, product_count: 0, recommendation: "Stredná priorita - periodická kontrola" },
        { category: "C", products: [], total_value: 0, percentage_of_total: 0, product_count: 0, recommendation: "Nízka priorita - minimálna kontrola, väčšie objednávky" },
      ],
      total_value: 0,
      products: [],
    }
  }

  // Sort products by annual consumption value descending
  const sorted = [...products].sort(
    (a, b) => b.annual_consumption_value - a.annual_consumption_value
  )

  const totalValue = sorted.reduce((sum, p) => sum + p.annual_consumption_value, 0)

  if (totalValue === 0) {
    const allProducts: ABCProduct[] = sorted.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      sku: p.sku,
      annual_consumption_value: 0,
      cumulative_percentage: 0,
      category: "C" as const,
    }))
    return {
      categories: [
        { category: "A", products: [], total_value: 0, percentage_of_total: 0, product_count: 0, recommendation: "Vysoká priorita - pravidelná kontrola a presné plánovanie" },
        { category: "B", products: [], total_value: 0, percentage_of_total: 0, product_count: 0, recommendation: "Stredná priorita - periodická kontrola" },
        { category: "C", products: allProducts, total_value: 0, percentage_of_total: 100, product_count: allProducts.length, recommendation: "Nízka priorita - minimálna kontrola, väčšie objednávky" },
      ],
      total_value: 0,
      products: allProducts,
    }
  }

  let cumulativeValue = 0
  const classifiedProducts: ABCProduct[] = sorted.map((p) => {
    cumulativeValue += p.annual_consumption_value
    const cumulativePct = (cumulativeValue / totalValue) * 100

    let category: "A" | "B" | "C"
    if (cumulativePct <= 80) {
      category = "A"
    } else if (cumulativePct <= 95) {
      category = "B"
    } else {
      category = "C"
    }

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      sku: p.sku,
      annual_consumption_value: p.annual_consumption_value,
      cumulative_percentage: Math.round(cumulativePct * 100) / 100,
      category,
    }
  })

  // Group into categories
  const aProducts = classifiedProducts.filter((p) => p.category === "A")
  const bProducts = classifiedProducts.filter((p) => p.category === "B")
  const cProducts = classifiedProducts.filter((p) => p.category === "C")

  const aValue = aProducts.reduce((s, p) => s + p.annual_consumption_value, 0)
  const bValue = bProducts.reduce((s, p) => s + p.annual_consumption_value, 0)
  const cValue = cProducts.reduce((s, p) => s + p.annual_consumption_value, 0)

  const categories: ABCCategory[] = [
    {
      category: "A",
      products: aProducts,
      total_value: Math.round(aValue * 100) / 100,
      percentage_of_total: Math.round((aValue / totalValue) * 10000) / 100,
      product_count: aProducts.length,
      recommendation: "Vysoká priorita - pravidelná kontrola a presné plánovanie",
    },
    {
      category: "B",
      products: bProducts,
      total_value: Math.round(bValue * 100) / 100,
      percentage_of_total: Math.round((bValue / totalValue) * 10000) / 100,
      product_count: bProducts.length,
      recommendation: "Stredná priorita - periodická kontrola",
    },
    {
      category: "C",
      products: cProducts,
      total_value: Math.round(cValue * 100) / 100,
      percentage_of_total: Math.round((cValue / totalValue) * 10000) / 100,
      product_count: cProducts.length,
      recommendation: "Nízka priorita - minimálna kontrola, väčšie objednávky",
    },
  ]

  return {
    categories,
    total_value: Math.round(totalValue * 100) / 100,
    products: classifiedProducts,
  }
}

// -----------------------------------------------------------------------------
// Stav zásob
// -----------------------------------------------------------------------------

export function getStockStatus(
  products: Array<{
    product_id: string
    product_name: string
    sku: string
    current_stock: number
    min_stock: number | null
    max_stock: number | null
    unit_price: number
    warehouse_id: string | null
    warehouse_name: string | null
  }>
): StockStatusReport {
  const statusProducts: StockStatusProduct[] = products.map((p) => {
    let status: StockStatusProduct["status"] = "v_norme"
    if (p.current_stock === 0) {
      status = "nulovy_stav"
    } else if (p.min_stock !== null && p.current_stock < p.min_stock) {
      status = "pod_minimum"
    } else if (p.max_stock !== null && p.current_stock > p.max_stock) {
      status = "nad_maximum"
    }

    return { ...p, status }
  })

  return {
    products: statusProducts,
    below_min_count: statusProducts.filter((p) => p.status === "pod_minimum").length,
    above_max_count: statusProducts.filter((p) => p.status === "nad_maximum").length,
    zero_stock_count: statusProducts.filter((p) => p.status === "nulovy_stav").length,
    normal_count: statusProducts.filter((p) => p.status === "v_norme").length,
    total_products: statusProducts.length,
  }
}

// -----------------------------------------------------------------------------
// Hodnota zásob
// -----------------------------------------------------------------------------

export function getStockValue(
  items: StockValueItem[]
): StockValueReport {
  const totalValue = items.reduce((sum, item) => sum + item.total_value, 0)

  // Group by category
  const categoryMap = new Map<string, { value: number; count: number }>()
  for (const item of items) {
    const cat = item.category || "Bez kategórie"
    const existing = categoryMap.get(cat) || { value: 0, count: 0 }
    existing.value += item.total_value
    existing.count += 1
    categoryMap.set(cat, existing)
  }
  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    value: Math.round(data.value * 100) / 100,
    count: data.count,
  }))

  // Group by warehouse
  const warehouseMap = new Map<string, { warehouse_name: string; value: number; count: number }>()
  for (const item of items) {
    const whId = item.warehouse_id || "none"
    const whName = item.warehouse_name || "Bez skladu"
    const existing = warehouseMap.get(whId) || { warehouse_name: whName, value: 0, count: 0 }
    existing.value += item.total_value
    existing.count += 1
    warehouseMap.set(whId, existing)
  }
  const byWarehouse = Array.from(warehouseMap.entries()).map(([warehouse_id, data]) => ({
    warehouse_id,
    warehouse_name: data.warehouse_name,
    value: Math.round(data.value * 100) / 100,
    count: data.count,
  }))

  return {
    total_value: Math.round(totalValue * 100) / 100,
    by_category: byCategory,
    by_warehouse: byWarehouse,
    items,
  }
}
