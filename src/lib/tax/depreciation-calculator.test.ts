import { describe, it, expect } from "vitest"
import {
  calculateStraightLine,
  calculateAccelerated,
  calculateDepreciationSchedule,
  getUsefulLife,
  getDepreciationForYear,
  DEPRECIATION_GROUPS,
  type AssetInput,
} from "./depreciation-calculator"

describe("getUsefulLife", () => {
  it("should return correct useful life for each group", () => {
    expect(getUsefulLife(0)).toBe(2)
    expect(getUsefulLife(1)).toBe(4)
    expect(getUsefulLife(2)).toBe(6)
    expect(getUsefulLife(3)).toBe(8)
    expect(getUsefulLife(4)).toBe(12)
    expect(getUsefulLife(5)).toBe(20)
    expect(getUsefulLife(6)).toBe(40)
  })

  it("should return 4 for unknown group", () => {
    expect(getUsefulLife(99)).toBe(4)
  })
})

describe("calculateStraightLine", () => {
  it("should depreciate 12,000 EUR over 4 years (group 1) equally", () => {
    const results = calculateStraightLine(12000, 1, 2025, 2030)

    expect(results).toHaveLength(4)
    expect(results[0].tax_depreciation).toBe(3000)
    expect(results[1].tax_depreciation).toBe(3000)
    expect(results[2].tax_depreciation).toBe(3000)
    expect(results[3].tax_depreciation).toBe(3000)

    // Check accumulated
    expect(results[0].tax_accumulated).toBe(3000)
    expect(results[3].tax_accumulated).toBe(12000)

    // Check net value
    expect(results[0].tax_net_value).toBe(9000)
    expect(results[3].tax_net_value).toBe(0)
  })

  it("should handle non-divisible amounts correctly", () => {
    // 10000 / 6 = 1666.67, last year gets the remainder
    const results = calculateStraightLine(10000, 2, 2025, 2035)

    expect(results).toHaveLength(6)
    expect(results[0].tax_depreciation).toBe(1666.67)

    // Total should be exactly the cost
    const total = results.reduce((sum, r) => sum + r.tax_depreciation, 0)
    expect(Math.round(total * 100) / 100).toBe(10000)
    expect(results[5].tax_net_value).toBe(0)
  })

  it("should stop at currentYear", () => {
    const results = calculateStraightLine(12000, 1, 2025, 2026)

    // Only 2025 and 2026 (2 out of 4 years)
    expect(results).toHaveLength(2)
    expect(results[0].year).toBe(2025)
    expect(results[1].year).toBe(2026)
  })

  it("should handle single year (group 0, 2 years)", () => {
    const results = calculateStraightLine(4000, 0, 2025, 2026)

    expect(results).toHaveLength(2)
    expect(results[0].tax_depreciation).toBe(2000)
    expect(results[1].tax_depreciation).toBe(2000)
    expect(results[1].tax_net_value).toBe(0)
  })
})

describe("calculateAccelerated", () => {
  it("should depreciate 12,000 EUR over 4 years (group 1) with decreasing amounts", () => {
    const results = calculateAccelerated(12000, 1, 2025, 2030)

    expect(results).toHaveLength(4)

    // Year 1: 12000 / 4 = 3000
    expect(results[0].tax_depreciation).toBe(3000)
    // Year 2: (2 * 9000) / (5 - 1) = 18000 / 4 = 4500
    expect(results[1].tax_depreciation).toBe(4500)
    // Year 3: (2 * 4500) / (5 - 2) = 9000 / 3 = 3000
    expect(results[2].tax_depreciation).toBe(3000)
    // Year 4: remainder = 1500
    expect(results[3].tax_depreciation).toBe(1500)

    // Total should equal cost
    const total = results.reduce((sum, r) => sum + r.tax_depreciation, 0)
    expect(total).toBe(12000)
    expect(results[3].tax_net_value).toBe(0)
  })

  it("should have higher depreciation in early years than straight-line", () => {
    const straightLine = calculateStraightLine(12000, 1, 2025, 2030)
    const accelerated = calculateAccelerated(12000, 1, 2025, 2030)

    // Accelerated should have higher depreciation in year 2
    expect(accelerated[1].tax_depreciation).toBeGreaterThan(straightLine[1].tax_depreciation)

    // But lower in the last year
    expect(accelerated[3].tax_depreciation).toBeLessThan(straightLine[3].tax_depreciation)
  })

  it("should fully depreciate the asset", () => {
    const results = calculateAccelerated(50000, 2, 2025, 2040)

    const total = results.reduce((sum, r) => sum + r.tax_depreciation, 0)
    expect(Math.round(total * 100) / 100).toBe(50000)
    expect(results[results.length - 1].tax_net_value).toBe(0)
  })
})

describe("calculateDepreciationSchedule", () => {
  it("should generate correct schedule for straight-line method", () => {
    const asset: AssetInput = {
      name: "Počítač",
      acquisition_cost: 2400,
      acquisition_date: "2025-03-15",
      depreciation_group: 1,
      depreciation_method: "rovnomerne",
    }

    const schedule = calculateDepreciationSchedule(asset, 2030)

    expect(schedule.asset_name).toBe("Počítač")
    expect(schedule.acquisition_cost).toBe(2400)
    expect(schedule.depreciation_group).toBe(1)
    expect(schedule.useful_life).toBe(4)
    expect(schedule.method).toBe("rovnomerne")
    expect(schedule.is_fully_depreciated).toBe(true)
    expect(schedule.years).toHaveLength(4)
    expect(schedule.total_tax_depreciation).toBe(2400)
  })

  it("should generate correct schedule for accelerated method", () => {
    const asset: AssetInput = {
      name: "Dodávka",
      acquisition_cost: 30000,
      acquisition_date: "2025-01-01",
      depreciation_group: 2,
      depreciation_method: "zrychlene",
    }

    const schedule = calculateDepreciationSchedule(asset, 2035)

    expect(schedule.method).toBe("zrychlene")
    expect(schedule.is_fully_depreciated).toBe(true)
    expect(schedule.years).toHaveLength(6)
    expect(Math.round(schedule.total_tax_depreciation * 100) / 100).toBe(30000)
  })
})

describe("getDepreciationForYear", () => {
  it("should return depreciation for a specific year", () => {
    const asset: AssetInput = {
      name: "Server",
      acquisition_cost: 8000,
      acquisition_date: "2025-01-01",
      depreciation_group: 1,
      depreciation_method: "rovnomerne",
    }

    const result = getDepreciationForYear(asset, 2026)
    expect(result).not.toBeNull()
    expect(result!.year).toBe(2026)
    expect(result!.tax_depreciation).toBe(2000) // 8000 / 4
  })

  it("should return null for year before acquisition", () => {
    const asset: AssetInput = {
      name: "Server",
      acquisition_cost: 8000,
      acquisition_date: "2025-01-01",
      depreciation_group: 1,
      depreciation_method: "rovnomerne",
    }

    const result = getDepreciationForYear(asset, 2024)
    expect(result).toBeNull()
  })
})

describe("DEPRECIATION_GROUPS", () => {
  it("should have all 7 groups defined", () => {
    expect(Object.keys(DEPRECIATION_GROUPS)).toHaveLength(7)
  })

  it("should have descriptions for all groups", () => {
    for (const [, group] of Object.entries(DEPRECIATION_GROUPS)) {
      expect(group.description).toBeTruthy()
      expect(group.useful_life).toBeGreaterThan(0)
    }
  })
})
