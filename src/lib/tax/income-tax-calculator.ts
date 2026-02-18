/**
 * Income Tax Calculator for Slovak Republic
 *
 * DPPO - Dan z prijmov pravnickych osob (Corporate Income Tax)
 * DPFO - Dan z prijmov fyzickych osob (Personal Income Tax) - typ B
 *
 * Based on Slovak tax legislation (Zakon c. 595/2003 Z.z.)
 */

// ===================== DPPO (Corporate Income Tax) =====================

export interface DPPOAdjustments {
  non_deductible_expenses: number   // nedanove naklady (513, 543, 545, 549...)
  excess_depreciation: number       // nadmerne odpisy
  unpaid_liabilities: number        // neuhradene zavazky >360 dni
  tax_exempt_income: number         // oslobodene prijmy
  tax_loss_deduction: number        // odpocet danovej straty (max 50% zakladu, max 5 rokov)
  prepayments_paid: number          // zaplatene preddavky
}

export interface DPPOData {
  // Vysledok hospodarenia (accounting profit/loss)
  accounting_profit: number       // vynosy - naklady z uctovnictva
  total_revenues: number          // class 6 accounts
  total_expenses: number          // class 5 accounts

  // Pripocitatelne polozky (positive adjustments)
  non_deductible_expenses: number   // nedanove naklady
  excess_depreciation: number       // nadmerne odpisy
  unpaid_liabilities: number        // neuhradene zavazky >360 dni

  // Odpocitatelne polozky (negative adjustments)
  tax_exempt_income: number

  // Zaklad dane
  tax_base: number
  tax_loss_deduction: number  // max 50% of base, max 5 years
  adjusted_tax_base: number

  // Dan
  tax_rate: number              // 21% or 15% for micro (turnover <= 60000)
  tax_amount: number
  prepayments_paid: number      // zaplatene preddavky
  tax_to_pay: number            // doplatok / preplatok
}

export interface CompanyInfo {
  business_type: string
  size_category: string
  is_vat_payer: boolean
  turnover?: number             // obrat za zdanovacie obdobie
}

interface AccountSums {
  account_number: string
  total_debit: number
  total_credit: number
}

/**
 * Non-deductible expense account prefixes (SU).
 * These accounts are commonly used for expenses that are not tax-deductible.
 */
const NON_DEDUCTIBLE_ACCOUNTS = [
  "513",   // Naklady na reprezentaciu
  "543",   // Dary
  "545",   // Ostatne pokuty, penale a uroky z omeSkania
  "546",   // Odpis pohladavky (ciastocne)
  "549",   // Manka a skody z prevadzkovej cinnosti
  "554",   // Tvorba a zuctovanie ostatnych opravnych poloziek (ciastocne)
  "559",   // Tvorba a zuctovanie opravnych poloziek (ciastocne)
]

/**
 * Calculate DPPO (Corporate Income Tax).
 *
 * @param revenues - Array of class 6 account sums (revenues)
 * @param expenses - Array of class 5 account sums (expenses)
 * @param adjustments - Tax adjustments provided by the user
 * @param companyInfo - Company details for determining tax rate
 */
export function calculateDPPO(
  revenues: AccountSums[],
  expenses: AccountSums[],
  adjustments: DPPOAdjustments,
  companyInfo: CompanyInfo
): DPPOData {
  // Sum all revenues (class 6 - credit side represents revenues)
  const total_revenues = revenues.reduce((sum, acc) => {
    return sum + (acc.total_credit - acc.total_debit)
  }, 0)

  // Sum all expenses (class 5 - debit side represents expenses)
  const total_expenses = expenses.reduce((sum, acc) => {
    return sum + (acc.total_debit - acc.total_credit)
  }, 0)

  // Accounting profit = revenues - expenses
  const accounting_profit = total_revenues - total_expenses

  // Positive adjustments (pripocitatelne polozky)
  const non_deductible_expenses = Math.max(0, adjustments.non_deductible_expenses)
  const excess_depreciation = Math.max(0, adjustments.excess_depreciation)
  const unpaid_liabilities = Math.max(0, adjustments.unpaid_liabilities)

  const total_additions = non_deductible_expenses + excess_depreciation + unpaid_liabilities

  // Negative adjustments (odpocitatelne polozky)
  const tax_exempt_income = Math.max(0, adjustments.tax_exempt_income)

  // Tax base before loss deduction
  const tax_base_raw = accounting_profit + total_additions - tax_exempt_income
  const tax_base = Math.max(0, tax_base_raw) // Cannot be negative for tax calculation

  // Tax loss deduction: max 50% of tax base, carried forward max 5 years
  const max_loss_deduction = tax_base * 0.5
  const tax_loss_deduction = Math.min(
    Math.max(0, adjustments.tax_loss_deduction),
    max_loss_deduction
  )

  const adjusted_tax_base = Math.max(0, tax_base - tax_loss_deduction)

  // Determine tax rate:
  // 15% if turnover <= 60,000 EUR (mikropodnikatel / small taxpayer)
  // 21% otherwise (standard rate)
  const turnover = companyInfo.turnover ?? total_revenues
  const tax_rate = turnover <= 60000 ? 15 : 21

  // Calculate tax
  const tax_amount = Math.round((adjusted_tax_base * tax_rate / 100) * 100) / 100

  // Prepayments
  const prepayments_paid = Math.max(0, adjustments.prepayments_paid)

  // Tax to pay (positive = doplatok, negative = preplatok)
  const tax_to_pay = Math.round((tax_amount - prepayments_paid) * 100) / 100

  return {
    accounting_profit: Math.round(accounting_profit * 100) / 100,
    total_revenues: Math.round(total_revenues * 100) / 100,
    total_expenses: Math.round(total_expenses * 100) / 100,
    non_deductible_expenses: Math.round(non_deductible_expenses * 100) / 100,
    excess_depreciation: Math.round(excess_depreciation * 100) / 100,
    unpaid_liabilities: Math.round(unpaid_liabilities * 100) / 100,
    tax_exempt_income: Math.round(tax_exempt_income * 100) / 100,
    tax_base: Math.round(tax_base * 100) / 100,
    tax_loss_deduction: Math.round(tax_loss_deduction * 100) / 100,
    adjusted_tax_base: Math.round(adjusted_tax_base * 100) / 100,
    tax_rate,
    tax_amount,
    prepayments_paid: Math.round(prepayments_paid * 100) / 100,
    tax_to_pay,
  }
}


