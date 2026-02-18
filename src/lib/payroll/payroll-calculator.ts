// ============================================================================
// Slovak Payroll Calculator (Mzdova kalkulacka) - 2025 values
// Complete engine supporting HPP + Dohody (DoVP, DoPČ, DoBPŠ)
// ============================================================================

// ---------- Interfaces ----------

export interface EmployeeChild {
  name: string
  date_of_birth: string // ISO date
  is_student: boolean
  disability: boolean
}

export type ContractType = "hpp" | "dovp" | "dopc" | "dobps"

export interface EmployeePayrollInput {
  employee_id: string
  employee_name: string
  contract_type: ContractType
  gross_salary: number
  children: EmployeeChild[]
  /** Number of worked hours in the period */
  worked_hours: number
  /** Standard work fund hours for the period */
  work_fund_hours: number
  /** Night work hours */
  night_hours?: number
  /** Saturday hours */
  saturday_hours?: number
  /** Sunday hours */
  sunday_hours?: number
  /** Holiday hours */
  holiday_hours?: number
  /** Overtime hours */
  overtime_hours?: number
  /** Average hourly earnings (for surcharges); if omitted calculated from gross/fund */
  average_hourly_earnings?: number
  /** Sick leave (PN) days – array of day-of-month numbers */
  sick_leave_days?: number[]
  /** Daily assessment base for sick leave */
  daily_assessment_base?: number
  /** Period info */
  period_month: number
  period_year: number
}

export interface InsuranceBreakdown {
  health: number
  sickness: number   // nemocenske
  retirement: number  // starobne
  disability: number  // invalidne
  unemployment: number // nezamestnanost
  guarantee?: number  // garancny (employer only)
  reserve?: number    // rezervny (employer only)
  accident?: number   // urazove (employer only)
  total: number
}

export interface SurchargesBreakdown {
  night: number
  saturday: number
  sunday: number
  holiday: number
  overtime: number
  total: number
}

export interface SickLeaveBreakdown {
  days_25_percent: number // days 1-3
  days_55_percent: number // days 4-10
  amount_25: number
  amount_55: number
  total: number
}

export interface TaxCalculation {
  partial_tax_base: number
  nontaxable_amount: number
  tax_base: number
  tax_19_base: number
  tax_25_base: number
  tax_19: number
  tax_25: number
  tax_total: number
  tax_bonus_children: number
  tax_after_bonus: number
  is_withholding: boolean
}

export interface PayrollResult {
  employee_id: string
  employee_name: string
  contract_type: ContractType
  period_month: number
  period_year: number
  gross_salary: number
  surcharges: SurchargesBreakdown
  sick_leave: SickLeaveBreakdown
  total_gross: number
  employee_insurance: InsuranceBreakdown
  employer_insurance: InsuranceBreakdown
  tax: TaxCalculation
  net_salary: number
}

export interface PayrollAccountingEntry {
  debit_account: string
  credit_account: string
  amount: number
  description: string
}

export interface PayrollAccountingEntries {
  employee_id: string
  employee_name: string
  entries: PayrollAccountingEntry[]
}

export interface PayrollCalculation {
  results: PayrollResult[]
  accounting_entries: PayrollAccountingEntries[]
  totals: {
    total_gross: number
    total_net: number
    total_employer_insurance: number
    total_employee_insurance: number
    total_tax: number
  }
}

// ---------- Constants (2025) ----------

/** Non-taxable amount per year (NCZD) */
const NCZD_YEARLY = 4922.82
/** Non-taxable amount per month */
const NCZD_MONTHLY = 410.24

/** Tax bracket threshold per year (176.8x zivotne minimum = 46517.76) */
const TAX_BRACKET_YEARLY = 46517.76
/** Tax bracket threshold per month */
const TAX_BRACKET_MONTHLY = 3876.48

/** Lower tax rate */
const TAX_RATE_LOWER = 0.19
/** Upper tax rate */
const TAX_RATE_UPPER = 0.25

/** Withholding tax rate for agreements */
const WITHHOLDING_TAX_RATE = 0.19

/** Tax bonus per child per month – under 18 */
const TAX_BONUS_CHILD_UNDER_18 = 140
/** Tax bonus per child per month – 18 and over (student) */
const TAX_BONUS_CHILD_18_PLUS = 50

