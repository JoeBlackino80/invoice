// =====================================================================
// Cestovne prikazy – kalkulacna kniznica
// Podla Opatrenia MPSVR SR (tuzemske) a Opatrenia MF SR (zahranicne)
// =====================================================================

// ---------- Interfaces ----------

export interface MealReduction {
  breakfast: boolean
  lunch: boolean
  dinner: boolean
}

export interface VehicleCompensation {
  distance_km: number
  rate_per_km: number
  consumption_per_100km: number
  fuel_price_per_liter: number
  km_compensation: number
  fuel_compensation: number
  total: number
}

export interface TravelExpense {
  id?: string
  travel_order_id: string
  expense_type:
    | "stravne"
    | "ubytovanie"
    | "cestovne"
    | "parkovne"
    | "dialnicna_znamka"
    | "mhd"
    | "poistenie"
    | "ine"
  amount: number
  currency: string
  description?: string
  receipt_url?: string
}

export interface TravelOrder {
  id?: string
  company_id: string
  employee_id: string
  type: "tuzemsky" | "zahranicny"
  purpose: string
  destination: string
  country?: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  transport_type:
    | "vlastne_auto"
    | "sluzbne_auto"
    | "vlak"
    | "autobus"
    | "lietadlo"
    | "iny"
  vehicle_plate?: string
  vehicle_consumption?: number
  distance_km?: number
  fuel_price?: number
  advance_amount?: number
  advance_currency: string
  status: "draft" | "approved" | "completed" | "settled"
  expenses?: TravelExpense[]
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface DomesticCalculation {
  trip_hours: number
  meal_allowance: number
  meal_reduction_amount: number
  net_meal_allowance: number
  vehicle_compensation: VehicleCompensation | null
  accommodation: number
  other_expenses: number
  total: number
}

export interface ForeignCalculation {
  trip_hours: number
  country: string
  per_diem_rate: number
  per_diem_currency: string
  per_diem_days: number
  per_diem_total: number
  pocket_money_percent: number
  pocket_money: number
  meal_reduction_amount: number
  net_per_diem: number
  vehicle_compensation: VehicleCompensation | null
  accommodation: number
  other_expenses: number
  total_foreign_currency: number
  exchange_rate: number
  total_eur: number
}

export interface DomesticTravelInput {
  departure: Date
  arrival: Date
  free_meals: MealReduction
  vehicle?: {
    distance_km: number
    consumption_per_100km: number
    fuel_price_per_liter: number
  }
  accommodation: number
  other_expenses: number
}

export interface ForeignTravelInput {
  departure: Date
  arrival: Date
  country: string
  free_meals: MealReduction
  pocket_money_percent: number // 0-40
  vehicle?: {
    distance_km: number
    consumption_per_100km: number
    fuel_price_per_liter: number
  }
  accommodation: number
  other_expenses: number
  exchange_rate: number
}

// ---------- Constants ----------

/** Sadzby stravneho pre tuzemske cesty (Opatrenie MPSVR SR 2025) */
export const DOMESTIC_MEAL_RATES = {
  /** 5 az 12 hodin */
  tier1: { min_hours: 5, max_hours: 12, rate: 7.8 },
  /** 12 az 18 hodin */
  tier2: { min_hours: 12, max_hours: 18, rate: 11.6 },
  /** Nad 18 hodin */
  tier3: { min_hours: 18, max_hours: Infinity, rate: 17.4 },
} as const

/** Percenta znizenia stravneho pri poskytnutom bezplatnom jedle */
export const MEAL_REDUCTION_PERCENTAGES = {
  breakfast: 0.25,
  lunch: 0.4,
  dinner: 0.35,
} as const

/** Sadzba za pouzitie sukromneho motoroveho vozidla (EUR/km) */
export const VEHICLE_RATE_PER_KM = 0.239

/** Zahranicne diéty – per diem sadzby podla Opatrenia MF SR */
export const FOREIGN_PER_DIEM_RATES: Record<
  string,
  { country_sk: string; rate: number; currency: string }
> = {
  CZ: { country_sk: "Cesko", rate: 35, currency: "EUR" },
  AT: { country_sk: "Rakusko", rate: 45, currency: "EUR" },
  DE: { country_sk: "Nemecko", rate: 45, currency: "EUR" },
  HU: { country_sk: "Madarsko", rate: 35, currency: "EUR" },
  PL: { country_sk: "Polsko", rate: 35, currency: "EUR" },
  GB: { country_sk: "Velka Britania", rate: 45, currency: "GBP" },
  US: { country_sk: "USA", rate: 50, currency: "USD" },
  FR: { country_sk: "Francuzsko", rate: 45, currency: "EUR" },
  IT: { country_sk: "Taliansko", rate: 45, currency: "EUR" },
  ES: { country_sk: "Spanielsko", rate: 40, currency: "EUR" },
  NL: { country_sk: "Holandsko", rate: 45, currency: "EUR" },
  BE: { country_sk: "Belgicko", rate: 45, currency: "EUR" },
  CH: { country_sk: "Svajciarsko", rate: 70, currency: "CHF" },
  UA: { country_sk: "Ukrajina", rate: 35, currency: "EUR" },
  RO: { country_sk: "Rumunsko", rate: 35, currency: "EUR" },
  BG: { country_sk: "Bulharsko", rate: 35, currency: "EUR" },
  HR: { country_sk: "Chorvatsko", rate: 35, currency: "EUR" },
  SI: { country_sk: "Slovinsko", rate: 35, currency: "EUR" },
  RS: { country_sk: "Srbsko", rate: 35, currency: "EUR" },
  DK: { country_sk: "Dansko", rate: 50, currency: "EUR" },
  SE: { country_sk: "Svedsko", rate: 45, currency: "EUR" },
  NO: { country_sk: "Norsko", rate: 50, currency: "EUR" },
  FI: { country_sk: "Finsko", rate: 45, currency: "EUR" },
  PT: { country_sk: "Portugalsko", rate: 40, currency: "EUR" },
  IE: { country_sk: "Irsko", rate: 45, currency: "EUR" },
  GR: { country_sk: "Grecko", rate: 40, currency: "EUR" },
  TR: { country_sk: "Turecko", rate: 35, currency: "EUR" },
  CN: { country_sk: "Cina", rate: 45, currency: "USD" },
  JP: { country_sk: "Japonsko", rate: 60, currency: "USD" },
  KR: { country_sk: "Juzna Korea", rate: 50, currency: "USD" },
  AU: { country_sk: "Australia", rate: 50, currency: "AUD" },
  CA: { country_sk: "Kanada", rate: 45, currency: "CAD" },
  RU: { country_sk: "Rusko", rate: 35, currency: "EUR" },
}

// ---------- Helper functions ----------

/**
 * Vypocita pocet hodin medzi dvoma datumami
 */
export function calculateTripHours(departure: Date, arrival: Date): number {
  const diffMs = arrival.getTime() - departure.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60))
}

