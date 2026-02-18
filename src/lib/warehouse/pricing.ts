// =============================================================================
// Warehouse Pricing & Margin Calculation
// Cenotvorba – velkoobchod, maloobchod, VIP
// =============================================================================

// -----------------------------------------------------------------------------
// Types / Interfaces
// -----------------------------------------------------------------------------

export interface PriceLevel {
  id?: string
  company_id: string
  name: string
  type: "margin" | "markup"
  percentage: number
  is_default: boolean
}

export interface ProductPricing {
  product_id: string
  product_name: string
  sku: string
  purchase_price: number
  prices: Array<{
    level_name: string
    level_type: "margin" | "markup"
    percentage: number
    sale_price: number
    profit: number
    margin_pct: number
    markup_pct: number
  }>
}

export interface MarginResult {
  margin_pct: number
  markup_pct: number
  profit: number
}

// -----------------------------------------------------------------------------
// Výpočet predajnej ceny
// -----------------------------------------------------------------------------

/**
 * Vypočíta predajnú cenu z nákupnej ceny podľa typu výpočtu.
 *
 * margin: predajná cena = nákupná / (1 - margin_pct/100)
 *   Príklad: nákupná 80, marža 20% → predajná = 80 / (1 - 0.20) = 100
 *
 * markup: predajná cena = nákupná * (1 + markup_pct/100)
 *   Príklad: nákupná 80, prirážka 25% → predajná = 80 * 1.25 = 100
 */
export function calculateSalePrice(
  purchase_price: number,
  percentage: number,
  type: "margin" | "markup"
): number {
  if (purchase_price <= 0) return 0

  if (type === "margin") {
    if (percentage >= 100) return 0 // marža nemôže byť 100% alebo viac
    return Math.round((purchase_price / (1 - percentage / 100)) * 100) / 100
  }

  // markup
  return Math.round((purchase_price * (1 + percentage / 100)) * 100) / 100
}

// -----------------------------------------------------------------------------
// Výpočet marže a prirážky
// -----------------------------------------------------------------------------

/**
 * Vypočíta maržu a prirážku z nákupnej a predajnej ceny.
 *
 * Marža (margin) = (predajná - nákupná) / predajná * 100
 * Prirážka (markup) = (predajná - nákupná) / nákupná * 100
 */
export function calculateMargin(
  purchase_price: number,
  sale_price: number
): MarginResult {
  if (purchase_price <= 0 || sale_price <= 0) {
    return { margin_pct: 0, markup_pct: 0, profit: 0 }
  }

  const profit = sale_price - purchase_price
  const margin_pct = (profit / sale_price) * 100
  const markup_pct = (profit / purchase_price) * 100

  return {
    margin_pct: Math.round(margin_pct * 100) / 100,
    markup_pct: Math.round(markup_pct * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  }
}

// -----------------------------------------------------------------------------
// Aplikovanie cenovej hladiny na produkt
// -----------------------------------------------------------------------------

export function applyPriceLevel(
  product: { purchase_price: number },
  priceLevel: PriceLevel
): number {
  return calculateSalePrice(
    product.purchase_price,
    priceLevel.percentage,
    priceLevel.type
  )
}

// -----------------------------------------------------------------------------
// Výpočet cien pre produkt cez všetky cenové hladiny
// -----------------------------------------------------------------------------

export function calculateAllPriceLevels(
  product: { product_id: string; product_name: string; sku: string; purchase_price: number },
  priceLevels: PriceLevel[]
): ProductPricing {
  const prices = priceLevels.map((level) => {
    const salePrice = calculateSalePrice(
      product.purchase_price,
      level.percentage,
      level.type
    )
    const marginResult = calculateMargin(product.purchase_price, salePrice)

    return {
      level_name: level.name,
      level_type: level.type,
      percentage: level.percentage,
      sale_price: salePrice,
      profit: marginResult.profit,
      margin_pct: marginResult.margin_pct,
      markup_pct: marginResult.markup_pct,
    }
  })

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    sku: product.sku,
    purchase_price: product.purchase_price,
    prices,
  }
}

// -----------------------------------------------------------------------------
// Predvolené cenové hladiny
// -----------------------------------------------------------------------------

export const DEFAULT_PRICE_LEVELS: Omit<PriceLevel, "id" | "company_id">[] = [
  { name: "Veľkoobchod", type: "markup", percentage: 15, is_default: false },
  { name: "Maloobchod", type: "markup", percentage: 30, is_default: true },
  { name: "VIP", type: "markup", percentage: 10, is_default: false },
]
