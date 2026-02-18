/**
 * Automaticke uctovanie cestovnych nahrad podla slovenskych uctovnych standardov.
 *
 * Prehladova tabulka uctovnych predkontacii:
 * - Hotovostne cestovne: 512/211
 * - Bezhotovostne cestovne: 512/321
 * - Zalohovy platba (hotovost): 335/211
 * - Zalohovy platba (banka): 335/221
 * - Vyuctovanie - zamestnanec vracia: 211/335
 * - Vyuctovanie - zamestnavatel doplaca (hotovost): 512/211
 * - Vyuctovanie - zamestnavatel doplaca (banka): 512/221
 * - Kurzova strata: 563/335
 * - Kurzovy zisk: 335/663
 */

export interface TravelAccountingEntry {
  debit_account: string
  credit_account: string
  amount: number
  description: string
  currency: string
}

export interface TravelOrderData {
  id: string
  employee_name: string
  destination: string
  purpose: string
  date_from: string
  date_to: string
  is_foreign: boolean
  currency?: string
  exchange_rate?: number
}

export interface TravelSettlementData {
  id: string
  travel_order_id: string
  meal_allowance: number
  transport_cost: number
  accommodation_cost: number
  other_costs: number
  total_expenses: number
  advance_amount: number
  difference: number // positive = employer reimburses, negative = employee returns
  currency: string
  exchange_rate?: number
  foreign_amount?: number
  foreign_currency?: string
}

/**
 * Generuje uctovne zapisy pre cestovny prikaz po vyuctovani.
 * Hlavna funkcia, ktora zvladne aj zalohove platby.
 */
export function generateTravelAccountingEntries(
  travelOrder: TravelOrderData,
  settlement: TravelSettlementData,
  paymentMethod: "cash" | "bank"
): TravelAccountingEntry[] {
  const entries: TravelAccountingEntry[] = []
  const currency = settlement.currency || "EUR"

  // 1. Zauctovanie celkovych cestovnych nahrad: 512/335
  if (settlement.total_expenses > 0) {
    entries.push({
      debit_account: "512",
      credit_account: "335",
      amount: settlement.total_expenses,
      description: `Cestovne nahrady - ${travelOrder.destination} (${travelOrder.employee_name})`,
      currency,
    })
  }

  // 2. Ak bola vyplatena zaloha - uz bola zauctovana pri vyplateni
  // Tu uctujeme len vyrovnanie

  if (settlement.advance_amount > 0) {
    if (settlement.difference > 0) {
      // Zamestnavatel doplaca - zamestnancovi sa vyplaca doplatok
      const creditAccount = paymentMethod === "cash" ? "211" : "221"
      entries.push({
        debit_account: "335",
        credit_account: creditAccount,
        amount: settlement.difference,
        description: `Doplatok cestovnych nahrad - ${travelOrder.destination} (${travelOrder.employee_name})`,
        currency,
      })

      // Vyrovnanie zalohy
      entries.push({
        debit_account: "335",
        credit_account: "335",
        amount: settlement.advance_amount,
        description: `Zuctovanie zalohy na cestovne nahrady - ${travelOrder.destination}`,
        currency,
      })
    } else if (settlement.difference < 0) {
      // Zamestnanec vracia preplatenie
      const debitAccount = paymentMethod === "cash" ? "211" : "221"
      entries.push({
        debit_account: debitAccount,
        credit_account: "335",
        amount: Math.abs(settlement.difference),
        description: `Vratenie preplatku cestovnych nahrad - ${travelOrder.destination} (${travelOrder.employee_name})`,
        currency,
      })

      // Vyrovnanie zalohy
      entries.push({
        debit_account: "335",
        credit_account: "335",
        amount: settlement.advance_amount,
        description: `Zuctovanie zalohy na cestovne nahrady - ${travelOrder.destination}`,
        currency,
      })
    } else {
      // Presne vyrovnanie - zaloha = naklady
      entries.push({
        debit_account: "335",
        credit_account: "335",
        amount: settlement.advance_amount,
        description: `Zuctovanie zalohy na cestovne nahrady - ${travelOrder.destination}`,
        currency,
      })
    }
  } else {
    // Bez zalohy - priama uhrada celej sumy
    const creditAccount = paymentMethod === "cash" ? "211" : "221"
    entries.push({
      debit_account: "335",
      credit_account: creditAccount,
      amount: settlement.total_expenses,
      description: `Uhrada cestovnych nahrad - ${travelOrder.destination} (${travelOrder.employee_name})`,
      currency,
    })
  }

  // 3. Kurzove rozdiely pri zahranicnych cestach
  if (
    travelOrder.is_foreign &&
    settlement.foreign_currency &&
    settlement.exchange_rate &&
    settlement.foreign_amount
  ) {
    const eurAmount = settlement.foreign_amount * settlement.exchange_rate
    const diff = eurAmount - settlement.total_expenses

    if (Math.abs(diff) > 0.01) {
      if (diff > 0) {
        // Kurzova strata
        entries.push({
          debit_account: "563",
          credit_account: "335",
          amount: Math.round(diff * 100) / 100,
          description: `Kurzova strata - cestovny prikaz ${travelOrder.destination}`,
          currency: "EUR",
        })
      } else {
        // Kurzovy zisk
        entries.push({
          debit_account: "335",
          credit_account: "663",
          amount: Math.round(Math.abs(diff) * 100) / 100,
          description: `Kurzovy zisk - cestovny prikaz ${travelOrder.destination}`,
          currency: "EUR",
        })
      }
    }
  }

  return entries
}