/**
 * Vypocita pocet dní pre zahranicne cesty (zaokruhlene nahor)
 */
function calculatePerDiemDays(hours: number): number {
  if (hours <= 0) return 0
  if (hours <= 12) return 0.5
  return Math.ceil(hours / 24)
}

/**
 * Vypocita narok na stravne na zaklade poctu hodin a poskytnutych jedal
 */
export function calculateMealAllowance(
  hours: number,
  freeBreakfast: boolean,
  freeLunch: boolean,
  freeDinner: boolean,
  isAbroad: boolean,
  country?: string
): { gross: number; reduction: number; net: number; currency: string } {
  if (isAbroad && country) {
    const countryData = FOREIGN_PER_DIEM_RATES[country]
    if (!countryData) {
      return { gross: 0, reduction: 0, net: 0, currency: "EUR" }
    }
    const days = calculatePerDiemDays(hours)
    const gross = days * countryData.rate

    let reductionPercent = 0
    if (freeBreakfast) reductionPercent += MEAL_REDUCTION_PERCENTAGES.breakfast
    if (freeLunch) reductionPercent += MEAL_REDUCTION_PERCENTAGES.lunch
    if (freeDinner) reductionPercent += MEAL_REDUCTION_PERCENTAGES.dinner

    const reduction = round2(gross * reductionPercent)
    const net = round2(gross - reduction)

    return { gross, reduction, net, currency: countryData.currency }
  }

  // Tuzemske stravne
  let rate = 0
  if (hours >= DOMESTIC_MEAL_RATES.tier3.min_hours) {
    rate = DOMESTIC_MEAL_RATES.tier3.rate
  } else if (hours >= DOMESTIC_MEAL_RATES.tier2.min_hours) {
    rate = DOMESTIC_MEAL_RATES.tier2.rate
  } else if (hours >= DOMESTIC_MEAL_RATES.tier1.min_hours) {
    rate = DOMESTIC_MEAL_RATES.tier1.rate
  }

  // Pre viacdnove tuzemske cesty – nasobit poctom dni
  const fullDays = Math.floor(hours / 24)
  const remainingHours = hours - fullDays * 24
  let gross = fullDays * DOMESTIC_MEAL_RATES.tier3.rate

  if (remainingHours >= DOMESTIC_MEAL_RATES.tier3.min_hours) {
    gross += DOMESTIC_MEAL_RATES.tier3.rate
  } else if (remainingHours >= DOMESTIC_MEAL_RATES.tier2.min_hours) {
    gross += DOMESTIC_MEAL_RATES.tier2.rate
  } else if (remainingHours >= DOMESTIC_MEAL_RATES.tier1.min_hours) {
    gross += DOMESTIC_MEAL_RATES.tier1.rate
  }

  // Ak je jednodenovy, pouzijeme jednoduchy rate
  if (fullDays === 0) {
    gross = rate
  }

  let reductionPercent = 0
  if (freeBreakfast) reductionPercent += MEAL_REDUCTION_PERCENTAGES.breakfast
  if (freeLunch) reductionPercent += MEAL_REDUCTION_PERCENTAGES.lunch
  if (freeDinner) reductionPercent += MEAL_REDUCTION_PERCENTAGES.dinner

  const reduction = round2(gross * reductionPercent)
  const net = round2(gross - reduction)

  return { gross, reduction, net, currency: "EUR" }
}

