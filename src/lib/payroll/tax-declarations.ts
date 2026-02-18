// Knižnica pre generovanie slovenských mzdových daňových hlásení
// Mesačný prehľad (§35 ods. 6 ZDP), Ročné hlásenie (§39 ods. 9 ZDP), Potvrdenie o príjmoch (§39 ods. 5 ZDP)

// ---- Typy ----

export interface MonthlyTaxReport {
  company: {
    name: string
    ico: string
    dic: string
    address: string
    tax_office: string
  }
  period: {
    month: number
    year: number
  }
  number_of_employees: number
  total_gross_income: number
  total_insurance_deductions: number
  total_nczd: number
  total_tax_base: number
  total_tax_19pct: number
  total_tax_25pct: number
  total_tax_bonus: number
  total_tax_withheld: number
  generated_at: string
}

export interface AnnualTaxReportEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  total_gross_income: number
  total_insurance_employee: number
  total_nczd: number
  total_tax_base: number
  total_tax_19pct: number
  total_tax_25pct: number
  total_tax_bonus: number
  total_tax_withheld: number
  months_worked: number
}

export interface AnnualTaxReport {
  company: {
    name: string
    ico: string
    dic: string
    address: string
    tax_office: string
  }
  year: number
  number_of_employees: number
  employees: AnnualTaxReportEmployee[]
  totals: {
    total_gross_income: number
    total_insurance_deductions: number
    total_nczd: number
    total_tax_base: number
    total_tax_19pct: number
    total_tax_25pct: number
    total_tax_bonus: number
    total_tax_withheld: number
  }
  generated_at: string
}

export interface TaxCertificateMonth {
  month: number
  gross_income: number
  insurance_employee: number
  nczd: number
  tax_base: number
  tax_advance: number
  tax_bonus: number
  net_income: number
}

export interface TaxCertificate {
  company: {
    name: string
    ico: string
    dic: string
    address: string
  }
  employee: {
    name: string
    rodne_cislo: string
    address: string
    employee_id: string
  }
  year: number
  months: TaxCertificateMonth[]
  totals: {
    total_gross_income: number
    total_insurance_employee: number
    total_nczd: number
    total_tax_base: number
    total_tax_advance: number
    total_tax_bonus: number
    total_net_income: number
  }
  tax_settlement: {
    total_tax_liability: number
    total_tax_paid: number
    difference: number
  }
  generated_at: string
}

// ---- Pomocné funkcie ----

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Extract payroll values from an item that may have flat fields or JSONB breakdown objects.
 * Payroll POST stores: employee_insurance (JSONB), employer_insurance (JSONB), tax (JSONB)
 */
function extractItemValues(item: any) {
  const gross = Number(item.total_gross || item.gross_salary || item.gross_income || 0)
  const insuranceEmployee = Number(
    item.employee_insurance?.total ??
    item.insurance_employee ??
    item.total_insurance_employee ??
    0
  )
  const nczd = Number(
    item.tax?.nontaxable_amount ??
    item.nczd ??
    item.tax_free_amount ??
    0
  )
  const taxBase = Number(
    item.tax?.tax_base ??
    Math.max(0, gross - insuranceEmployee - nczd)
  )
  const tax19 = Number(item.tax?.tax_19 ?? 0)
  const tax25 = Number(item.tax?.tax_25 ?? 0)
  const taxBonus = Number(
    item.tax?.tax_bonus_children ??
    item.tax_bonus ??
    0
  )
  const taxWithheld = Number(
    item.tax?.tax_after_bonus ??
    Math.max(0, (tax19 || 0) + (tax25 || 0) - taxBonus)
  )
  const netSalary = Number(item.net_salary ?? item.net_income ?? (gross - insuranceEmployee - taxWithheld))

  return { gross, insuranceEmployee, nczd, taxBase, tax19, tax25, taxBonus, taxWithheld, netSalary }
}