/** Employee health insurance rate */
const ZP_EMPLOYEE_RATE = 0.04
/** Employer health insurance rate */
const ZP_EMPLOYER_RATE = 0.10

/** Employee social insurance rates */
const SP_EMPLOYEE = {
  sickness: 0.014,     // nemocenske
  retirement: 0.04,    // starobne
  disability: 0.03,    // invalidne
  unemployment: 0.01,  // nezamestnanost
}
const SP_EMPLOYEE_TOTAL = 0.094

/** Employer social insurance rates */
const SP_EMPLOYER = {
  sickness: 0.014,
  retirement: 0.14,
  disability: 0.03,
  unemployment: 0.01,
  guarantee: 0.0025,   // garancny
  reserve: 0.0475,     // rezervny
  accident: 0.008,     // urazove
}
const SP_EMPLOYER_TOTAL = 0.252

/** Minimum hourly wage 2025 (used for surcharge calculation) */
const MIN_HOURLY_WAGE = 4.823

/** DoBPS contribution relief threshold */
const DOBPS_RELIEF_THRESHOLD = 200

/** DoVP withholding threshold */
const DOVP_WITHHOLDING_THRESHOLD = 500

// ---------- Helpers ----------

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function getChildAge(childDob: string, periodYear: number, periodMonth: number): number {
  const dob = new Date(childDob)
  const periodDate = new Date(periodYear, periodMonth - 1, 1)
  let age = periodDate.getFullYear() - dob.getFullYear()
  const monthDiff = periodDate.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && periodDate.getDate() < dob.getDate())) {
    age--
  }
  return age
}

function calculateSurcharges(input: EmployeePayrollInput): SurchargesBreakdown {
  const avgHourly =
    input.average_hourly_earnings ||
    (input.work_fund_hours > 0 ? input.gross_salary / input.work_fund_hours : 0)

  const night    = round2((input.night_hours || 0) * MIN_HOURLY_WAGE * 0.40)
  const saturday = round2((input.saturday_hours || 0) * MIN_HOURLY_WAGE * 0.50)
  const sunday   = round2((input.sunday_hours || 0) * MIN_HOURLY_WAGE * 1.00)
  const holiday  = round2((input.holiday_hours || 0) * avgHourly * 1.00)
  const overtime = round2((input.overtime_hours || 0) * avgHourly * 0.25)

  return {
    night,
    saturday,
    sunday,
    holiday,
    overtime,
    total: round2(night + saturday + sunday + holiday + overtime),
  }
}

function calculateSickLeave(input: EmployeePayrollInput): SickLeaveBreakdown {
  const days = input.sick_leave_days || []
  if (days.length === 0 || !input.daily_assessment_base) {
    return { days_25_percent: 0, days_55_percent: 0, amount_25: 0, amount_55: 0, total: 0 }
  }

  // Employer pays days 1-10: days 1-3 at 25%, days 4-10 at 55%
  const totalDays = Math.min(days.length, 10)
  const days25 = Math.min(totalDays, 3)
  const days55 = Math.max(0, totalDays - 3)

  const amount25 = round2(days25 * input.daily_assessment_base * 0.25)
  const amount55 = round2(days55 * input.daily_assessment_base * 0.55)

  return {
    days_25_percent: days25,
    days_55_percent: days55,
    amount_25: amount25,
    amount_55: amount55,
    total: round2(amount25 + amount55),
  }
}

function calculateTaxBonusForChildren(
  children: EmployeeChild[],
  periodYear: number,
  periodMonth: number
): number {
  let bonus = 0
  for (const child of children) {
    const age = getChildAge(child.date_of_birth, periodYear, periodMonth)
    if (age < 0 || age > 25) continue
    if (age >= 18 && !child.is_student) continue

    if (age < 18) {
      bonus += TAX_BONUS_CHILD_UNDER_18
    } else {
      bonus += TAX_BONUS_CHILD_18_PLUS
    }
  }
  return round2(bonus)
}

function buildEmployeeInsurance(totalGross: number): InsuranceBreakdown {
  const health      = round2(totalGross * ZP_EMPLOYEE_RATE)
  const sickness    = round2(totalGross * SP_EMPLOYEE.sickness)
  const retirement  = round2(totalGross * SP_EMPLOYEE.retirement)
  const disability  = round2(totalGross * SP_EMPLOYEE.disability)
  const unemployment = round2(totalGross * SP_EMPLOYEE.unemployment)
  const spTotal     = round2(sickness + retirement + disability + unemployment)

  return {
    health,
    sickness,
    retirement,
    disability,
    unemployment,
    total: round2(health + spTotal),
  }
}

