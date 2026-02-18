import { describe, it, expect } from "vitest"
import { calculatePayroll, generatePayrollAccountingEntries, type EmployeePayrollInput } from "./payroll-calculator"

function makeEmployee(overrides: Partial<EmployeePayrollInput> = {}): EmployeePayrollInput {
  return {
    employee_id: "emp-1",
    employee_name: "Ján Novák",
    contract_type: "hpp",
    gross_salary: 1500,
    children: [],
    worked_hours: 160,
    work_fund_hours: 160,
    period_month: 1,
    period_year: 2025,
    ...overrides,
  }
}

describe("calculatePayroll - HPP", () => {
  it("should calculate basic HPP payroll correctly", () => {
    const input = makeEmployee({ gross_salary: 1500 })
    const result = calculatePayroll(input)

    expect(result.total_gross).toBe(1500)
    expect(result.contract_type).toBe("hpp")

    // Employee insurance: 4% ZP + 9.4% SP = 13.4%
    expect(result.employee_insurance.health).toBe(60) // 1500 * 0.04
    expect(result.employee_insurance.total).toBe(201) // 1500 * 0.134

    // Employer insurance: 10% ZP + 25.2% SP = 35.2%
    expect(result.employer_insurance.health).toBe(150) // 1500 * 0.10
    expect(result.employer_insurance.total).toBe(528) // 1500 * 0.352

    // Tax: (1500 - 201 - 410.24) * 0.19 = 888.76 * 0.19 = 168.86
    expect(result.tax.partial_tax_base).toBe(1299) // 1500 - 201
    expect(result.tax.nontaxable_amount).toBe(410.24)
    expect(result.tax.tax_base).toBe(888.76) // 1299 - 410.24
    expect(result.tax.tax_19).toBe(168.86)
    expect(result.tax.tax_25).toBe(0) // Under bracket
    expect(result.tax.is_withholding).toBe(false)

    // Net: 1500 - 201 - 168.86 = 1130.14
    expect(result.net_salary).toBe(1130.14)
  })

  it("should apply upper tax rate for high salary", () => {
    const input = makeEmployee({ gross_salary: 5000 })
    const result = calculatePayroll(input)

    // Employee insurance: 5000 * 0.134 = 670
    expect(result.employee_insurance.total).toBe(670)

    // Partial tax base: 5000 - 670 = 4330
    // Tax base: 4330 - 410.24 = 3919.76
    // 19% bracket up to 3876.48 = 736.53
    // 25% on remainder: (3919.76 - 3876.48) = 43.28 * 0.25 = 10.82
    expect(result.tax.tax_base).toBe(3919.76)
    expect(result.tax.tax_19_base).toBe(3876.48)
    expect(result.tax.tax_25_base).toBe(43.28)
    expect(result.tax.tax_19).toBe(736.53)
    expect(result.tax.tax_25).toBe(10.82)
  })

  it("should calculate tax bonus for children", () => {
    const input = makeEmployee({
      gross_salary: 2000,
      children: [
        { name: "Marek", date_of_birth: "2015-06-01", is_student: false, disability: false },
        { name: "Eva", date_of_birth: "2005-03-15", is_student: true, disability: false },
      ],
    })
    const result = calculatePayroll(input)

    // Child under 18: 140 EUR/month, child 18+ student: 50 EUR/month
    expect(result.tax.tax_bonus_children).toBe(190) // 140 + 50
    expect(result.tax.tax_after_bonus).toBeLessThan(result.tax.tax_total)
  })

  it("should calculate surcharges for night/weekend work", () => {
    const input = makeEmployee({
      gross_salary: 1500,
      night_hours: 20,
      saturday_hours: 16,
      sunday_hours: 8,
    })
    const result = calculatePayroll(input)

    // Night: 20 * 4.823 * 0.40 = 38.58
    expect(result.surcharges.night).toBe(38.58)
    // Saturday: 16 * 4.823 * 0.50 = 38.58
    expect(result.surcharges.saturday).toBe(38.58)
    // Sunday: 8 * 4.823 * 1.00 = 38.58
    expect(result.surcharges.sunday).toBe(38.58)

    expect(result.total_gross).toBe(1615.74) // 1500 + 115.74
  })

  it("should calculate sick leave correctly", () => {
    const input = makeEmployee({
      gross_salary: 1500,
      sick_leave_days: [1, 2, 3, 4, 5, 6, 7],
      daily_assessment_base: 50,
    })
    const result = calculatePayroll(input)

    // Days 1-3 at 25%: 3 * 50 * 0.25 = 37.50
    expect(result.sick_leave.days_25_percent).toBe(3)
    expect(result.sick_leave.amount_25).toBe(37.5)
    // Days 4-7 at 55%: 4 * 50 * 0.55 = 110
    expect(result.sick_leave.days_55_percent).toBe(4)
    expect(result.sick_leave.amount_55).toBe(110)
    expect(result.sick_leave.total).toBe(147.5)

    expect(result.total_gross).toBe(1647.5) // 1500 + 147.5
  })
})