/**
 * Generuje uctovne zapisy pre vyplatenie zalohy na sluzobnu cestu.
 */
export function generateAdvanceEntries(
  amount: number,
  paymentMethod: "cash" | "bank"
): TravelAccountingEntry[] {
  if (amount <= 0) return []

  const creditAccount = paymentMethod === "cash" ? "211" : "221"
  const paymentLabel =
    paymentMethod === "cash" ? "Pokladna" : "Bankovy ucet"

  return [
    {
      debit_account: "335",
      credit_account: creditAccount,
      amount,
      description: `Zaloha na sluzobnu cestu - vyplatena z: ${paymentLabel}`,
      currency: "EUR",
    },
  ]
}

/**
 * Generuje uctovne zapisy pre vyuctovanie cestovnych nahrad.
 * Obsahuje zauctovanie nakladov aj vyrovnanie so zalohou.
 */
export function generateSettlementEntries(
  settlement: TravelSettlementData,
  advanceAmount: number,
  paymentMethod: "cash" | "bank"
): TravelAccountingEntry[] {
  const entries: TravelAccountingEntry[] = []
  const currency = settlement.currency || "EUR"

  // Zauctovanie cestovnych nakladov
  if (settlement.meal_allowance > 0) {
    entries.push({
      debit_account: "512",
      credit_account: "335",
      amount: settlement.meal_allowance,
      description: "Stravne - cestovne nahrady",
      currency,
    })
  }

  if (settlement.transport_cost > 0) {
    entries.push({
      debit_account: "512",
      credit_account: "335",
      amount: settlement.transport_cost,
      description: "Cestovne - doprava",
      currency,
    })
  }

  if (settlement.accommodation_cost > 0) {
    entries.push({
      debit_account: "512",
      credit_account: "335",
      amount: settlement.accommodation_cost,
      description: "Ubytovanie - cestovne nahrady",
      currency,
    })
  }

  if (settlement.other_costs > 0) {
    entries.push({
      debit_account: "512",
      credit_account: "335",
      amount: settlement.other_costs,
      description: "Vedlajsie vydavky - cestovne nahrady",
      currency,
    })
  }

  // Vyrovnanie zalohy
  const totalExpenses = settlement.total_expenses
  const difference = totalExpenses - advanceAmount

  if (advanceAmount > 0) {
    if (difference > 0) {
      // Zamestnavatel doplaca
      const creditAccount = paymentMethod === "cash" ? "211" : "221"
      entries.push({
        debit_account: "335",
        credit_account: creditAccount,
        amount: difference,
        description: "Doplatok cestovnych nahrad zamestnancovi",
        currency,
      })
    } else if (difference < 0) {
      // Zamestnanec vracia
      const debitAccount = paymentMethod === "cash" ? "211" : "221"
      entries.push({
        debit_account: debitAccount,
        credit_account: "335",
        amount: Math.abs(difference),
        description: "Vratenie preplatku cestovnych nahrad zamestnancom",
        currency,
      })
    }

    // Zuctovanie zalohy
    entries.push({
      debit_account: "335",
      credit_account: "335",
      amount: advanceAmount,
      description: "Zuctovanie zalohy na sluzobnu cestu",
      currency,
    })
  } else {
    // Bez zalohy - priama uhrada
    const creditAccount = paymentMethod === "cash" ? "211" : "221"
    entries.push({
      debit_account: "335",
      credit_account: creditAccount,
      amount: totalExpenses,
      description: "Uhrada cestovnych nahrad (bez zalohy)",
      currency,
    })
  }

  return entries
}
