/**
 * Generovanie strukturovanych dat pre cestovny prikaz a vyuctovanie.
 * Sluzi na zobrazenie / tlac dokumentov cestovnych nahrad.
 */

// ---- Typy ----

export interface CompanyInfo {
  name: string
  ico: string
  dic?: string
  street?: string
  city?: string
  zip?: string
}

export interface EmployeeInfo {
  name: string
  position?: string
  department?: string
  employee_id?: string
}

export interface TripDetails {
  destination: string
  purpose: string
  date_from: string
  date_to: string
  departure_time?: string
  arrival_time?: string
  transport_type: string
  vehicle_registration?: string
  is_foreign: boolean
  country?: string
}

export interface EstimatedCosts {
  meal_allowance: number
  transport: number
  accommodation: number
  other: number
  total: number
}

export interface MealAllowanceDay {
  date: string
  hours: number
  base_rate: number
  breakfast_free: boolean
  lunch_free: boolean
  dinner_free: boolean
  reduction_percent: number
  reduction_amount: number
  final_amount: number
}

export interface VehicleCompensation {
  km_driven: number
  rate_per_km: number
  fuel_consumption: number
  fuel_price: number
  fuel_cost: number
  wear_compensation: number
  total: number
}

export interface ExpenseBreakdown {
  meal_allowance_days: MealAllowanceDay[]
  meal_allowance_total: number
  transport_total: number
  vehicle_compensation?: VehicleCompensation
  accommodation_total: number
  accommodation_receipts: Array<{ description: string; amount: number }>
  other_expenses: Array<{ description: string; amount: number }>
  other_total: number
  total_expenses: number
}

export interface AdvanceReconciliation {
  advance_amount: number
  total_expenses: number
  difference: number // positive = employer pays, negative = employee returns
  settlement_type: "doplatok" | "vratenie" | "vyrovnane"
  settlement_label: string
}

// ---- Dokument: Cestovny prikaz (pred cestou) ----

export interface TravelOrderDocument {
  document_title: string
  document_number?: string
  company: CompanyInfo
  employee: EmployeeInfo
  trip: TripDetails
  estimated_costs: EstimatedCosts
  advance_amount: number
  advance_payment_method?: string
  approval_date?: string
  approved_by?: string
  notes?: string
  created_at: string
}

// ---- Dokument: Vyuctovanie cestovnych nahrad (po ceste) ----

export interface TravelSettlementDocument {
  document_title: string
  document_number?: string
  travel_order_number?: string
  company: CompanyInfo
  employee: EmployeeInfo
  trip: TripDetails
  expenses: ExpenseBreakdown
  reconciliation: AdvanceReconciliation
  settlement_date: string
  payment_method: string
  notes?: string
  created_at: string
}

// ---- Generatory ----

export function generateTravelOrderDocument(
  order: {
    id: string
    number?: string
    destination: string
    purpose: string
    date_from: string
    date_to: string
    departure_time?: string
    arrival_time?: string
    transport_type: string
    vehicle_registration?: string
    is_foreign: boolean
    country?: string
    estimated_meals: number
    estimated_transport: number
    estimated_accommodation: number
    estimated_other: number
    advance_amount: number
    advance_payment_method?: string
    notes?: string
    approved_by?: string
    approval_date?: string
    created_at: string
  },
  employee: EmployeeInfo,
  company: CompanyInfo
): TravelOrderDocument {
  const estimatedTotal =
    order.estimated_meals +
    order.estimated_transport +
    order.estimated_accommodation +
    order.estimated_other

  return {
    document_title: "Cestovny prikaz",
    document_number: order.number,
    company,
    employee,
    trip: {
      destination: order.destination,
      purpose: order.purpose,
      date_from: order.date_from,
      date_to: order.date_to,
      departure_time: order.departure_time,
      arrival_time: order.arrival_time,
      transport_type: order.transport_type,
      vehicle_registration: order.vehicle_registration,
      is_foreign: order.is_foreign,
      country: order.country,
    },
    estimated_costs: {
      meal_allowance: order.estimated_meals,
      transport: order.estimated_transport,
      accommodation: order.estimated_accommodation,
      other: order.estimated_other,
      total: estimatedTotal,
    },
    advance_amount: order.advance_amount,
    advance_payment_method: order.advance_payment_method,
    approval_date: order.approval_date,
    approved_by: order.approved_by,
    notes: order.notes,
    created_at: order.created_at,
  }
}

export function generateSettlementDocument(
  order: {
    id: string
    number?: string
    destination: string
    purpose: string
    date_from: string
    date_to: string
    departure_time?: string
    arrival_time?: string
    transport_type: string
    vehicle_registration?: string
    is_foreign: boolean
    country?: string
    advance_amount: number
    created_at: string
  },
  settlement: {
    id: string
    meal_allowance: number
    transport_cost: number
    accommodation_cost: number
    other_costs: number
    total_expenses: number
    payment_method: string
    settlement_date: string
    notes?: string
  },
  expenses: {
    meal_days: MealAllowanceDay[]
    vehicle_compensation?: VehicleCompensation
    accommodation_receipts: Array<{ description: string; amount: number }>
    other_expenses: Array<{ description: string; amount: number }>
  },
  employee: EmployeeInfo,
  company: CompanyInfo
): TravelSettlementDocument {
  const difference = settlement.total_expenses - order.advance_amount
  let settlementType: "doplatok" | "vratenie" | "vyrovnane"
  let settlementLabel: string

  if (difference > 0.005) {
    settlementType = "doplatok"
    settlementLabel = `Doplatok zamestnancovi: ${formatEur(difference)}`
  } else if (difference < -0.005) {
    settlementType = "vratenie"
    settlementLabel = `Zamestnanec vracia: ${formatEur(Math.abs(difference))}`
  } else {
    settlementType = "vyrovnane"
    settlementLabel = "Zaloha a naklady su vyrovnane"
  }

  return {
    document_title: "Vyuctovanie cestovnych nahrad",
    document_number: order.number ? `V-${order.number}` : undefined,
    travel_order_number: order.number,
    company,
    employee,
    trip: {
      destination: order.destination,
      purpose: order.purpose,
      date_from: order.date_from,
      date_to: order.date_to,
      departure_time: order.departure_time,
      arrival_time: order.arrival_time,
      transport_type: order.transport_type,
      vehicle_registration: order.vehicle_registration,
      is_foreign: order.is_foreign,
      country: order.country,
    },
    expenses: {
      meal_allowance_days: expenses.meal_days,
      meal_allowance_total: settlement.meal_allowance,
      transport_total: settlement.transport_cost,
      vehicle_compensation: expenses.vehicle_compensation,
      accommodation_total: settlement.accommodation_cost,
      accommodation_receipts: expenses.accommodation_receipts,
      other_expenses: expenses.other_expenses,
      other_total: settlement.other_costs,
      total_expenses: settlement.total_expenses,
    },
    reconciliation: {
      advance_amount: order.advance_amount,
      total_expenses: settlement.total_expenses,
      difference,
      settlement_type: settlementType,
      settlement_label: settlementLabel,
    },
    settlement_date: settlement.settlement_date,
    payment_method: settlement.payment_method,
    notes: settlement.notes,
    created_at: new Date().toISOString(),
  }
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}