function buildEmployerInsurance(totalGross: number): InsuranceBreakdown {
  const health       = round2(totalGross * ZP_EMPLOYER_RATE)
  const sickness     = round2(totalGross * SP_EMPLOYER.sickness)
  const retirement   = round2(totalGross * SP_EMPLOYER.retirement)
  const disability   = round2(totalGross * SP_EMPLOYER.disability)
  const unemployment = round2(totalGross * SP_EMPLOYER.unemployment)
  const guarantee    = round2(totalGross * SP_EMPLOYER.guarantee)
  const reserve      = round2(totalGross * SP_EMPLOYER.reserve)
  const accident     = round2(totalGross * SP_EMPLOYER.accident)
  const spTotal      = round2(sickness + retirement + disability + unemployment + guarantee + reserve + accident)

  return {
    health,
    sickness,
    retirement,
    disability,
    unemployment,
    guarantee,
    reserve,
    accident,
    total: round2(health + spTotal),
  }
}

function buildStandardTax(
  totalGross: number,
  employeeInsuranceTotal: number,
  children: EmployeeChild[],
  periodYear: number,
  periodMonth: number
): TaxCalculation {
  const partialTaxBase = round2(totalGross - employeeInsuranceTotal)
  const nontaxableAmount = NCZD_MONTHLY
  const taxBase = round2(Math.max(0, partialTaxBase - nontaxableAmount))

  const tax19Base = Math.min(taxBase, TAX_BRACKET_MONTHLY)
  const tax25Base = round2(Math.max(0, taxBase - TAX_BRACKET_MONTHLY))

  const tax19     = round2(tax19Base * TAX_RATE_LOWER)
  const tax25     = round2(tax25Base * TAX_RATE_UPPER)
  const taxTotal  = round2(tax19 + tax25)

  const taxBonusChildren = calculateTaxBonusForChildren(children, periodYear, periodMonth)
  const taxAfterBonus    = round2(Math.max(0, taxTotal - taxBonusChildren))

  return {
    partial_tax_base: partialTaxBase,
    nontaxable_amount: nontaxableAmount,
    tax_base: taxBase,
    tax_19_base: tax19Base,
    tax_25_base: tax25Base,
    tax_19: tax19,
    tax_25: tax25,
    tax_total: taxTotal,
    tax_bonus_children: taxBonusChildren,
    tax_after_bonus: taxAfterBonus,
    is_withholding: false,
  }
}

function emptyInsurance(): InsuranceBreakdown {
  return { health: 0, sickness: 0, retirement: 0, disability: 0, unemployment: 0, total: 0 }
}

function emptyEmployerInsurance(): InsuranceBreakdown {
  return {
    health: 0, sickness: 0, retirement: 0, disability: 0, unemployment: 0,
    guarantee: 0, reserve: 0, accident: 0, total: 0,
  }
}

const EMPTY_SICK: SickLeaveBreakdown = {
  days_25_percent: 0, days_55_percent: 0, amount_25: 0, amount_55: 0, total: 0,
}

// ---------- HPP (standard employment) ----------

function calculateHPP(input: EmployeePayrollInput): PayrollResult {
  const surcharges = calculateSurcharges(input)
  const sickLeave  = calculateSickLeave(input)
  const totalGross = round2(input.gross_salary + surcharges.total + sickLeave.total)

  const employeeIns = buildEmployeeInsurance(totalGross)
  const employerIns = buildEmployerInsurance(totalGross)
  const tax = buildStandardTax(
    totalGross,
    employeeIns.total,
    input.children,
    input.period_year,
    input.period_month
  )

  return {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    contract_type: input.contract_type,
    period_month: input.period_month,
    period_year: input.period_year,
    gross_salary: input.gross_salary,
    surcharges,
    sick_leave: sickLeave,
    total_gross: totalGross,
    employee_insurance: employeeIns,
    employer_insurance: employerIns,
    tax,
    net_salary: round2(totalGross - employeeIns.total - tax.tax_after_bonus),
  }
}

// ---------- DoVP (Dohoda o vykonani prace) ----------

