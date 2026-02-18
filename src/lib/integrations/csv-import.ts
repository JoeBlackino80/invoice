// Universal CSV Import with Column Mapping

// ============ Types ============

export interface ParsedCSV {
  headers: string[]
  rows: string[][]
  rowCount: number
  delimiter: string
}

export interface ColumnMapping {
  csvColumn: string
  csvIndex: number
  targetField: string
  transform?: (value: string) => any
  required?: boolean
  autoMapped?: boolean
}

export interface ImportValidation {
  valid: boolean
  totalRows: number
  validRows: number
  errors: ImportError[]
  warnings: string[]
}

export interface ImportError {
  row: number
  column: string
  value: string
  message: string
}

export interface ImportResult {
  success: number
  failed: number
  errors: ImportError[]
  importedIds: string[]
}

export type EntityType = "invoices" | "contacts" | "products" | "journal_entries" | "employees"

// Entity field definitions for mapping
export const ENTITY_FIELDS: Record<EntityType, Array<{ field: string; label: string; required: boolean; type: string }>> = {
  invoices: [
    { field: "number", label: "Cislo faktury", required: true, type: "string" },
    { field: "type", label: "Typ (vydana/prijata)", required: false, type: "string" },
    { field: "issue_date", label: "Datum vystavenia", required: true, type: "date" },
    { field: "due_date", label: "Datum splatnosti", required: true, type: "date" },
    { field: "tax_date", label: "Datum zdanitelneho plnenia", required: false, type: "date" },
    { field: "variable_symbol", label: "Variabilny symbol", required: false, type: "string" },
    { field: "constant_symbol", label: "Konstantny symbol", required: false, type: "string" },
    { field: "contact_name", label: "Nazov odberatela", required: false, type: "string" },
    { field: "contact_ico", label: "ICO odberatela", required: false, type: "string" },
    { field: "description", label: "Popis", required: false, type: "string" },
    { field: "total_without_vat", label: "Suma bez DPH", required: true, type: "number" },
    { field: "total_vat", label: "DPH", required: false, type: "number" },
    { field: "total_with_vat", label: "Suma s DPH", required: true, type: "number" },
    { field: "currency", label: "Mena", required: false, type: "string" },
    { field: "payment_method", label: "Sposob platby", required: false, type: "string" },
    { field: "note", label: "Poznamka", required: false, type: "string" },
  ],
  contacts: [
    { field: "name", label: "Nazov/Meno", required: true, type: "string" },
    { field: "ico", label: "ICO", required: false, type: "string" },
    { field: "dic", label: "DIC", required: false, type: "string" },
    { field: "ic_dph", label: "IC DPH", required: false, type: "string" },
    { field: "street", label: "Ulica", required: false, type: "string" },
    { field: "city", label: "Mesto", required: false, type: "string" },
    { field: "zip", label: "PSC", required: false, type: "string" },
    { field: "country", label: "Krajina", required: false, type: "string" },
    { field: "email", label: "Email", required: false, type: "string" },
    { field: "phone", label: "Telefon", required: false, type: "string" },
    { field: "web", label: "Web", required: false, type: "string" },
    { field: "bank_account", label: "Cislo uctu", required: false, type: "string" },
    { field: "iban", label: "IBAN", required: false, type: "string" },
    { field: "note", label: "Poznamka", required: false, type: "string" },
    { field: "type", label: "Typ (firma/osoba)", required: false, type: "string" },
  ],
  products: [
    { field: "code", label: "Kod produktu", required: false, type: "string" },
    { field: "name", label: "Nazov", required: true, type: "string" },
    { field: "description", label: "Popis", required: false, type: "string" },
    { field: "unit", label: "Jednotka", required: false, type: "string" },
    { field: "unit_price", label: "Jednotkova cena", required: true, type: "number" },
    { field: "vat_rate", label: "Sadzba DPH (%)", required: false, type: "number" },
    { field: "ean", label: "EAN", required: false, type: "string" },
    { field: "sku", label: "SKU", required: false, type: "string" },
    { field: "category", label: "Kategoria", required: false, type: "string" },
    { field: "stock_quantity", label: "Mnozstvo na sklade", required: false, type: "number" },
  ],
  journal_entries: [
    { field: "number", label: "Cislo dokladu", required: false, type: "string" },
    { field: "date", label: "Datum", required: true, type: "date" },
    { field: "description", label: "Popis", required: true, type: "string" },
    { field: "debit_account", label: "Ucet MD", required: true, type: "string" },
    { field: "credit_account", label: "Ucet DAL", required: true, type: "string" },
    { field: "amount", label: "Suma", required: true, type: "number" },
    { field: "variable_symbol", label: "Variabilny symbol", required: false, type: "string" },
    { field: "document_type", label: "Typ dokladu", required: false, type: "string" },
  ],
  employees: [
    { field: "first_name", label: "Meno", required: true, type: "string" },
    { field: "last_name", label: "Priezvisko", required: true, type: "string" },
    { field: "personal_number", label: "Osobne cislo", required: false, type: "string" },
    { field: "date_of_birth", label: "Datum narodenia", required: false, type: "date" },
    { field: "email", label: "Email", required: false, type: "string" },
    { field: "phone", label: "Telefon", required: false, type: "string" },
    { field: "street", label: "Ulica", required: false, type: "string" },
    { field: "city", label: "Mesto", required: false, type: "string" },
    { field: "zip", label: "PSC", required: false, type: "string" },
    { field: "position", label: "Pozicia", required: false, type: "string" },
    { field: "department", label: "Oddelenie", required: false, type: "string" },
    { field: "hire_date", label: "Datum nastupu", required: false, type: "date" },
    { field: "gross_salary", label: "Hruba mzda", required: false, type: "number" },
    { field: "bank_account", label: "Cislo uctu", required: false, type: "string" },
    { field: "iban", label: "IBAN", required: false, type: "string" },
  ],
}

