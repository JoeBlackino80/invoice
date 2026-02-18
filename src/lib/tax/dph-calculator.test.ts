import { describe, it, expect } from "vitest"
import { calculateDPH, type InvoiceWithItems } from "./dph-calculator"

function makeInvoice(overrides: Partial<InvoiceWithItems> & { invoice_items: any[] }): InvoiceWithItems {
  return {
    id: "test-id",
    type: "vydana",
    number: "FA2025001",
    issue_date: "2025-01-15",
    subtotal: 0,
    vat_amount: 0,
    total: 0,
    status: "odoslana",
    contact_id: null,
    ...overrides,
  }
}

describe("calculateDPH", () => {
  it("should return zero data for empty invoices", () => {
    const result = calculateDPH([], "2025-01-01", "2025-03-31")
    expect(result.output_vat_total).toBe(0)
    expect(result.input_vat_total).toBe(0)
    expect(result.own_tax_liability).toBe(0)
    expect(result.excess_deduction).toBe(0)
    expect(result.issued_invoice_count).toBe(0)
    expect(result.received_invoice_count).toBe(0)
  })

  it("should calculate output VAT at 23% correctly", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Služba", quantity: 1, unit_price: 1000,
          vat_rate: 23, subtotal: 1000, vat_amount: 230, total: 1230,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_23).toBe(1000)
    expect(result.output_vat_amount_23).toBe(230)
    expect(result.output_vat_total).toBe(230)
    expect(result.issued_invoice_count).toBe(1)
    expect(result.r01).toBe(1000)
    expect(result.r02).toBe(230)
  })

  it("should calculate output VAT at 19% correctly", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Tovar", quantity: 2, unit_price: 500,
          vat_rate: 19, subtotal: 1000, vat_amount: 190, total: 1190,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_19).toBe(1000)
    expect(result.output_vat_amount_19).toBe(190)
    expect(result.r03).toBe(1000)
    expect(result.r04).toBe(190)
  })

  it("should calculate output VAT at 5% correctly", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Knihy", quantity: 10, unit_price: 20,
          vat_rate: 5, subtotal: 200, vat_amount: 10, total: 210,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_5).toBe(200)
    expect(result.output_vat_amount_5).toBe(10)
    expect(result.r05).toBe(200)
    expect(result.r06).toBe(10)
  })

  it("should calculate input VAT from received invoices", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "prijata",
        invoice_items: [{
          id: "1", description: "Material", quantity: 1, unit_price: 2000,
          vat_rate: 23, subtotal: 2000, vat_amount: 460, total: 2460,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.input_vat_base_23).toBe(2000)
    expect(result.input_vat_amount_23).toBe(460)
    expect(result.input_vat_total).toBe(460)
    expect(result.received_invoice_count).toBe(1)
  })

  it("should calculate own tax liability when output > input", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Služba", quantity: 1, unit_price: 5000,
          vat_rate: 23, subtotal: 5000, vat_amount: 1150, total: 6150,
        }],
      }),
      makeInvoice({
        type: "prijata",
        invoice_items: [{
          id: "2", description: "Nákup", quantity: 1, unit_price: 1000,
          vat_rate: 23, subtotal: 1000, vat_amount: 230, total: 1230,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.own_tax_liability).toBe(920) // 1150 - 230
    expect(result.excess_deduction).toBe(0)
    expect(result.r30).toBe(920)
    expect(result.r31).toBe(0)
  })

  it("should calculate excess deduction when input > output", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Služba", quantity: 1, unit_price: 500,
          vat_rate: 23, subtotal: 500, vat_amount: 115, total: 615,
        }],
      }),
      makeInvoice({
        type: "prijata",
        invoice_items: [{
          id: "2", description: "Stroj", quantity: 1, unit_price: 10000,
          vat_rate: 23, subtotal: 10000, vat_amount: 2300, total: 12300,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.own_tax_liability).toBe(0)
    expect(result.excess_deduction).toBe(2185) // 2300 - 115
    expect(result.r31).toBe(2185)
  })

  it("should handle credit notes (dobropisy) by reducing output VAT", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [{
          id: "1", description: "Služba", quantity: 1, unit_price: 1000,
          vat_rate: 23, subtotal: 1000, vat_amount: 230, total: 1230,
        }],
      }),
      makeInvoice({
        type: "dobropis",
        invoice_items: [{
          id: "2", description: "Oprava", quantity: 1, unit_price: 200,
          vat_rate: 23, subtotal: 200, vat_amount: 46, total: 246,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_23).toBe(800) // 1000 - 200
    expect(result.output_vat_amount_23).toBe(184) // 230 - 46
  })

  it("should filter invoices by period", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        issue_date: "2025-01-15",
        invoice_items: [{
          id: "1", description: "Jan", quantity: 1, unit_price: 1000,
          vat_rate: 23, subtotal: 1000, vat_amount: 230, total: 1230,
        }],
      }),
      makeInvoice({
        type: "vydana",
        issue_date: "2025-04-15", // Outside Q1
        invoice_items: [{
          id: "2", description: "Apr", quantity: 1, unit_price: 2000,
          vat_rate: 23, subtotal: 2000, vat_amount: 460, total: 2460,
        }],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_23).toBe(1000) // Only Jan invoice
    expect(result.issued_invoice_count).toBe(1)
  })

  it("should handle multiple VAT rates in one invoice", () => {
    const invoices: InvoiceWithItems[] = [
      makeInvoice({
        type: "vydana",
        invoice_items: [
          { id: "1", description: "Služba", quantity: 1, unit_price: 1000, vat_rate: 23, subtotal: 1000, vat_amount: 230, total: 1230 },
          { id: "2", description: "Knihy", quantity: 5, unit_price: 10, vat_rate: 5, subtotal: 50, vat_amount: 2.5, total: 52.5 },
          { id: "3", description: "Potraviny", quantity: 1, unit_price: 100, vat_rate: 19, subtotal: 100, vat_amount: 19, total: 119 },
        ],
      }),
    ]

    const result = calculateDPH(invoices, "2025-01-01", "2025-03-31")
    expect(result.output_vat_base_23).toBe(1000)
    expect(result.output_vat_amount_23).toBe(230)
    expect(result.output_vat_base_5).toBe(50)
    expect(result.output_vat_amount_5).toBe(2.5)
    expect(result.output_vat_base_19).toBe(100)
    expect(result.output_vat_amount_19).toBe(19)
    expect(result.output_vat_total).toBe(251.5) // 230 + 2.5 + 19
  })
})
