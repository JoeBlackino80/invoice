/**
 * CSV parser for Slovak bank statement formats.
 *
 * Supports:
 *  - Auto-detection of delimiter (comma, semicolon, tab)
 *  - Slovak date formats (DD.MM.YYYY, DD/MM/YYYY)
 *  - Slovak number formats (comma as decimal separator, space as thousands separator)
 *  - Default column mappings for Tatra banka, VUB, Slovenska sporitelna
 */

export interface ParsedTransaction {
  date: string // ISO date YYYY-MM-DD
  amount: number // positive = credit, negative = debit
  type: "credit" | "debit"
  counterparty_name: string
  counterparty_iban: string
  variable_symbol: string
  constant_symbol: string
  specific_symbol: string
  description: string
  reference: string
  raw_row: Record<string, string>
}

export interface ColumnMapping {
  date?: string
  amount?: string
  credit?: string
  debit?: string
  counterparty_name?: string
  counterparty_iban?: string
  variable_symbol?: string
  constant_symbol?: string
  specific_symbol?: string
  description?: string
  reference?: string
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  errors: { row: number; message: string }[]
  totalRows: number
}

// Default column mappings for common Slovak banks
const TATRA_BANKA_MAPPING: ColumnMapping = {
  date: "Dátum",
  amount: "Suma",
  counterparty_name: "Názov protiúčtu",
  counterparty_iban: "Protiúčet",
  variable_symbol: "Variabilný symbol",
  constant_symbol: "Konštantný symbol",
  specific_symbol: "Špecifický symbol",
  description: "Popis transakcie",
  reference: "Referencia",
}

const VUB_MAPPING: ColumnMapping = {
  date: "Dátum zaúčtovania",
  amount: "Suma",
  counterparty_name: "Meno protistrany",
  counterparty_iban: "IBAN protistrany",
  variable_symbol: "VS",
  constant_symbol: "KS",
  specific_symbol: "SS",
  description: "Popis",
  reference: "Referencia platby",
}

const SLSP_MAPPING: ColumnMapping = {
  date: "Dátum",
  amount: "Čiastka",
  counterparty_name: "Názov účtu príjemcu",
  counterparty_iban: "Číslo účtu príjemcu",
  variable_symbol: "Variabilný symbol",
  constant_symbol: "Konštantný symbol",
  specific_symbol: "Špecifický symbol",
  description: "Správa pre príjemcu",
  reference: "Referencia",
}

// Alternative column name variants to try (case-insensitive partial matching)
const COLUMN_VARIANTS: Record<keyof ColumnMapping, string[]> = {
  date: ["datum", "date", "dátum zaúčtovania", "dátum spracovania", "dátum", "datum uctovani", "datum zauctovani"],
  amount: ["suma", "amount", "čiastka", "castka", "ciastka", "celková suma"],
  credit: ["kredit", "credit", "príjem", "prijem", "má dať"],
  debit: ["debet", "debit", "výdaj", "vydaj", "dal"],
  counterparty_name: ["nazov protiuctu", "meno protistrany", "nazov uctu prijemcu", "protiucet nazov", "název protiúčtu", "meno", "counterparty"],
  counterparty_iban: ["protiucet", "iban protistrany", "cislo uctu prijemcu", "iban", "protiúčet", "číslo účtu"],
  variable_symbol: ["variabilny symbol", "variabilný symbol", "vs", "variable symbol"],
  constant_symbol: ["konstantny symbol", "konštantný symbol", "ks", "constant symbol"],
  specific_symbol: ["specificky symbol", "špecifický symbol", "ss", "specific symbol"],
  description: ["popis", "popis transakcie", "sprava pre prijemcu", "sprava", "description", "poznámka", "poznamka", "správa"],
  reference: ["referencia", "reference", "referencia platby", "ref"],
}

/**
 * Detect the delimiter used in a CSV text.
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 5).join("\n")

  const semicolonCount = (firstLines.match(/;/g) || []).length
  const commaCount = (firstLines.match(/,/g) || []).length
  const tabCount = (firstLines.match(/\t/g) || []).length

  if (tabCount > semicolonCount && tabCount > commaCount) return "\t"
  if (semicolonCount > commaCount) return ";"
  return ","
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Parse a Slovak-formatted date string to ISO format.
 * Supports DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
 */
function parseSlovakDate(dateStr: string): string | null {
  if (!dateStr) return null

  const cleaned = dateStr.trim()

  // Already ISO format
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return cleaned
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const skMatch = cleaned.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (skMatch) {
    const day = skMatch[1].padStart(2, "0")
    const month = skMatch[2].padStart(2, "0")
    const year = skMatch[3]
    return `${year}-${month}-${day}`
  }

  // DD.MM.YY or DD/MM/YY
  const skShortMatch = cleaned.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)
  if (skShortMatch) {
    const day = skShortMatch[1].padStart(2, "0")
    const month = skShortMatch[2].padStart(2, "0")
    const yearShort = parseInt(skShortMatch[3])
    const year = yearShort >= 50 ? `19${skShortMatch[3]}` : `20${skShortMatch[3]}`
    return `${year}-${month}-${day}`
  }

  return null
}

/**
 * Parse a Slovak-formatted number string to a JavaScript number.
 * Handles: "1 234,56" or "1234,56" or "-1 234,56"
 */
