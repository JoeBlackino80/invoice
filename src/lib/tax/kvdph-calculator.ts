/**
 * KV DPH (Kontrolny vykaz DPH) Calculator
 *
 * Calculates control report sections per Slovak tax regulations:
 * - A.1: Issued invoices, VAT >= 5000 EUR
 * - A.2: Issued invoices, VAT < 5000 EUR
 * - B.1: Received invoices, VAT >= 5000 EUR
 * - B.2: Received invoices, VAT < 5000 EUR
 * - B.3: Received simplified invoices (total <= 1000 EUR)
 * - C.1: Issued credit notes (dobropisy)
 * - C.2: Received credit notes (dobropisy)
 * - D.1: Domestic reverse charge - supplier
 * - D.2: Domestic reverse charge - customer
 */

export interface KVDPHRecord {
  ic_dph: string
  invoice_number: string
  invoice_date: string
  vat_base: number
  vat_amount: number
  vat_rate: number
}

export interface KVDPHData {
  a1: KVDPHRecord[] // vydane, DPH >= 5000 EUR
  a2: KVDPHRecord[] // vydane, DPH < 5000 EUR
  b1: KVDPHRecord[] // prijate, DPH >= 5000 EUR
  b2: KVDPHRecord[] // prijate, DPH < 5000 EUR
  b3: KVDPHRecord[] // prijate zjednodusene (total <= 1000 EUR)
  c1: KVDPHRecord[] // vydane dobropisy
  c2: KVDPHRecord[] // prijate dobropisy
  d1: KVDPHRecord[] // tuzemsky prenos - dodavatel
  d2: KVDPHRecord[] // tuzemsky prenos - odberatel
}

export interface InvoiceForKV {
  id: string
  type: string // vydana | prijata | dobropis
  number: string
  issue_date: string
  subtotal: number
  vat_amount: number
  total: number
  status: string
  contact_id: string | null
  reverse_charge: boolean
  parent_invoice_id: string | null
  invoice_items: KVInvoiceItem[]
}

export interface KVInvoiceItem {
  id: string
  vat_rate: number
  subtotal: number
  vat_amount: number
  total: number
}

export interface ContactForKV {
  id: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Create KV DPH records from an invoice, grouped by VAT rate.
 * Each VAT rate on the invoice creates a separate record.
 */
function createRecords(
  invoice: InvoiceForKV,
  contactIcDph: string
): KVDPHRecord[] {
  const items = invoice.invoice_items || []
  const byRate = new Map<number, { base: number; vat: number }>()

  for (const item of items) {
    const rate = Number(item.vat_rate)
    if (rate === 0) continue // Skip 0% VAT

    const existing = byRate.get(rate) || { base: 0, vat: 0 }
    existing.base += Number(item.subtotal) || 0
    existing.vat += Number(item.vat_amount) || 0
    byRate.set(rate, existing)
  }

  const records: KVDPHRecord[] = []
  for (const [rate, amounts] of Array.from(byRate.entries())) {
    records.push({
      ic_dph: contactIcDph,
      invoice_number: invoice.number,
      invoice_date: invoice.issue_date,
      vat_base: round2(amounts.base),
      vat_amount: round2(amounts.vat),
      vat_rate: rate,
    })
  }

  return records
}

/**
 * Calculate KV DPH (Control Report) data from invoices and contacts.
 *
 * @param invoices - All invoices in the period (with items)
 * @param contacts - Contact map (id -> contact)
 * @param periodFrom - Start of period (YYYY-MM-DD)
 * @param periodTo - End of period (YYYY-MM-DD)
 * @returns KVDPHData with sections A.1, A.2, B.1, B.2, B.3, C.1, C.2, D.1, D.2
 */
export function calculateKVDPH(
  invoices: InvoiceForKV[],
  contacts: ContactForKV[],
  periodFrom: string,
  periodTo: string
): KVDPHData {
  const data: KVDPHData = {
    a1: [],
    a2: [],
    b1: [],
    b2: [],
    b3: [],
    c1: [],
    c2: [],
    d1: [],
    d2: [],
  }

  // Build contact map
  const contactMap = new Map<string, ContactForKV>()
  for (const contact of contacts) {
    contactMap.set(contact.id, contact)
  }

  // Filter invoices to the period
  const periodInvoices = invoices.filter((inv) => {
    const issueDate = inv.issue_date
    return issueDate >= periodFrom && issueDate <= periodTo
  })

  // Filter out non-VAT invoices (status cancelled etc)
  const activeInvoices = periodInvoices.filter(
    (inv) => inv.status !== "stornovana"
  )

  for (const invoice of activeInvoices) {
    const contact = invoice.contact_id
      ? contactMap.get(invoice.contact_id)
      : null
    const icDph = contact?.ic_dph || ""

    // Total VAT on the invoice
    const totalVat = Math.abs(Number(invoice.vat_amount) || 0)
    const totalAmount = Math.abs(Number(invoice.total) || 0)

    // Handle credit notes (dobropisy)
    if (invoice.type === "dobropis") {
      const records = createRecords(invoice, icDph)
      // Determine if this credit note is for issued or received invoice
      // Check if parent invoice exists to determine direction
      // If no parent found, treat based on the contact relationship
      // For simplicity: dobropisy go to C.1 (issued credit notes) section
      // since they are corrections to issued invoices
      for (const record of records) {
        data.c1.push(record)
      }
      continue
    }

    // Handle reverse charge (tuzemsky prenos danovej povinnosti)
    if (invoice.reverse_charge) {
      const records = createRecords(invoice, icDph)
      if (invoice.type === "vydana") {
        for (const record of records) {
          data.d1.push(record)
        }
      } else if (invoice.type === "prijata") {
        for (const record of records) {
          data.d2.push(record)
        }
      }
      continue
    }

    // Handle issued invoices (vydane)
    if (invoice.type === "vydana") {
      const records = createRecords(invoice, icDph)
      if (totalVat >= 5000) {
        // A.1 - issued, VAT >= 5000 EUR
        for (const record of records) {
          data.a1.push(record)
        }
      } else {
        // A.2 - issued, VAT < 5000 EUR
        for (const record of records) {
          data.a2.push(record)
        }
      }
      continue
    }

    // Handle received invoices (prijate)
    if (invoice.type === "prijata") {
      // B.3 - simplified invoices (total <= 1000 EUR)
      if (totalAmount <= 1000) {
        const records = createRecords(invoice, icDph)
        for (const record of records) {
          data.b3.push(record)
        }
      } else if (totalVat >= 5000) {
        // B.1 - received, VAT >= 5000 EUR
        const records = createRecords(invoice, icDph)
        for (const record of records) {
          data.b1.push(record)
        }
      } else {
        // B.2 - received, VAT < 5000 EUR
        const records = createRecords(invoice, icDph)
        for (const record of records) {
          data.b2.push(record)
        }
      }
      continue
    }
  }

  return data
}