function getCompanyInfo(company: any) {
  return {
    name: company?.name || "",
    ico: company?.ico || "",
    dic: company?.dic || "",
    address: [company?.street, company?.city, company?.zip].filter(Boolean).join(", "),
    tax_office: company?.tax_office || "",
  }
}

// Základ dane do 19% - nad túto hranicu sa aplikuje 25% (46517.76 / 12 = 3876.48)
const TAX_THRESHOLD_19PCT = 3876.48 // mesačná suma pre rok 2025

function splitTaxBrackets(monthlyTaxBase: number): { tax19: number; tax25: number } {
  if (monthlyTaxBase <= 0) return { tax19: 0, tax25: 0 }
  if (monthlyTaxBase <= TAX_THRESHOLD_19PCT) {
    return { tax19: roundTwo(monthlyTaxBase * 0.19), tax25: 0 }
  }
  const base19 = TAX_THRESHOLD_19PCT
  const base25 = monthlyTaxBase - TAX_THRESHOLD_19PCT
  return {
    tax19: roundTwo(base19 * 0.19),
    tax25: roundTwo(base25 * 0.25),
  }
}

// ---- Generátory ----

/**
 * Generuje mesačný prehľad o zrazených preddavkoch na daň (§35 ods. 6 ZDP)
 */
export function generateMonthlyTaxReport(
  payrollItems: any[],
  company: any,
  period: { month: number; year: number }
): MonthlyTaxReport {
  // Filtrovať položky za dané obdobie
  const items = payrollItems.filter((item: any) => {
    const itemMonth = item.month ?? new Date(item.period_start || item.created_at).getMonth() + 1
    const itemYear = item.year ?? new Date(item.period_start || item.created_at).getFullYear()
    return itemMonth === period.month && itemYear === period.year
  })

  // Unikátni zamestnanci
  const employeeIds = Array.from(new Set(items.map((i: any) => i.employee_id)))
  const numberOfEmployees = employeeIds.length

  let totalGrossIncome = 0
  let totalInsuranceDeductions = 0
  let totalNczd = 0
  let totalTaxBase = 0
  let totalTax19 = 0
  let totalTax25 = 0
  let totalTaxBonus = 0
  let totalTaxWithheld = 0

  for (const item of items) {
    const v = extractItemValues(item)

    // Use stored tax breakdown if available, otherwise compute from splitTaxBrackets
    let tax19 = v.tax19
    let tax25 = v.tax25
    if (!tax19 && !tax25 && v.taxBase > 0) {
      const split = splitTaxBrackets(v.taxBase)
      tax19 = split.tax19
      tax25 = split.tax25
    }

    totalGrossIncome += v.gross
    totalInsuranceDeductions += v.insuranceEmployee
    totalNczd += v.nczd
    totalTaxBase += v.taxBase
    totalTax19 += tax19
    totalTax25 += tax25
    totalTaxBonus += v.taxBonus
    totalTaxWithheld += v.taxWithheld
  }

  return {
    company: getCompanyInfo(company),
    period,
    number_of_employees: numberOfEmployees,
    total_gross_income: roundTwo(totalGrossIncome),
    total_insurance_deductions: roundTwo(totalInsuranceDeductions),
    total_nczd: roundTwo(totalNczd),
    total_tax_base: roundTwo(totalTaxBase),
    total_tax_19pct: roundTwo(totalTax19),
    total_tax_25pct: roundTwo(totalTax25),
    total_tax_bonus: roundTwo(totalTaxBonus),
    total_tax_withheld: roundTwo(totalTaxWithheld),
    generated_at: new Date().toISOString(),
  }
}

/**
 * Generuje ročné hlásenie o vyúčtovaní dane (§39 ods. 9 ZDP)
 */