// ============ CSV Parsing ============

export function detectDelimiter(content: string): string {
  const firstLines = content.split("\n").slice(0, 5).join("\n")

  const delimiters = [
    { char: ";", count: 0 },
    { char: ",", count: 0 },
    { char: "\t", count: 0 },
    { char: "|", count: 0 },
  ]

  for (const d of delimiters) {
    // Count occurrences outside of quoted strings
    let inQuotes = false
    for (const ch of firstLines) {
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === d.char && !inQuotes) {
        d.count++
      }
    }
  }

  // Sort by count descending
  delimiters.sort((a, b) => b.count - a.count)

  // Return the most common delimiter, default to semicolon (common in SK/CZ)
  return delimiters[0].count > 0 ? delimiters[0].char : ";"
}

export function parseCSV(content: string, delimiter?: string): ParsedCSV {
  const detectedDelimiter = delimiter || detectDelimiter(content)
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")

  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0, delimiter: detectedDelimiter }
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      const nextCh = i + 1 < line.length ? line[i + 1] : ""

      if (inQuotes) {
        if (ch === '"' && nextCh === '"') {
          current += '"'
          i++ // skip next quote
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === detectedDelimiter) {
          result.push(current.trim())
          current = ""
        } else {
          current += ch
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows: string[][] = []

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i])
    // Pad short rows, trim long rows
    while (row.length < headers.length) row.push("")
    rows.push(row.slice(0, headers.length))
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    delimiter: detectedDelimiter,
  }
}

// ============ Column Detection ============