function calculateDoVP(input: EmployeePayrollInput): PayrollResult {
  const surcharges = calculateSurcharges(input)
  const totalGross = round2(input.gross_salary + surcharges.total)

  // DoVP up to 500 EUR: withholding tax 19%, no insurance
  const useWithholding = totalGross <= DOVP_WITHHOLDING_THRESHOLD

  let employeeIns: InsuranceBreakdown
  let employerIns: InsuranceBreakdown
  let tax: TaxCalculation

  if (useWithholding) {
    employeeIns = emptyInsurance()
    employerIns = emptyEmployerInsurance()

    const withholdingTax = round2(totalGross * WITHHOLDING_TAX_RATE)
    tax = {
      partial_tax_base: totalGross,
      nontaxable_amount: 0,
      tax_base: totalGross,
      tax_19_base: totalGross,
      tax_25_base: 0,
      tax_19: withholdingTax,
      tax_25: 0,
      tax_total: withholdingTax,
      tax_bonus_children: 0,
      tax_after_bonus: withholdingTax,
      is_withholding: true,
    }
  } else {
    employeeIns = buildEmployeeInsurance(totalGross)
    employerIns = buildEmployerInsurance(totalGross)
    tax = buildStandardTax(totalGross, employeeIns.total, input.children, input.period_year, input.period_month)
  }

  return {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    contract_type: input.contract_type,
    period_month: input.period_month,
    period_year: input.period_year,
    gross_salary: input.gross_salary,
    surcharges,
    sick_leave: EMPTY_SICK,
    total_gross: totalGross,
    employee_insurance: employeeIns,
    employer_insurance: employerIns,
    tax,
    net_salary: round2(totalGross - employeeIns.total - tax.tax_after_bonus),
  }
}

// ---------- DoPČ (Dohoda o pracovnej cinnosti) ----------

function calculateDoPC(input: EmployeePayrollInput): PayrollResult {
  // DoPČ: same logic as HPP (employee can opt for withholding, but default = standard)
  return calculateHPP(input)
}

// ---------- DoBPŠ (Dohoda o brigadnickej praci studentov) ----------

function calculateDoBPS(input: EmployeePayrollInput): PayrollResult {
  const surcharges = calculateSurcharges(input)
  const totalGross = round2(input.gross_salary + surcharges.total)

  // Contribution relief up to 200 EUR
  const assessmentBase = round2(Math.max(0, totalGross - DOBPS_RELIEF_THRESHOLD))

  let employeeIns: InsuranceBreakdown
  let employerIns: InsuranceBreakdown

  if (assessmentBase <= 0) {
    employeeIns = emptyInsurance()
    employerIns = emptyEmployerInsurance()
  } else {
    // Insurance only on amount above relief threshold, limited contributions
    const zpEmp      = round2(assessmentBase * ZP_EMPLOYEE_RATE)
    const spRetEmp   = round2(assessmentBase * SP_EMPLOYEE.retirement)
    const spDisEmp   = round2(assessmentBase * SP_EMPLOYEE.disability)

    employeeIns = {
      health: zpEmp,
      sickness: 0,
      retirement: spRetEmp,
      disability: spDisEmp,
      unemployment: 0,
      total: round2(zpEmp + spRetEmp + spDisEmp),
    }

    const zpEmr      = round2(assessmentBase * ZP_EMPLOYER_RATE)
    const spRetEmr   = round2(assessmentBase * SP_EMPLOYER.retirement)
    const spDisEmr   = round2(assessmentBase * SP_EMPLOYER.disability)
    const spGuar     = round2(assessmentBase * SP_EMPLOYER.guarantee)
    const spRes      = round2(assessmentBase * SP_EMPLOYER.reserve)
    const spAcc      = round2(assessmentBase * SP_EMPLOYER.accident)

    employerIns = {
      health: zpEmr,
      sickness: 0,
      retirement: spRetEmr,
      disability: spDisEmr,
      unemployment: 0,
      guarantee: spGuar,
      reserve: spRes,
      accident: spAcc,
      total: round2(zpEmr + spRetEmr + spDisEmr + spGuar + spRes + spAcc),
    }
  }

  // Withholding tax on total gross
  const withholdingTax = round2(totalGross * WITHHOLDING_TAX_RATE)
  const tax: TaxCalculation = {
    partial_tax_base: round2(totalGross - employeeIns.total),
    nontaxable_amount: 0,
    tax_base: totalGross,
    tax_19_base: totalGross,
    tax_25_base: 0,
    tax_19: withholdingTax,
    tax_25: 0,
    tax_total: withholdingTax,
    tax_bonus_children: 0,
    tax_after_bonus: withholdingTax,
    is_withholding: true,
  }

  return {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    contract_type: input.contract_type,
    period_month: input.period_month,
    period_year: input.period_year,
    gross_salary: input.gross_salary,
    surcharges,
    sick_leave: EMPTY_SICK,
    total_gross: totalGross,
    employee_insurance: employeeIns,
    employer_insurance: employerIns,
    tax,
    net_salary: round2(totalGross - employeeIns.total - withholdingTax),
  }
}