// ===================== DPFO (Personal Income Tax - typ B) =====================

export interface DPFOInput {
  business_income: number          // prijmy z podnikania (par. 6)
  expense_type: "actual" | "flat_rate"   // skutocne alebo pausalne vydavky
  actual_expenses: number           // skutocne vydavky
  children_count: number            // pocet deti pre danovy bonus
  spouse_income: number             // prijem manzela/manzelky (pre nezdanitelnu cast)
  pension_insurance_paid: number    // zaplatene dobrovolne dochodkove poistenie
  prepayments_paid: number          // zaplatene preddavky na dan
  year: number                      // zdanovacie obdobie
}

export interface DPFOData {
  // Prijmy par. 6
  business_income: number

  // Vydavky
  expense_type: "actual" | "flat_rate"
  actual_expenses: number
  flat_rate_expenses: number    // 60%, max 20000
  expenses_used: number         // ktore sa pouzili

  // Zaklad dane
  partial_tax_base: number    // prijem - vydavky

  // Nezdanitelne casti
  personal_allowance: number       // na danovnika (cca 4922.82 EUR for 2025)
  spouse_allowance: number         // na manzela/manzelku
  pension_insurance: number        // max 180 EUR
  total_non_taxable: number

  tax_base: number
  tax_rate_19: number    // 19% up to threshold
  tax_rate_25: number    // 25% above threshold (if applicable)
  tax_amount: number

  // Danovy bonus na deti
  child_bonus: number
  employee_bonus: number

  final_tax: number
  prepayments_paid: number
  tax_to_pay: number
}

// Tax constants for 2025 (updated yearly)
// Zivotne minimum k 1.1.2025: 268.88 EUR/mesiac
const TAX_CONSTANTS: Record<number, {
  living_minimum_annual: number     // 21 * zivotne minimum
  personal_allowance: number        // nezdanitelna cast na danovnika
  personal_allowance_limit: number  // limit prijmu pre plnu nezdanitelnu cast (100x ZM)
  spouse_allowance_max: number      // max nezdanitelna cast na manzela
  pension_insurance_max: number     // max odpocet dochodkoveho poistenia
  flat_rate_percent: number         // % pausalnych vydavkov
  flat_rate_max: number             // max pausalne vydavky
  tax_threshold_19: number          // hranica pre 19% sadzbu (176.8x ZM)
  child_bonus_monthly: number       // mesacny danovy bonus na dieta
}> = {
  2024: {
    living_minimum_annual: 268.88 * 12,
    personal_allowance: 4922.82,
    personal_allowance_limit: 268.88 * 100,
    spouse_allowance_max: 4500.86,
    pension_insurance_max: 180,
    flat_rate_percent: 60,
    flat_rate_max: 20000,
    tax_threshold_19: 47537.98,
    child_bonus_monthly: 140,
  },
  2025: {
    living_minimum_annual: 273.99 * 12,
    personal_allowance: 5018.40,
    personal_allowance_limit: 273.99 * 100,
    spouse_allowance_max: 4580.44,
    pension_insurance_max: 180,
    flat_rate_percent: 60,
    flat_rate_max: 20000,
    tax_threshold_19: 48441.43,
    child_bonus_monthly: 140,
  },
  2026: {
    living_minimum_annual: 278.00 * 12,
    personal_allowance: 5092.38,
    personal_allowance_limit: 278.00 * 100,
    spouse_allowance_max: 4648.20,
    pension_insurance_max: 180,
    flat_rate_percent: 60,
    flat_rate_max: 20000,
    tax_threshold_19: 49124.80,
    child_bonus_monthly: 140,
  },
}