// Common header name mappings (SK, CZ, EN variations)
const HEADER_MAPPINGS: Record<string, string[]> = {
  // Invoices
  number: ["cislo", "number", "invoice_number", "cislo_faktury", "faktura", "doklad", "cislo_dokladu"],
  issue_date: ["datum_vystavenia", "issue_date", "date", "datum", "vystavene", "vystavena"],
  due_date: ["datum_splatnosti", "due_date", "splatnost", "splatna"],
  tax_date: ["datum_zdanitelneho_plnenia", "tax_date", "duzp", "dph_datum", "datum_dph"],
  variable_symbol: ["variabilny_symbol", "vs", "var_symbol", "variable_symbol"],
  constant_symbol: ["konstantny_symbol", "ks", "const_symbol", "constant_symbol"],
  total_without_vat: ["suma_bez_dph", "zaklad", "base", "bez_dph", "netto", "total_without_vat", "zaklad_dane"],
  total_vat: ["dph", "vat", "dan", "total_vat"],
  total_with_vat: ["suma_s_dph", "celkom", "total", "brutto", "total_with_vat", "spolu"],
  currency: ["mena", "currency", "curr"],
  payment_method: ["sposob_platby", "platba", "payment", "payment_method"],

  // Contacts
  name: ["nazov", "name", "firma", "company", "meno", "obchodne_meno"],
  ico: ["ico", "ic", "company_id", "registration_number"],
  dic: ["dic", "tax_id", "dic_cislo"],
  ic_dph: ["ic_dph", "vat_id", "icdph"],
  street: ["ulica", "street", "adresa", "address"],
  city: ["mesto", "city", "obec"],
  zip: ["psc", "zip", "postal_code", "zip_code"],
  country: ["krajina", "country", "stat"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefon", "phone", "tel", "mobil", "mobile"],
  web: ["web", "website", "www", "url"],
  bank_account: ["cislo_uctu", "ucet", "bank_account", "account"],
  iban: ["iban"],
  note: ["poznamka", "note", "notes", "pozn"],

  // Products
  code: ["kod", "code", "product_code", "kod_produktu"],
  description: ["popis", "description", "text", "poznamka_popis"],
  unit: ["jednotka", "unit", "mj"],
  unit_price: ["cena", "price", "unit_price", "jednotkova_cena", "cena_za_jednotku"],
  vat_rate: ["sadzba_dph", "vat_rate", "dph_sadzba", "dph_percento"],
  ean: ["ean", "barcode", "ciarkovy_kod"],
  sku: ["sku", "katalogove_cislo"],
  category: ["kategoria", "category", "skupina"],
  stock_quantity: ["mnozstvo", "quantity", "sklad", "stock", "ks"],

  // Journal entries
  debit_account: ["md", "debit", "ucet_md", "debit_account", "ma_dat"],
  credit_account: ["dal", "credit", "ucet_dal", "credit_account"],
  amount: ["suma", "amount", "castka", "hodnota"],
  document_type: ["typ_dokladu", "document_type", "typ"],

  // Employees
  first_name: ["meno", "first_name", "krstne_meno"],
  last_name: ["priezvisko", "last_name", "surname"],
  personal_number: ["osobne_cislo", "personal_number", "id_zamestnanca"],
  date_of_birth: ["datum_narodenia", "date_of_birth", "nar"],
  position: ["pozicia", "position", "funkcia", "pracovna_pozicia"],
  department: ["oddelenie", "department", "stredisko"],
  hire_date: ["datum_nastupu", "hire_date", "nastup"],
  gross_salary: ["hruba_mzda", "gross_salary", "mzda", "plat"],
  type: ["typ", "type", "druh"],
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

export function detectColumns(headers: string[], entityType?: EntityType): ColumnMapping[] {
  const mappings: ColumnMapping[] = []

  const availableFields = entityType ? ENTITY_FIELDS[entityType] : []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const normalized = normalizeHeader(header)

    let matchedField = ""
    let isAutoMapped = false

    // Try to find a match
    for (const [field, aliases] of Object.entries(HEADER_MAPPINGS)) {
      if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        // Verify this field exists for the entity type if specified
        if (!entityType || availableFields.some((f) => f.field === field)) {
          matchedField = field
          isAutoMapped = true
          break
        }
      }
    }

    // Exact match with field name
    if (!matchedField && entityType) {
      const exactMatch = availableFields.find(
        (f) => normalizeHeader(f.field) === normalized || normalizeHeader(f.label) === normalized
      )
      if (exactMatch) {
        matchedField = exactMatch.field
        isAutoMapped = true
      }
    }

    mappings.push({
      csvColumn: header,
      csvIndex: i,
      targetField: matchedField || "",
      autoMapped: isAutoMapped,
    })
  }

  return mappings
}

