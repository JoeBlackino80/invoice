/**
 * Suhrnny vykaz (SV) - EU Summary Declaration calculator
 * Calculates data for the EU Summary Declaration (recapitulative statement)
 * based on VAT-exempt intra-community supplies to EU customers.
 */

export interface SVRecord {
  ic_dph_customer: string  // IC DPH odberatela v EU
  customer_name: string
  country_code: string     // 2-letter EU country code
  total_value: number      // celkova hodnota dodavok
  supply_type: "goods" | "services" | "triangular"  // typ dodavky
}

export interface SVData {
  records: SVRecord[]
  total_goods: number
  total_services: number
  total_triangular: number
  grand_total: number
}

// EU member states (excluding SK)
const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SI", "ES", "SE",
]

interface InvoiceRecord {
  id: string
  type: string
  subtotal: number
  vat_amount: number
  total: number
  contact_id: string | null
  reverse_charge_text: string | null
  issue_date: string
  vat_rate?: number
}

interface ContactRecord {
  id: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  country: string | null
}

/**
 * Determine supply type based on invoice data.
 * - goods: physical products shipped intra-EU
 * - services: services provided to EU business
 * - triangular: triangular transaction (trojstranny obchod)
 *
 * Heuristic: if reverse_charge_text contains "trojstranny" or "triangular", it's triangular.
 * Otherwise, if reverse_charge_text contains "sluzb" or "service", it's a service.
 * Default is goods.
 */
function classifySupplyType(invoice: InvoiceRecord): "goods" | "services" | "triangular" {
  const text = (invoice.reverse_charge_text || "").toLowerCase()

  if (text.includes("trojstrann") || text.includes("triangul")) {
    return "triangular"
  }

  if (text.includes("sluzb") || text.includes("sluzby") || text.includes("service")) {
    return "services"
  }

  return "goods"
}

/**
 * Extract 2-letter country code from IC DPH.
 * IC DPH format: XX + numbers (e.g., CZ12345678, DE123456789)
 */
function extractCountryFromIcDph(icDph: string): string {
  const cleaned = icDph.replace(/\s/g, "").toUpperCase()
  if (cleaned.length >= 2) {
    return cleaned.substring(0, 2)
  }
  return ""
}

/**
 * Check if a contact is an EU customer (not SK) with valid IC DPH.
 */
function isEuCustomer(contact: ContactRecord): boolean {
  if (!contact.ic_dph) return false

  const countryCode = extractCountryFromIcDph(contact.ic_dph)

  // Must be an EU country, but not Slovakia
  return EU_COUNTRY_CODES.includes(countryCode)
}

/**
 * Calculate SV (Suhrnny vykaz) data from invoices and contacts.
 *
 * Filters for:
 * - vydane (issued) invoices
 * - EU customers with valid IC DPH
 * - VAT-exempt supplies (vat_amount === 0 or reverse_charge)
 * - Within the given period
 */
export function calculateSV(
  invoices: InvoiceRecord[],
  contacts: ContactRecord[],
  periodFrom: string,
  periodTo: string
): SVData {
  // Build contacts map
  const contactsMap = new Map<string, ContactRecord>()
  for (const contact of contacts) {
    contactsMap.set(contact.id, contact)
  }

  // Filter relevant invoices
  const relevantInvoices = invoices.filter((inv) => {
    // Only issued invoices (vydane)
    if (inv.type !== "vydana") return false

    // Must be within period
    if (inv.issue_date < periodFrom || inv.issue_date > periodTo) return false

    // Must have a contact
    if (!inv.contact_id) return false

    const contact = contactsMap.get(inv.contact_id)
    if (!contact) return false

    // Contact must be EU customer
    if (!isEuCustomer(contact)) return false

    // Must be VAT-exempt (reverse charge) - vat_amount is 0 or has reverse_charge_text
    if (inv.vat_amount !== 0 && !inv.reverse_charge_text) return false

    return true
  })

  // Group by customer IC DPH + supply type
  const groupKey = (icDph: string, supplyType: string) => `${icDph}|${supplyType}`

  const groups = new Map<string, {
    ic_dph_customer: string
    customer_name: string
    country_code: string
    total_value: number
    supply_type: "goods" | "services" | "triangular"
  }>()

  for (const invoice of relevantInvoices) {
    const contact = contactsMap.get(invoice.contact_id!)!
    const icDph = contact.ic_dph!.replace(/\s/g, "").toUpperCase()
    const supplyType = classifySupplyType(invoice)
    const key = groupKey(icDph, supplyType)

    if (groups.has(key)) {
      groups.get(key)!.total_value += invoice.subtotal
    } else {
      const countryCode = extractCountryFromIcDph(icDph)
      groups.set(key, {
        ic_dph_customer: icDph,
        customer_name: contact.name,
        country_code: countryCode,
        total_value: invoice.subtotal,
        supply_type: supplyType,
      })
    }
  }

  const records: SVRecord[] = Array.from(groups.values()).map((g) => ({
    ic_dph_customer: g.ic_dph_customer,
    customer_name: g.customer_name,
    country_code: g.country_code,
    total_value: Math.round(g.total_value * 100) / 100,
    supply_type: g.supply_type,
  }))

  // Sort by country code, then by IC DPH
  records.sort((a, b) => {
    if (a.country_code !== b.country_code) return a.country_code.localeCompare(b.country_code)
    return a.ic_dph_customer.localeCompare(b.ic_dph_customer)
  })

  const total_goods = records
    .filter((r) => r.supply_type === "goods")
    .reduce((sum, r) => sum + r.total_value, 0)

  const total_services = records
    .filter((r) => r.supply_type === "services")
    .reduce((sum, r) => sum + r.total_value, 0)

  const total_triangular = records
    .filter((r) => r.supply_type === "triangular")
    .reduce((sum, r) => sum + r.total_value, 0)

  const grand_total = total_goods + total_services + total_triangular

  return {
    records,
    total_goods: Math.round(total_goods * 100) / 100,
    total_services: Math.round(total_services * 100) / 100,
    total_triangular: Math.round(total_triangular * 100) / 100,
    grand_total: Math.round(grand_total * 100) / 100,
  }
}