function parseSlovakNumber(numStr: string): number | null {
  if (!numStr) return null

  let cleaned = numStr.trim()

  // Remove currency symbols and whitespace used as thousands separator
  cleaned = cleaned.replace(/[€$£\u00a0]/g, "")
  // Remove spaces used as thousands separator
  cleaned = cleaned.replace(/\s/g, "")

  // If comma is the decimal separator and dot is thousands separator
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Determine which is the decimal separator (last one)
    const lastComma = cleaned.lastIndexOf(",")
    const lastDot = cleaned.lastIndexOf(".")
    if (lastComma > lastDot) {
      // Comma is decimal separator: 1.234,56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".")
    } else {
      // Dot is decimal separator: 1,234.56
      cleaned = cleaned.replace(/,/g, "")
    }
  } else if (cleaned.includes(",")) {
    // Only comma present - treat as decimal separator
    cleaned = cleaned.replace(",", ".")
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Normalize a string for case-insensitive comparison: lowercase, remove diacritics.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

/**
 * Auto-detect column mapping by matching header names to known variants.
 */
function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const normalizedHeaders = headers.map(normalize)

  for (const [field, variants] of Object.entries(COLUMN_VARIANTS)) {
    for (const variant of variants) {
      const normalizedVariant = normalize(variant)
      const idx = normalizedHeaders.findIndex(
        (h) => h === normalizedVariant || h.includes(normalizedVariant)
      )
      if (idx !== -1 && !(field in mapping)) {
        ;(mapping as any)[field] = headers[idx]
        break
      }
    }
  }

  return mapping
}

/**
 * Get the value of a field from a row object, given the mapping and headers.
 */
function getFieldValue(
  row: Record<string, string>,
  field: keyof ColumnMapping,
  mapping: ColumnMapping
): string {
  const columnName = mapping[field]
  if (columnName && row[columnName] !== undefined) {
    return row[columnName]
  }
  return ""
}

/**
 * Parse CSV text into structured bank transactions.
 *
 * @param csvText - Raw CSV text content
 * @param mapping - Optional column mapping. If not provided, auto-detection is used.
 * @returns ParseResult with transactions, errors and total row count
 */
export function parseCSV(csvText: string, mapping?: ColumnMapping): ParseResult {
  const result: ParseResult = {
    transactions: [],
    errors: [],
    totalRows: 0,
  }

  if (!csvText || !csvText.trim()) {
    result.errors.push({ row: 0, message: "Prazdny subor" })
    return result
  }

  // Normalize line endings
  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  // Split into lines and filter empty lines
  const lines = text.split("\n").filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    result.errors.push({ row: 0, message: "Subor musi obsahovat hlavicku a aspon jeden riadok dat" })
    return result
  }

  const delimiter = detectDelimiter(text)
  const headers = parseCSVLine(lines[0], delimiter)

  // Use provided mapping or auto-detect
  const effectiveMapping = mapping || autoDetectMapping(headers)

  // Validate we have at least date and amount columns
  const hasDate = effectiveMapping.date && headers.some((h) => h === effectiveMapping.date)
  const hasAmount = effectiveMapping.amount && headers.some((h) => h === effectiveMapping.amount)
  const hasCredit = effectiveMapping.credit && headers.some((h) => h === effectiveMapping.credit)
  const hasDebit = effectiveMapping.debit && headers.some((h) => h === effectiveMapping.debit)

  if (!hasDate) {
    result.errors.push({ row: 0, message: "Nepodarilo sa najst stlpec s datumom. Skontrolujte format suboru." })
    return result
  }

  if (!hasAmount && !(hasCredit || hasDebit)) {
    result.errors.push({ row: 0, message: "Nepodarilo sa najst stlpec so sumou. Skontrolujte format suboru." })
    return result
  }

  result.totalRows = lines.length - 1

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter)

    // Build row object from headers
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] || ""
    }

    try {
      // Parse date
      const dateStr = getFieldValue(row, "date", effectiveMapping)
      const parsedDate = parseSlovakDate(dateStr)
      if (!parsedDate) {
        result.errors.push({ row: i + 1, message: `Neplatny format datumu: "${dateStr}"` })
        continue
      }

      // Parse amount
      let amount: number | null = null

      if (hasAmount) {
        const amountStr = getFieldValue(row, "amount", effectiveMapping)
        amount = parseSlovakNumber(amountStr)
      } else {
        // Separate credit/debit columns
        const creditStr = getFieldValue(row, "credit", effectiveMapping)
        const debitStr = getFieldValue(row, "debit", effectiveMapping)
        const credit = parseSlovakNumber(creditStr)
        const debit = parseSlovakNumber(debitStr)

        if (credit && credit > 0) {
          amount = credit
        } else if (debit && debit > 0) {
          amount = -debit
        } else if (credit !== null) {
          amount = credit
        } else if (debit !== null) {
          amount = -debit
        }
      }

      if (amount === null) {
        result.errors.push({ row: i + 1, message: "Nepodarilo sa precitat sumu" })
        continue
      }

      const transaction: ParsedTransaction = {
        date: parsedDate,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        counterparty_name: getFieldValue(row, "counterparty_name", effectiveMapping),
        counterparty_iban: getFieldValue(row, "counterparty_iban", effectiveMapping),
        variable_symbol: getFieldValue(row, "variable_symbol", effectiveMapping),
        constant_symbol: getFieldValue(row, "constant_symbol", effectiveMapping),
        specific_symbol: getFieldValue(row, "specific_symbol", effectiveMapping),
        description: getFieldValue(row, "description", effectiveMapping),
        reference: getFieldValue(row, "reference", effectiveMapping),
        raw_row: row,
      }

      result.transactions.push(transaction)
    } catch (err: any) {
      result.errors.push({ row: i + 1, message: err.message || "Neocakavana chyba pri spracovani riadku" })
    }
  }

  return result
}

/**
 * Pre-built mappings for common Slovak banks.
 */
export const BANK_MAPPINGS = {
  tatra_banka: TATRA_BANKA_MAPPING,
  vub: VUB_MAPPING,
  slsp: SLSP_MAPPING,
} as const

export type BankPreset = keyof typeof BANK_MAPPINGS