export function generateAnnualTaxReport(
  payrollItems: any[],
  company: any,
  year: number
): AnnualTaxReport {
  // Filtrovať položky za daný rok
  const items = payrollItems.filter((item: any) => {
    const itemYear = item.year ?? new Date(item.period_start || item.created_at).getFullYear()
    return itemYear === year
  })

  // Zoskupiť podľa zamestnanca
  const employeeMap = new Map<string, any[]>()
  for (const item of items) {
    const empId = item.employee_id
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, [])
    }
    employeeMap.get(empId)!.push(item)
  }

  const employees: AnnualTaxReportEmployee[] = []
  let totalGross = 0
  let totalInsurance = 0
  let totalNczd = 0
  let totalTaxBase = 0
  let totalTax19 = 0
  let totalTax25 = 0
  let totalBonus = 0
  let totalWithheld = 0

  const entries = Array.from(employeeMap.entries())
  for (const [empId, empItems] of entries) {
    let empGross = 0
    let empInsurance = 0
    let empNczd = 0
    let empTaxBase = 0
    let empTax19 = 0
    let empTax25 = 0
    let empBonus = 0
    let empWithheld = 0
    const monthsSet = new Set<number>()

    for (const item of empItems) {
      const v = extractItemValues(item)
      const month = item.month ?? new Date(item.period_start || item.created_at).getMonth() + 1

      // Use stored tax breakdown if available, otherwise compute from splitTaxBrackets
      let tax19 = v.tax19
      let tax25 = v.tax25
      if (!tax19 && !tax25 && v.taxBase > 0) {
        const split = splitTaxBrackets(v.taxBase)
        tax19 = split.tax19
        tax25 = split.tax25
      }

      empGross += v.gross
      empInsurance += v.insuranceEmployee
      empNczd += v.nczd
      empTaxBase += v.taxBase
      empTax19 += tax19
      empTax25 += tax25
      empBonus += v.taxBonus
      empWithheld += v.taxWithheld
      monthsSet.add(month)
    }

    const firstName = empItems[0]?.employee?.first_name || empItems[0]?.employee?.name || empItems[0]?.first_name || empItems[0]?.name || ""
    const lastName = empItems[0]?.employee?.last_name || empItems[0]?.employee?.surname || empItems[0]?.last_name || empItems[0]?.surname || ""
    const rodneCislo = empItems[0]?.employee?.rodne_cislo || empItems[0]?.rodne_cislo || ""

    employees.push({
      employee_id: empId,
      name: `${lastName} ${firstName}`.trim() || `Zamestnanec ${empId.substring(0, 8)}`,
      rodne_cislo: rodneCislo,
      total_gross_income: roundTwo(empGross),
      total_insurance_employee: roundTwo(empInsurance),
      total_nczd: roundTwo(empNczd),
      total_tax_base: roundTwo(empTaxBase),
      total_tax_19pct: roundTwo(empTax19),
      total_tax_25pct: roundTwo(empTax25),
      total_tax_bonus: roundTwo(empBonus),
      total_tax_withheld: roundTwo(empWithheld),
      months_worked: monthsSet.size,
    })

    totalGross += empGross
    totalInsurance += empInsurance
    totalNczd += empNczd
    totalTaxBase += empTaxBase
    totalTax19 += empTax19
    totalTax25 += empTax25
    totalBonus += empBonus
    totalWithheld += empWithheld
  }

  // Zoradiť podľa priezviska
  employees.sort((a, b) => a.name.localeCompare(b.name, "sk"))

  return {
    company: getCompanyInfo(company),
    year,
    number_of_employees: employees.length,
    employees,
    totals: {
      total_gross_income: roundTwo(totalGross),
      total_insurance_deductions: roundTwo(totalInsurance),
      total_nczd: roundTwo(totalNczd),
      total_tax_base: roundTwo(totalTaxBase),
      total_tax_19pct: roundTwo(totalTax19),
      total_tax_25pct: roundTwo(totalTax25),
      total_tax_bonus: roundTwo(totalBonus),
      total_tax_withheld: roundTwo(totalWithheld),
    },
    generated_at: new Date().toISOString(),
  }
}

