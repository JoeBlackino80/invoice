import { describe, it, expect } from "vitest"
import { invoiceSchema, invoiceItemSchema } from "./invoice"

describe("invoiceItemSchema", () => {
  it("should validate a complete item", () => {
    const item = {
      description: "Služba IT",
      quantity: 2,
      unit: "hod",
      unit_price: 50,
      vat_rate: 23,
    }
    const result = invoiceItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it("should use defaults for optional fields", () => {
    const item = {
      description: "Služba",
      unit_price: 100,
    }
    const result = invoiceItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
      expect(result.data.unit).toBe("ks")
      expect(result.data.vat_rate).toBe(23)
    }
  })

  it("should fail without description", () => {
    const item = { unit_price: 100 }
    const result = invoiceItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it("should fail without unit_price", () => {
    const item = { description: "Služba" }
    const result = invoiceItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })
})

describe("invoiceSchema", () => {
  const validInvoice = {
    type: "vydana" as const,
    issue_date: "2025-01-15",
    delivery_date: "2025-01-15",
    due_date: "2025-01-29",
    items: [{ description: "Služba", unit_price: 100 }],
  }

  it("should validate a complete invoice", () => {
    const result = invoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it("should use default type 'vydana'", () => {
    const invoice = { ...validInvoice }
    delete (invoice as any).type
    const result = invoiceSchema.safeParse(invoice)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("vydana")
    }
  })

  it("should reject invalid invoice types", () => {
    const invoice = { ...validInvoice, type: "neplatny" }
    const result = invoiceSchema.safeParse(invoice)
    expect(result.success).toBe(false)
  })

  it("should require at least one item", () => {
    const invoice = { ...validInvoice, items: [] }
    const result = invoiceSchema.safeParse(invoice)
    expect(result.success).toBe(false)
  })

  it("should require issue_date", () => {
    const { issue_date, ...invoice } = validInvoice
    const result = invoiceSchema.safeParse(invoice)
    expect(result.success).toBe(false)
  })

  it("should accept all valid invoice types", () => {
    for (const type of ["vydana", "prijata", "zalohova", "dobropis", "proforma"]) {
      const invoice = { ...validInvoice, type }
      const result = invoiceSchema.safeParse(invoice)
      expect(result.success).toBe(true)
    }
  })

  it("should accept optional fields", () => {
    const invoice = {
      ...validInvoice,
      contact_id: "contact-123",
      variable_symbol: "2025001",
      constant_symbol: "0308",
      specific_symbol: "123456",
      reverse_charge: true,
      reverse_charge_text: "Prenos daňovej povinnosti podľa §69",
      notes: "Poznámka",
      internal_notes: "Interná poznámka",
    }
    const result = invoiceSchema.safeParse(invoice)
    expect(result.success).toBe(true)
  })
})