// ---------- Main Exports ----------

/**
 * Calculate payroll for a single employee based on contract type.
 */
export function calculatePayroll(input: EmployeePayrollInput): PayrollResult {
  switch (input.contract_type) {
    case "hpp":
      return calculateHPP(input)
    case "dovp":
      return calculateDoVP(input)
    case "dopc":
      return calculateDoPC(input)
    case "dobps":
      return calculateDoBPS(input)
    default:
      return calculateHPP(input)
  }
}

/**
 * Generate accounting entries (uctovne zapisy) from payroll results.
 *
 * Standard Slovak payroll accounting:
 *   521/331  – Hrube mzdy (Gross wages)
 *   524/336.1 – ZP zamestnavatel (Employer health insurance)
 *   524/336.2 – SP zamestnavatel (Employer social insurance)
 *   331/342  – Dan z prijmov (Income tax)
 *   331/336.1 – ZP zamestnanec (Employee health insurance)
 *   331/336.2 – SP zamestnanec (Employee social insurance)
 *   331/221  – Cista mzda (Net pay)
 */
export function generatePayrollAccountingEntries(
  results: PayrollResult[]
): PayrollAccountingEntries[] {
  const allEntries: PayrollAccountingEntries[] = []

  for (const result of results) {
    const entries: PayrollAccountingEntry[] = []

    // 521/331 – Gross wages
    if (result.total_gross > 0) {
      entries.push({
        debit_account: "521",
        credit_account: "331",
        amount: result.total_gross,
        description: `Hruba mzda - ${result.employee_name}`,
      })
    }

    // 524/336.1 – Employer health insurance
    if (result.employer_insurance.health > 0) {
      entries.push({
        debit_account: "524",
        credit_account: "336.1",
        amount: result.employer_insurance.health,
        description: `ZP zamestnavatel - ${result.employee_name}`,
      })
    }

    // 524/336.2 – Employer social insurance
    const employerSP = round2(result.employer_insurance.total - result.employer_insurance.health)
    if (employerSP > 0) {
      entries.push({
        debit_account: "524",
        credit_account: "336.2",
        amount: employerSP,
        description: `SP zamestnavatel - ${result.employee_name}`,
      })
    }

    // 331/342 – Income tax
    if (result.tax.tax_after_bonus > 0) {
      entries.push({
        debit_account: "331",
        credit_account: "342",
        amount: result.tax.tax_after_bonus,
        description: `Dan z prijmov - ${result.employee_name}`,
      })
    }

    // 331/336.1 – Employee health insurance
    if (result.employee_insurance.health > 0) {
      entries.push({
        debit_account: "331",
        credit_account: "336.1",
        amount: result.employee_insurance.health,
        description: `ZP zamestnanec - ${result.employee_name}`,
      })
    }

    // 331/336.2 – Employee social insurance
    const employeeSP = round2(result.employee_insurance.total - result.employee_insurance.health)
    if (employeeSP > 0) {
      entries.push({
        debit_account: "331",
        credit_account: "336.2",
        amount: employeeSP,
        description: `SP zamestnanec - ${result.employee_name}`,
      })
    }

    // 331/221 – Net pay
    if (result.net_salary > 0) {
      entries.push({
        debit_account: "331",
        credit_account: "221",
        amount: result.net_salary,
        description: `Cista mzda - ${result.employee_name}`,
      })
    }

    allEntries.push({
      employee_id: result.employee_id,
      employee_name: result.employee_name,
      entries,
    })
  }

  return allEntries
}
