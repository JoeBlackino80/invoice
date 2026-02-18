/**
 * Danove odpisy - Slovak Tax Depreciation Calculator
 * Implementacia podla ZDP (Zakon o dani z prijmov) §27 a §28
 */

export interface DepreciationResult {
  year: number
  tax_depreciation: number      // danovy odpis za rok
  tax_accumulated: number       // kumulovany danovy odpis
  tax_net_value: number         // danova zostatcova hodnota
  accounting_depreciation: number
  accounting_accumulated: number
  accounting_net_value: number
  difference: number            // rozdiel danovy vs uctovny
}

export interface DepreciationSchedule {
  asset_name: string
  acquisition_cost: number
  depreciation_group: number
  useful_life: number
  method: "rovnomerne" | "zrychlene"
  years: DepreciationResult[]
  total_tax_depreciation: number
  total_accounting_depreciation: number
  is_fully_depreciated: boolean
}

export interface AssetInput {
  id?: string
  name: string
  acquisition_cost: number
  acquisition_date: string
  depreciation_group: number
  depreciation_method: "rovnomerne" | "zrychlene"
  useful_life_years?: number
  tax_residual_value?: number
  accounting_residual_value?: number
  status?: string
}

/**
 * Slovak depreciation groups per ZDP
 * Each group defines: useful_life in years, description
 */
export const DEPRECIATION_GROUPS: Record<number, { useful_life: number; description: string }> = {
  0: { useful_life: 2, description: "Osobne automobily > 48 000 EUR" },
  1: { useful_life: 4, description: "Stroje, pristroje, zariadenia, osobne automobily" },
  2: { useful_life: 6, description: "Nakladne automobily, nabytok, ucelove stroje" },
  3: { useful_life: 8, description: "Technologie, lode, telekomunikacne zariadenia" },
  4: { useful_life: 12, description: "Vyrobne budovy, polnohospodarske stavby" },
  5: { useful_life: 20, description: "Administrativne budovy, obchodne budovy" },
  6: { useful_life: 40, description: "Bytove domy, hotely, skoly" },
}

/**
 * Coefficients for accelerated depreciation (zrychlene odpisy) per ZDP §28
 * [coefficient_first_year, coefficient_subsequent_years]
 */
export const ACCELERATED_COEFFICIENTS: Record<number, [number, number]> = {
  0: [2, 3],
  1: [4, 5],
  2: [6, 7],
  3: [8, 9],
  4: [12, 13],
  5: [20, 21],
  6: [40, 41],
}

/**
 * Get useful life from depreciation group
 */
export function getUsefulLife(group: number): number {
  return DEPRECIATION_GROUPS[group]?.useful_life || 4
}

/**
 * Round to 2 decimal places
 */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Calculate straight-line depreciation (rovnomerne odpisy) - §27 ZDP
 *
 * First year: cost / useful_life
 * Subsequent years: cost / useful_life
 * All years have the same depreciation amount.
 */
export function calculateStraightLine(
  cost: number,
  group: number,
  startYear: number,
  currentYear: number
): DepreciationResult[] {
  const usefulLife = getUsefulLife(group)
  const results: DepreciationResult[] = []
  const annualDepreciation = roundMoney(cost / usefulLife)

  let taxAccumulated = 0
  let accountingAccumulated = 0

  for (let i = 0; i < usefulLife; i++) {
    const year = startYear + i
    if (year > currentYear) break

    // Last year adjustment to ensure total = cost exactly
    let taxDep: number
    if (i === usefulLife - 1) {
      taxDep = roundMoney(cost - taxAccumulated)
    } else {
      taxDep = annualDepreciation
    }

    // Accounting depreciation uses same straight-line for simplicity
    let accDep: number
    if (i === usefulLife - 1) {
      accDep = roundMoney(cost - accountingAccumulated)
    } else {
      accDep = annualDepreciation
    }

    taxAccumulated = roundMoney(taxAccumulated + taxDep)
    accountingAccumulated = roundMoney(accountingAccumulated + accDep)

    const taxNetValue = roundMoney(cost - taxAccumulated)
    const accountingNetValue = roundMoney(cost - accountingAccumulated)

    results.push({
      year,
      tax_depreciation: taxDep,
      tax_accumulated: taxAccumulated,
      tax_net_value: taxNetValue,
      accounting_depreciation: accDep,
      accounting_accumulated: accountingAccumulated,
      accounting_net_value: accountingNetValue,
      difference: roundMoney(taxDep - accDep),
    })
  }

  return results
}

