import { describe, it, expect } from "vitest"
import { formatMoney, formatNumber, formatDate, formatICO, formatPercent } from "./format"

describe("formatMoney", () => {
  it("should format EUR amount in Slovak locale", () => {
    const result = formatMoney(1234.56)
    // Slovak format uses non-breaking space and comma for decimals
    expect(result).toContain("1")
    expect(result).toContain("234")
    expect(result).toContain("56")
  })

  it("should handle zero", () => {
    expect(formatMoney(0)).toContain("0")
  })

  it("should handle null/NaN gracefully", () => {
    expect(formatMoney(NaN)).toBe("0,00 €")
  })

  it("should support different currencies", () => {
    const result = formatMoney(100, "USD")
    expect(result).toContain("100")
  })
})

describe("formatNumber", () => {
  it("should format numbers with Slovak locale", () => {
    const result = formatNumber(1234.56)
    expect(result).toContain("1")
    expect(result).toContain("234")
    expect(result).toContain("56")
  })

  it("should handle custom decimal places", () => {
    const result = formatNumber(3.14159, 3)
    expect(result).toContain("142") // rounded to 3 decimals
  })

  it("should handle NaN", () => {
    expect(formatNumber(NaN)).toBe("0")
  })
})

describe("formatDate", () => {
  it("should format date in Slovak format (DD.MM.YYYY)", () => {
    const result = formatDate("2025-02-15")
    expect(result).toContain("15")
    expect(result).toContain("02")
    expect(result).toContain("2025")
  })

  it("should handle Date objects", () => {
    const result = formatDate(new Date(2025, 0, 1)) // Jan 1, 2025
    expect(result).toContain("01")
    expect(result).toContain("2025")
  })

  it("should return empty string for invalid dates", () => {
    expect(formatDate("")).toBe("")
    expect(formatDate("invalid")).toBe("")
  })
})

describe("formatICO", () => {
  it("should format 8-digit ICO with spaces", () => {
    expect(formatICO("12345678")).toBe("12 345 678")
  })

  it("should return original for non-8-digit input", () => {
    expect(formatICO("123")).toBe("123")
  })

  it("should handle empty input", () => {
    expect(formatICO("")).toBe("")
  })

  it("should strip existing spaces before formatting", () => {
    expect(formatICO("12 345 678")).toBe("12 345 678")
  })
})

describe("formatPercent", () => {
  it("should format percent with Slovak locale", () => {
    const result = formatPercent(12.5)
    expect(result).toContain("12")
    expect(result).toContain("5")
    expect(result).toContain("%")
  })
})
