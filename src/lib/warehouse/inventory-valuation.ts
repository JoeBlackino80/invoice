// Inventory Valuation Library - FIFO & Weighted Average
// Knižnica pre oceňovanie zásob - FIFO a Vážený aritmetický priemer

export interface StockMovement {
  id: string
  product_id: string
  type: "prijem" | "vydaj" | "prevod"
  quantity: number
  unit_price: number
  date: string
  warehouse_id: string
}

export interface FIFOBatch {
  movement_id: string
  date: string
  original_quantity: number
  remaining_quantity: number
  unit_price: number
}

export interface FIFOResult {
  product_id: string
  quantity_on_hand: number
  total_value: number
  average_unit_price: number
  batches: FIFOBatch[]
  cogs: number // cost of goods sold
}

export interface WeightedAverageResult {
  product_id: string
  quantity_on_hand: number
  total_value: number
  average_unit_price: number
  cogs: number
}

export interface ValuationResult {
  product_id: string
  quantity_on_hand: number
  total_value: number
  average_unit_price: number
  batches?: FIFOBatch[]
}

/**
 * FIFO (First In, First Out) - Metóda prvého vstupu, prvého výstupu
 * Track each receipt batch with quantity and unit price
 * When issuing, consume oldest batches first
 */
export function calculateFIFO(movements: StockMovement[]): FIFOResult {
  if (movements.length === 0) {
    return {
      product_id: "",
      quantity_on_hand: 0,
      total_value: 0,
      average_unit_price: 0,
      batches: [],
      cogs: 0,
    }
  }

  const productId = movements[0].product_id

  // Sort movements by date ascending
  const sorted = [...movements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const batches: FIFOBatch[] = []
  let cogs = 0

  for (const movement of sorted) {
    if (movement.type === "prijem") {
      // Add new batch
      batches.push({
        movement_id: movement.id,
        date: movement.date,
        original_quantity: movement.quantity,
        remaining_quantity: movement.quantity,
        unit_price: movement.unit_price,
      })
    } else if (movement.type === "vydaj" || movement.type === "prevod") {
      // Consume from oldest batches first
      let remainingToConsume = movement.quantity

      for (const batch of batches) {
        if (remainingToConsume <= 0) break
        if (batch.remaining_quantity <= 0) continue

        const consumed = Math.min(batch.remaining_quantity, remainingToConsume)
        batch.remaining_quantity -= consumed
        remainingToConsume -= consumed
        cogs += consumed * batch.unit_price
      }
    }
  }

  // Filter out fully consumed batches for remaining
  const activeBatches = batches.filter((b) => b.remaining_quantity > 0)

  const quantityOnHand = activeBatches.reduce(
    (sum, b) => sum + b.remaining_quantity,
    0
  )
  const totalValue = activeBatches.reduce(
    (sum, b) => sum + b.remaining_quantity * b.unit_price,
    0
  )
  const averageUnitPrice = quantityOnHand > 0 ? totalValue / quantityOnHand : 0

  return {
    product_id: productId,
    quantity_on_hand: quantityOnHand,
    total_value: Math.round(totalValue * 100) / 100,
    average_unit_price: Math.round(averageUnitPrice * 100) / 100,
    batches: activeBatches,
    cogs: Math.round(cogs * 100) / 100,
  }
}

/**
 * Weighted Average (Vážený aritmetický priemer)
 * After each receipt, recalculate average unit price
 * Formula: (existing_qty * existing_avg + new_qty * new_price) / (existing_qty + new_qty)
 */
export function calculateWeightedAverage(
  movements: StockMovement[]
): WeightedAverageResult {
  if (movements.length === 0) {
    return {
      product_id: "",
      quantity_on_hand: 0,
      total_value: 0,
      average_unit_price: 0,
      cogs: 0,
    }
  }

  const productId = movements[0].product_id

  // Sort movements by date ascending
  const sorted = [...movements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let currentQty = 0
  let currentAvgPrice = 0
  let cogs = 0

  for (const movement of sorted) {
    if (movement.type === "prijem") {
      // Recalculate weighted average
      const totalExisting = currentQty * currentAvgPrice
      const totalNew = movement.quantity * movement.unit_price
      const newTotalQty = currentQty + movement.quantity

      if (newTotalQty > 0) {
        currentAvgPrice = (totalExisting + totalNew) / newTotalQty
      }
      currentQty = newTotalQty
    } else if (movement.type === "vydaj" || movement.type === "prevod") {
      // Issue at current weighted average price
      const issuedQty = Math.min(movement.quantity, currentQty)
      cogs += issuedQty * currentAvgPrice
      currentQty -= issuedQty
      // Average price remains the same after issue
    }
  }

  const totalValue = currentQty * currentAvgPrice

  return {
    product_id: productId,
    quantity_on_hand: currentQty,
    total_value: Math.round(totalValue * 100) / 100,
    average_unit_price: Math.round(currentAvgPrice * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
  }
}

/**
 * Get product valuation using specified method
 */
export function getProductValuation(
  movements: StockMovement[],
  method: "fifo" | "weighted_average"
): ValuationResult {
  if (method === "fifo") {
    const result = calculateFIFO(movements)
    return {
      product_id: result.product_id,
      quantity_on_hand: result.quantity_on_hand,
      total_value: result.total_value,
      average_unit_price: result.average_unit_price,
      batches: result.batches,
    }
  } else {
    const result = calculateWeightedAverage(movements)
    return {
      product_id: result.product_id,
      quantity_on_hand: result.quantity_on_hand,
      total_value: result.total_value,
      average_unit_price: result.average_unit_price,
    }
  }
}