/**
 * Vypocita nahradu za pouzitie sukromneho motoroveho vozidla
 * Vzorec: (sadzba_km * vzdialenost) + (spotreba/100 * vzdialenost * cena_paliva)
 */
export function calculateVehicleCompensation(
  distance_km: number,
  consumption_per_100km: number,
  fuel_price_per_liter: number
): VehicleCompensation {
  const km_compensation = round2(VEHICLE_RATE_PER_KM * distance_km)
  const fuel_compensation = round2(
    (consumption_per_100km / 100) * distance_km * fuel_price_per_liter
  )
  const total = round2(km_compensation + fuel_compensation)

  return {
    distance_km,
    rate_per_km: VEHICLE_RATE_PER_KM,
    consumption_per_100km,
    fuel_price_per_liter,
    km_compensation,
    fuel_compensation,
    total,
  }
}

/**
 * Zaokruhlenie na 2 desatinne miesta
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------- Main calculation functions ----------

/**
 * Kalkulacia tuzemskej pracovnej cesty
 */
export function calculateDomesticTravel(
  input: DomesticTravelInput
): DomesticCalculation {
  const tripHours = calculateTripHours(input.departure, input.arrival)

  const meal = calculateMealAllowance(
    tripHours,
    input.free_meals.breakfast,
    input.free_meals.lunch,
    input.free_meals.dinner,
    false
  )

  let vehicleComp: VehicleCompensation | null = null
  if (input.vehicle) {
    vehicleComp = calculateVehicleCompensation(
      input.vehicle.distance_km,
      input.vehicle.consumption_per_100km,
      input.vehicle.fuel_price_per_liter
    )
  }

  const total = round2(
    meal.net +
      (vehicleComp?.total ?? 0) +
      input.accommodation +
      input.other_expenses
  )

  return {
    trip_hours: round2(tripHours),
    meal_allowance: meal.gross,
    meal_reduction_amount: meal.reduction,
    net_meal_allowance: meal.net,
    vehicle_compensation: vehicleComp,
    accommodation: input.accommodation,
    other_expenses: input.other_expenses,
    total,
  }
}