// ============ Validation ============

export function validateImportData(
  rows: string[][],
  mapping: ColumnMapping[],
  entityType: EntityType
): ImportValidation {
  const errors: ImportError[] = []
  const warnings: string[] = []
  const fields = ENTITY_FIELDS[entityType]
  let validRows = 0

  // Check required fields are mapped
  const requiredFields = fields.filter((f) => f.required)
  for (const req of requiredFields) {
    const mapped = mapping.find((m) => m.targetField === req.field)
    if (!mapped) {
      warnings.push(`Povinne pole "${req.label}" nie je namapovane`)
    }
  }

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]
    let rowValid = true

    for (const m of mapping) {
      if (!m.targetField) continue

      const value = row[m.csvIndex] || ""
      const fieldDef = fields.find((f) => f.field === m.targetField)

      if (!fieldDef) continue

      // Check required
      if (fieldDef.required && !value.trim()) {
        errors.push({
          row: rowIdx + 2, // +1 for header, +1 for 1-based
          column: m.csvColumn,
          value,
          message: `Povinne pole "${fieldDef.label}" je prazdne`,
        })
        rowValid = false
        continue
      }

      if (!value.trim()) continue

      // Type validation
      if (fieldDef.type === "number") {
        const num = parseFloat(value.replace(",", ".").replace(/\s/g, ""))
        if (isNaN(num)) {
          errors.push({
            row: rowIdx + 2,
            column: m.csvColumn,
            value,
            message: `"${fieldDef.label}" musi byt cislo`,
          })
          rowValid = false
        }
      }

      if (fieldDef.type === "date") {
        // Accept common date formats
        const datePatterns = [
          /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
          /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
          /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY or MM/DD/YYYY
          /^\d{1,2}\.\d{1,2}\.\d{4}$/, // D.M.YYYY
        ]
        const isValidDate = datePatterns.some((p) => p.test(value.trim()))
        if (!isValidDate) {
          errors.push({
            row: rowIdx + 2,
            column: m.csvColumn,
            value,
            message: `"${fieldDef.label}" ma neplatny format datumu (ocakava sa YYYY-MM-DD alebo DD.MM.YYYY)`,
          })
          rowValid = false
        }
      }
    }

    if (rowValid) validRows++
  }

  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRows,
    errors,
    warnings,
  }
}

// ============ Data Transform Helpers ============

function parseDate(value: string): string {
  const trimmed = value.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // DD.MM.YYYY or D.M.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, "0")
    const month = dotMatch[2].padStart(2, "0")
    return `${dotMatch[3]}-${month}-${day}`
  }

  // DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0")
    const month = slashMatch[2].padStart(2, "0")
    return `${slashMatch[3]}-${month}-${day}`
  }

  return trimmed
}

function parseNumber(value: string): number {
  if (!value) return 0
  return parseFloat(value.replace(",", ".").replace(/\s/g, "")) || 0
}

function getMappedValue(row: string[], mapping: ColumnMapping[], field: string): string {
  const m = mapping.find((cm) => cm.targetField === field)
  if (!m) return ""
  const value = row[m.csvIndex] || ""
  if (m.transform) return m.transform(value)
  return value.trim()
}

// ============ Import ============