/**
 * Calculate accelerated depreciation (zrychlene odpisy) - §28 ZDP
 *
 * First year: cost / coefficient_first_year
 * Subsequent years: (2 * remaining_value) / (coefficient_subsequent - years_already_depreciated)
 *
 * The coefficients are defined per group.
 */
export function calculateAccelerated(
  cost: number,
  group: number,
  startYear: number,
  currentYear: number
): DepreciationResult[] {
  const usefulLife = getUsefulLife(group)
  const [coeffFirst, coeffSubsequent] = ACCELERATED_COEFFICIENTS[group] || [4, 5]
  const results: DepreciationResult[] = []

  let taxAccumulated = 0
  let accountingAccumulated = 0

  // For accounting, use straight-line
  const annualAccountingDep = roundMoney(cost / usefulLife)

  for (let i = 0; i < usefulLife; i++) {
    const year = startYear + i
    if (year > currentYear) break

    let taxDep: number
    const remainingTaxValue = roundMoney(cost - taxAccumulated)

    if (i === 0) {
      // First year: cost / coefficient_first_year
      taxDep = roundMoney(cost / coeffFirst)
    } else {
      // Subsequent years: (2 * remaining_value) / (coefficient_subsequent - years_already_depreciated)
      const denominator = coeffSubsequent - i
      if (denominator <= 0) {
        taxDep = remainingTaxValue
      } else {
        taxDep = roundMoney((2 * remainingTaxValue) / denominator)
      }
    }

    // Ensure we don't over-depreciate
    if (taxDep > remainingTaxValue) {
      taxDep = remainingTaxValue
    }

    // Last year adjustment
    if (i === usefulLife - 1) {
      taxDep = remainingTaxValue
    }

    // Accounting straight-line
    let accDep: number
    if (i === usefulLife - 1) {
      accDep = roundMoney(cost - accountingAccumulated)
    } else {
      accDep = annualAccountingDep
    }

    taxAccumulated = roundMoney(taxAccumulated + taxDep)
    accountingAccumulated = roundMoney(accountingAccumulated + accDep)

    const taxNetValue = roundMoney(cost - taxAccumulated)
    const accountingNetValue = roundMoney(cost - accountingAccumulated)

    results.push({
      year,
      tax_depreciation: taxDep,
      tax_accumulated: taxAccumulated,
      tax_net_value: taxNetValue,
      accounting_depreciation: accDep,
      accounting_accumulated: accountingAccumulated,
      accounting_net_value: accountingNetValue,
      difference: roundMoney(taxDep - accDep),
    })
  }

  return results
}

/**
 * Calculate full depreciation schedule for a single asset
 */
export function calculateDepreciationSchedule(
  asset: AssetInput,
  currentYear?: number
): DepreciationSchedule {
  const startYear = new Date(asset.acquisition_date).getFullYear()
  const calcYear = currentYear || new Date().getFullYear()
  const usefulLife = asset.useful_life_years || getUsefulLife(asset.depreciation_group)
  const endYear = startYear + usefulLife - 1

  let years: DepreciationResult[]

  if (asset.depreciation_method === "zrychlene") {
    years = calculateAccelerated(
      asset.acquisition_cost,
      asset.depreciation_group,
      startYear,
      Math.max(calcYear, endYear)
    )
  } else {
    years = calculateStraightLine(
      asset.acquisition_cost,
      asset.depreciation_group,
      startYear,
      Math.max(calcYear, endYear)
    )
  }

  const totalTaxDep = years.reduce((sum, y) => sum + y.tax_depreciation, 0)
  const totalAccDep = years.reduce((sum, y) => sum + y.accounting_depreciation, 0)

  return {
    asset_name: asset.name,
    acquisition_cost: asset.acquisition_cost,
    depreciation_group: asset.depreciation_group,
    useful_life: usefulLife,
    method: asset.depreciation_method,
    years,
    total_tax_depreciation: roundMoney(totalTaxDep),
    total_accounting_depreciation: roundMoney(totalAccDep),
    is_fully_depreciated: years.length >= usefulLife,
  }
}

/**
 * Calculate depreciation schedules for all assets
 */
export function calculateAllAssets(
  assets: AssetInput[],
  currentYear: number
): DepreciationSchedule[] {
  return assets.map((asset) => calculateDepreciationSchedule(asset, currentYear))
}

/**
 * Get depreciation for a specific year from the schedule
 */
export function getDepreciationForYear(
  asset: AssetInput,
  year: number
): DepreciationResult | null {
  const schedule = calculateDepreciationSchedule(asset, year)
  return schedule.years.find((y) => y.year === year) || null
}