describe("calculatePayroll - DoVP", () => {
  it("should apply withholding tax for DoVP under 500 EUR", () => {
    const input = makeEmployee({
      contract_type: "dovp",
      gross_salary: 400,
    })
    const result = calculatePayroll(input)

    expect(result.tax.is_withholding).toBe(true)
    expect(result.tax.tax_total).toBe(76) // 400 * 0.19
    expect(result.employee_insurance.total).toBe(0) // No insurance under threshold
    expect(result.net_salary).toBe(324) // 400 - 76
  })

  it("should apply standard tax for DoVP over 500 EUR", () => {
    const input = makeEmployee({
      contract_type: "dovp",
      gross_salary: 1000,
    })
    const result = calculatePayroll(input)

    expect(result.tax.is_withholding).toBe(false)
    expect(result.employee_insurance.total).toBeGreaterThan(0)
  })
})

describe("calculatePayroll - DoBPŠ", () => {
  it("should apply contribution relief for DoBPŠ under 200 EUR", () => {
    const input = makeEmployee({
      contract_type: "dobps",
      gross_salary: 150,
    })
    const result = calculatePayroll(input)

    // Under 200 EUR threshold - no insurance
    expect(result.employee_insurance.total).toBe(0)
    expect(result.employer_insurance.total).toBe(0)
    expect(result.tax.is_withholding).toBe(true)
    expect(result.tax.tax_total).toBe(28.5) // 150 * 0.19
  })

  it("should calculate insurance on amount above 200 EUR for DoBPŠ", () => {
    const input = makeEmployee({
      contract_type: "dobps",
      gross_salary: 500,
    })
    const result = calculatePayroll(input)

    // Assessment base = 500 - 200 = 300
    // Employee: ZP 4% + retirement 4% + disability 3% = 33
    expect(result.employee_insurance.health).toBe(12) // 300 * 0.04
    expect(result.employee_insurance.retirement).toBe(12) // 300 * 0.04
    expect(result.employee_insurance.disability).toBe(9) // 300 * 0.03
    expect(result.employee_insurance.sickness).toBe(0) // No sickness for DoBPŠ
    expect(result.employee_insurance.unemployment).toBe(0) // No unemployment for DoBPŠ
  })
})

describe("generatePayrollAccountingEntries", () => {
  it("should generate correct accounting entries for HPP", () => {
    const input = makeEmployee({ gross_salary: 1500 })
    const result = calculatePayroll(input)
    const entries = generatePayrollAccountingEntries([result])

    expect(entries).toHaveLength(1)
    const empEntries = entries[0].entries

    // Should have: 521/331, 524/336.1, 524/336.2, 331/342, 331/336.1, 331/336.2, 331/221
    expect(empEntries.length).toBeGreaterThanOrEqual(5)

    // Gross wages entry
    const grossEntry = empEntries.find((e) => e.debit_account === "521" && e.credit_account === "331")
    expect(grossEntry).toBeDefined()
    expect(grossEntry!.amount).toBe(1500)

    // Net pay entry
    const netEntry = empEntries.find((e) => e.debit_account === "331" && e.credit_account === "221")
    expect(netEntry).toBeDefined()
    expect(netEntry!.amount).toBe(result.net_salary)

    // Tax entry
    const taxEntry = empEntries.find((e) => e.debit_account === "331" && e.credit_account === "342")
    expect(taxEntry).toBeDefined()
    expect(taxEntry!.amount).toBe(result.tax.tax_after_bonus)
  })

  it("should balance entries (debits = credits for 331)", () => {
    const input = makeEmployee({ gross_salary: 2000 })
    const result = calculatePayroll(input)
    const entries = generatePayrollAccountingEntries([result])

    const empEntries = entries[0].entries

    // Credits to 331 (gross wages)
    const credits331 = empEntries
      .filter((e) => e.credit_account === "331")
      .reduce((sum, e) => sum + e.amount, 0)

    // Debits from 331 (tax, insurance, net pay)
    const debits331 = empEntries
      .filter((e) => e.debit_account === "331")
      .reduce((sum, e) => sum + e.amount, 0)

    // Credits to 331 should equal debits from 331
    expect(Math.round(credits331 * 100) / 100).toBe(Math.round(debits331 * 100) / 100)
  })
})