/**
 * Generuje potvrdenie o zdaniteľných príjmoch (§39 ods. 5 ZDP) pre jedného zamestnanca
 */
export function generateTaxCertificate(
  employeePayrollItems: any[],
  employee: any,
  company: any,
  year: number
): TaxCertificate {
  // Filtrovať za rok
  const items = employeePayrollItems.filter((item: any) => {
    const itemYear = item.year ?? new Date(item.period_start || item.created_at).getFullYear()
    return itemYear === year
  })

  // Zoskupiť podľa mesiacov
  const monthMap = new Map<number, any[]>()
  for (const item of items) {
    const month = item.month ?? new Date(item.period_start || item.created_at).getMonth() + 1
    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }
    monthMap.get(month)!.push(item)
  }

  const months: TaxCertificateMonth[] = []
  let totalGross = 0
  let totalInsurance = 0
  let totalNczd = 0
  let totalTaxBase = 0
  let totalTaxAdvance = 0
  let totalTaxBonus = 0
  let totalNet = 0

  for (let m = 1; m <= 12; m++) {
    const monthItems = monthMap.get(m) || []
    if (monthItems.length === 0) continue

    let mGross = 0
    let mInsurance = 0
    let mNczd = 0
    let mTaxBase = 0
    let mTaxAdvance = 0
    let mTaxBonus = 0
    let mNet = 0

    for (const item of monthItems) {
      const v = extractItemValues(item)

      mGross += v.gross
      mInsurance += v.insuranceEmployee
      mNczd += v.nczd
      mTaxBase += v.taxBase
      mTaxAdvance += v.taxWithheld
      mTaxBonus += v.taxBonus
      mNet += v.netSalary
    }

    months.push({
      month: m,
      gross_income: roundTwo(mGross),
      insurance_employee: roundTwo(mInsurance),
      nczd: roundTwo(mNczd),
      tax_base: roundTwo(mTaxBase),
      tax_advance: roundTwo(mTaxAdvance),
      tax_bonus: roundTwo(mTaxBonus),
      net_income: roundTwo(mNet),
    })

    totalGross += mGross
    totalInsurance += mInsurance
    totalNczd += mNczd
    totalTaxBase += mTaxBase
    totalTaxAdvance += mTaxAdvance
    totalTaxBonus += mTaxBonus
    totalNet += mNet
  }

  const totalTaxLiability = roundTwo(totalTaxBase * 0.19)
  const totalTaxPaid = roundTwo(totalTaxAdvance)
  const difference = roundTwo(totalTaxLiability - totalTaxPaid)

  return {
    company: {
      name: company?.name || "",
      ico: company?.ico || "",
      dic: company?.dic || "",
      address: [company?.street, company?.city, company?.zip].filter(Boolean).join(", "),
    },
    employee: {
      name: `${employee?.last_name || employee?.surname || ""} ${employee?.first_name || employee?.name || ""}`.trim(),
      rodne_cislo: employee?.rodne_cislo || "",
      address: [employee?.address_street || employee?.street, employee?.address_city || employee?.city, employee?.address_zip || employee?.zip].filter(Boolean).join(", "),
      employee_id: employee?.id || "",
    },
    year,
    months,
    totals: {
      total_gross_income: roundTwo(totalGross),
      total_insurance_employee: roundTwo(totalInsurance),
      total_nczd: roundTwo(totalNczd),
      total_tax_base: roundTwo(totalTaxBase),
      total_tax_advance: roundTwo(totalTaxAdvance),
      total_tax_bonus: roundTwo(totalTaxBonus),
      total_net_income: roundTwo(totalNet),
    },
    tax_settlement: {
      total_tax_liability: totalTaxLiability,
      total_tax_paid: totalTaxPaid,
      difference,
    },
    generated_at: new Date().toISOString(),
  }
}