/**
 * Kalkulacia zahranicnej pracovnej cesty
 */
export function calculateForeignTravel(
  input: ForeignTravelInput
): ForeignCalculation {
  const tripHours = calculateTripHours(input.departure, input.arrival)
  const countryData = FOREIGN_PER_DIEM_RATES[input.country]

  if (!countryData) {
    return {
      trip_hours: round2(tripHours),
      country: input.country,
      per_diem_rate: 0,
      per_diem_currency: "EUR",
      per_diem_days: 0,
      per_diem_total: 0,
      pocket_money_percent: 0,
      pocket_money: 0,
      meal_reduction_amount: 0,
      net_per_diem: 0,
      vehicle_compensation: null,
      accommodation: input.accommodation,
      other_expenses: input.other_expenses,
      total_foreign_currency: 0,
      exchange_rate: input.exchange_rate,
      total_eur: round2(input.accommodation + input.other_expenses),
    }
  }

  const days = calculatePerDiemDays(tripHours)
  const perDiemTotal = round2(days * countryData.rate)

  // Vreckove – max 40% z diet
  const pocketPercent = Math.min(40, Math.max(0, input.pocket_money_percent))
  const pocketMoney = round2(perDiemTotal * (pocketPercent / 100))

  // Znizenie stravneho
  let reductionPercent = 0
  if (input.free_meals.breakfast)
    reductionPercent += MEAL_REDUCTION_PERCENTAGES.breakfast
  if (input.free_meals.lunch)
    reductionPercent += MEAL_REDUCTION_PERCENTAGES.lunch
  if (input.free_meals.dinner)
    reductionPercent += MEAL_REDUCTION_PERCENTAGES.dinner

  const mealReduction = round2(perDiemTotal * reductionPercent)
  const netPerDiem = round2(perDiemTotal - mealReduction)

  let vehicleComp: VehicleCompensation | null = null
  if (input.vehicle) {
    vehicleComp = calculateVehicleCompensation(
      input.vehicle.distance_km,
      input.vehicle.consumption_per_100km,
      input.vehicle.fuel_price_per_liter
    )
  }

  const totalForeignCurrency = round2(
    netPerDiem + pocketMoney + input.accommodation + input.other_expenses
  )

  // Prepocet na EUR
  const exchangeRate = input.exchange_rate > 0 ? input.exchange_rate : 1
  const vehicleTotal = vehicleComp?.total ?? 0
  const totalEur = round2(
    totalForeignCurrency *
      (countryData.currency === "EUR" ? 1 : exchangeRate) +
      vehicleTotal
  )

  return {
    trip_hours: round2(tripHours),
    country: input.country,
    per_diem_rate: countryData.rate,
    per_diem_currency: countryData.currency,
    per_diem_days: days,
    per_diem_total: perDiemTotal,
    pocket_money_percent: pocketPercent,
    pocket_money: pocketMoney,
    meal_reduction_amount: mealReduction,
    net_per_diem: netPerDiem,
    vehicle_compensation: vehicleComp,
    accommodation: input.accommodation,
    other_expenses: input.other_expenses,
    total_foreign_currency: totalForeignCurrency,
    exchange_rate: exchangeRate,
    total_eur: totalEur,
  }
}