export async function importData(
  rows: string[][],
  mapping: ColumnMapping[],
  entityType: EntityType,
  companyId: string,
  supabase: any
): Promise<ImportResult> {
  const errors: ImportError[] = []
  let success = 0
  let failed = 0
  const importedIds: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    try {
      let record: Record<string, any> = { company_id: companyId }

      // Build record from mapping
      const fields = ENTITY_FIELDS[entityType]
      for (const m of mapping) {
        if (!m.targetField) continue
        const value = row[m.csvIndex] || ""
        if (!value.trim()) continue

        const fieldDef = fields.find((f) => f.field === m.targetField)
        if (!fieldDef) continue

        let parsedValue: any = value.trim()
        if (m.transform) {
          parsedValue = m.transform(value)
        } else if (fieldDef.type === "number") {
          parsedValue = parseNumber(value)
        } else if (fieldDef.type === "date") {
          parsedValue = parseDate(value)
        }

        record[m.targetField] = parsedValue
      }

      // Insert based on entity type
      let tableName: string
      let insertData: Record<string, any>

      switch (entityType) {
        case "contacts": {
          tableName = "contacts"
          insertData = {
            company_id: companyId,
            name: record.name || "",
            ico: record.ico || null,
            dic: record.dic || null,
            ic_dph: record.ic_dph || null,
            street: record.street || null,
            city: record.city || null,
            zip: record.zip || null,
            country: record.country || "SK",
            email: record.email || null,
            phone: record.phone || null,
            web: record.web || null,
            bank_account: record.bank_account || null,
            iban: record.iban || null,
            note: record.note || null,
          }
          break
        }
        case "invoices": {
          tableName = "invoices"
          insertData = {
            company_id: companyId,
            number: record.number || "",
            type: record.type || "issued",
            status: "draft",
            issue_date: record.issue_date || new Date().toISOString().split("T")[0],
            due_date: record.due_date || new Date().toISOString().split("T")[0],
            tax_date: record.tax_date || record.issue_date || new Date().toISOString().split("T")[0],
            variable_symbol: record.variable_symbol || null,
            constant_symbol: record.constant_symbol || null,
            currency: record.currency || "EUR",
            payment_method: record.payment_method || "bank_transfer",
            total_without_vat: record.total_without_vat || 0,
            total_vat: record.total_vat || 0,
            total_with_vat: record.total_with_vat || 0,
            notes: record.note || record.description || null,
          }
          break
        }
        case "products": {
          tableName = "products"
          insertData = {
            company_id: companyId,
            code: record.code || null,
            name: record.name || "",
            description: record.description || null,
            unit: record.unit || "ks",
            unit_price: record.unit_price || 0,
            vat_rate: record.vat_rate || 20,
            ean: record.ean || null,
            sku: record.sku || null,
            category: record.category || null,
          }
          break
        }
        case "journal_entries": {
          tableName = "journal_entries"
          insertData = {
            company_id: companyId,
            number: record.number || null,
            date: record.date || new Date().toISOString().split("T")[0],
            description: record.description || "",
            debit_account: record.debit_account || "",
            credit_account: record.credit_account || "",
            amount: record.amount || 0,
            variable_symbol: record.variable_symbol || null,
            document_type: record.document_type || "internal",
            status: "draft",
          }
          break
        }
        case "employees": {
          tableName = "employees"
          insertData = {
            company_id: companyId,
            first_name: record.first_name || "",
            last_name: record.last_name || "",
            personal_number: record.personal_number || null,
            date_of_birth: record.date_of_birth || null,
            email: record.email || null,
            phone: record.phone || null,
            street: record.street || null,
            city: record.city || null,
            zip: record.zip || null,
            position: record.position || null,
            department: record.department || null,
            hire_date: record.hire_date || null,
            gross_salary: record.gross_salary || null,
            bank_account: record.bank_account || null,
            iban: record.iban || null,
          }
          break
        }
        default:
          throw new Error(`Nepodporovany typ entity: ${entityType}`)
      }

      const { data, error } = await (supabase.from(tableName) as any)
        .insert(insertData)
        .select("id")
        .single() as { data: any; error: any }

      if (error) {
        errors.push({
          row: rowNum,
          column: "",
          value: "",
          message: `Chyba pri ukladani: ${error.message}`,
        })
        failed++
      } else {
        success++
        if (data?.id) importedIds.push(data.id)
      }
    } catch (err: any) {
      errors.push({
        row: rowNum,
        column: "",
        value: "",
        message: `Neocakavana chyba: ${err.message || "unknown"}`,
      })
      failed++
    }
  }

  return { success, failed, errors, importedIds }
}