function getTaxConstants(year: number) {
  // Fall back to 2025 if year is not found
  return TAX_CONSTANTS[year] || TAX_CONSTANTS[2025]
}

/**
 * Calculate DPFO (Personal Income Tax typ B).
 */
export function calculateDPFO(input: DPFOInput): DPFOData {
  const constants = getTaxConstants(input.year)

  const business_income = Math.max(0, input.business_income)

  // Expenses calculation
  const flat_rate_expenses = Math.min(
    business_income * (constants.flat_rate_percent / 100),
    constants.flat_rate_max
  )
  const flat_rate_expenses_rounded = Math.round(flat_rate_expenses * 100) / 100

  const actual_expenses = Math.max(0, input.actual_expenses)

  const expense_type = input.expense_type
  const expenses_used = expense_type === "flat_rate" ? flat_rate_expenses_rounded : actual_expenses

  // Partial tax base (dielci zaklad dane par. 6)
  const partial_tax_base = Math.max(0, business_income - expenses_used)

  // Non-taxable parts (nezdanitelne casti zakladu dane)

  // 1. Personal allowance (na danovnika)
  let personal_allowance: number
  if (partial_tax_base <= constants.personal_allowance_limit) {
    personal_allowance = constants.personal_allowance
  } else {
    // Reduced: 44.2 * ZM - (zaklad_dane / 4)
    const zivotne_minimum_mesacne = constants.living_minimum_annual / 12
    personal_allowance = Math.max(0, 44.2 * zivotne_minimum_mesacne - partial_tax_base / 4)
  }
  personal_allowance = Math.round(personal_allowance * 100) / 100

  // 2. Spouse allowance (na manzela/manzelku)
  let spouse_allowance = 0
  if (input.spouse_income >= 0) {
    if (partial_tax_base <= constants.personal_allowance_limit) {
      spouse_allowance = Math.max(0, constants.spouse_allowance_max - input.spouse_income)
    } else {
      const zivotne_minimum_mesacne = constants.living_minimum_annual / 12
      const reduced = 44.2 * zivotne_minimum_mesacne - partial_tax_base / 4
      spouse_allowance = Math.max(0, reduced - input.spouse_income)
    }
  }
  spouse_allowance = Math.round(spouse_allowance * 100) / 100

  // 3. Pension insurance (dobrovolne dochodkove poistenie)
  const pension_insurance = Math.min(
    Math.max(0, input.pension_insurance_paid),
    constants.pension_insurance_max
  )

  const total_non_taxable = personal_allowance + spouse_allowance + pension_insurance

  // Tax base after non-taxable parts
  const tax_base = Math.max(0, partial_tax_base - total_non_taxable)

  // Tax calculation: 19% up to threshold, 25% above
  let tax_rate_19 = 0
  let tax_rate_25 = 0
  let tax_amount = 0

  if (tax_base <= constants.tax_threshold_19) {
    tax_rate_19 = tax_base
    tax_rate_25 = 0
    tax_amount = tax_base * 0.19
  } else {
    tax_rate_19 = constants.tax_threshold_19
    tax_rate_25 = tax_base - constants.tax_threshold_19
    tax_amount = constants.tax_threshold_19 * 0.19 + tax_rate_25 * 0.25
  }

  tax_amount = Math.round(tax_amount * 100) / 100

  // Child bonus (danovy bonus na deti)
  const children_count = Math.max(0, Math.floor(input.children_count))
  const child_bonus = children_count * constants.child_bonus_monthly * 12
  const child_bonus_rounded = Math.round(child_bonus * 100) / 100

  // Employee bonus (zamestnanecka premia) - not applicable for SZCO typically
  const employee_bonus = 0

  // Final tax
  const final_tax = Math.max(0, Math.round((tax_amount - child_bonus_rounded - employee_bonus) * 100) / 100)

  // Tax to pay
  const prepayments_paid = Math.max(0, input.prepayments_paid)
  const tax_to_pay = Math.round((final_tax - prepayments_paid) * 100) / 100

  return {
    business_income: Math.round(business_income * 100) / 100,
    expense_type,
    actual_expenses: Math.round(actual_expenses * 100) / 100,
    flat_rate_expenses: flat_rate_expenses_rounded,
    expenses_used: Math.round(expenses_used * 100) / 100,
    partial_tax_base: Math.round(partial_tax_base * 100) / 100,
    personal_allowance,
    spouse_allowance,
    pension_insurance: Math.round(pension_insurance * 100) / 100,
    total_non_taxable: Math.round(total_non_taxable * 100) / 100,
    tax_base: Math.round(tax_base * 100) / 100,
    tax_rate_19: Math.round(tax_rate_19 * 100) / 100,
    tax_rate_25: Math.round(tax_rate_25 * 100) / 100,
    tax_amount,
    child_bonus: child_bonus_rounded,
    employee_bonus,
    final_tax,
    prepayments_paid: Math.round(prepayments_paid * 100) / 100,
    tax_to_pay,
  }
}
