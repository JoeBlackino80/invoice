/**
 * XML Validation Library for Slovak eDane (Electronic Tax Filing)
 *
 * Provides XML well-formedness checks and schema validation
 * against known Slovak XSD schemas (simulated validation).
 */

// ===================== Types =====================

export interface ValidationError {
  line?: number
  message: string
  element?: string
}

export interface ValidationWarning {
  line?: number
  message: string
  element?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// ===================== Schema Definitions =====================

export type SchemaType =
  | "dph"
  | "kvdph"
  | "sv"
  | "dppo"
  | "dpfo"
  | "mesacny_prehlad"
  | "rocne_hlasenie"
  | "mvp_sp"
  | "zp_oznamenie"
  | "ruz"

/**
 * Required elements for each Slovak XSD schema type.
 * These simulate the mandatory fields that must be present in each XML document.
 */
const SCHEMA_REQUIRED_ELEMENTS: Record<SchemaType, string[]> = {
  dph: [
    "dokument",
    "hlavicka",
    "dic",
    "icDph",
    "nazovDanSubjektu",
    "rok",
    "druhPriznania",
    "telo",
    "r01",
    "r28",
    "r29",
    "r37",
  ],
  kvdph: [
    "dokument",
    "hlavicka",
    "dic",
    "icDph",
    "nazovDanSubjektu",
    "rok",
    "druhVykazu",
    "telo",
    "castA1",
    "castA2",
    "castB1",
    "castB2",
    "castB3",
  ],
  sv: [
    "dokument",
    "hlavicka",
    "dic",
    "icDph",
    "nazovDanSubjektu",
    "rok",
    "obdobieTyp",
    "obdobie",
    "druhPriznania",
    "telo",
    "riadky",
    "sucty",
  ],
  dppo: [
    "dokument",
    "hlavicka",
    "dic",
    "ico",
    "nazovDanSubjektu",
    "zdanovaciObdobieOd",
    "zdanovaciObdobieDo",
    "druhPriznania",
    "telo",
    "castI",
    "castIV",
    "castV",
  ],
  dpfo: [
    "dokument",
    "hlavicka",
    "dic",
    "nazovDanSubjektu",
    "zdanovaciObdobie",
    "druhPriznania",
    "telo",
    "castVI",
    "castVII",
    "castVIII",
    "castIX",
  ],
  mesacny_prehlad: [
    "dokument",
    "hlavicka",
    "typDokumentu",
    "typHlasenia",
    "rok",
    "mesiac",
    "zamestnavatel",
    "dic",
    "udaje",
    "pocetZamestnancov",
  ],
  rocne_hlasenie: [
    "dokument",
    "hlavicka",
    "typDokumentu",
    "typHlasenia",
    "rok",
    "zamestnavatel",
    "dic",
    "suhrn",
    "zamestnanci",
  ],
  mvp_sp: [
    "dokument",
    "hlavicka",
    "ico",
    "dic",
    "obdobie",
    "rok",
    "mesiac",
    "zamestnanci",
    "zamestnanec",
    "odvody",
    "suhrn",
  ],
  zp_oznamenie: [
    "dokument",
    "hlavicka",
    "ico",
    "dic",
    "kodPoistovne",
    "obdobie",
    "rok",
    "mesiac",
    "zamestnanci",
    "suhrn",
  ],
  ruz: [
    "dokument",
    "hlavicka",
    "ico",
    "nazovSubjektu",
    "pravnaForma",
    "telo",
    "aktiva",
    "pasiva",
    "vysledovka",
  ],
}

/**
 * Optional/recommended elements that generate warnings if missing.
 */
const SCHEMA_RECOMMENDED_ELEMENTS: Record<SchemaType, string[]> = {
  dph: ["ulica", "mesto", "psc", "datumPodania", "statistiky"],
  kvdph: ["ulica", "mesto", "psc", "datumPodania", "castC1", "castC2", "castD1", "castD2"],
  sv: ["ulica", "mesto", "psc", "datumPodania"],
  dppo: ["ulica", "mesto", "psc", "pravnaForma", "datumPodania", "castII", "castIII"],
  dpfo: ["ulica", "mesto", "psc", "datumPodania"],
  mesacny_prehlad: ["datumPodania", "adresa", "danovyUrad"],
  rocne_hlasenie: ["datumPodania", "adresa", "danovyUrad"],
  mvp_sp: ["adresa", "variabilnySymbol"],
  zp_oznamenie: ["adresa", "nazovPoistovne"],
  ruz: ["sidlo", "datum"],
}

// ===================== Helpers =====================

/**
 * Find the approximate line number of a string in XML content.
 */
function findLineNumber(xml: string, searchStr: string): number | undefined {
  const lines = xml.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchStr)) {
      return i + 1
    }
  }
  return undefined
}

/**
 * Check if an XML element (tag) exists in the content.
 */
function elementExists(xml: string, elementName: string): boolean {
  const openTagRegex = new RegExp(`<${elementName}[\\s>/]`, "i")
  return openTagRegex.test(xml)
}

/**
 * Extract text content of an XML element.
 */
function extractElementValue(xml: string, elementName: string): string | null {
  const regex = new RegExp(`<${elementName}>([^<]*)</${elementName}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

// ===================== Public API =====================

/**
 * Validate XML structure (well-formedness check).
 *
 * Checks for:
 * - XML declaration present
 * - Matching opening/closing tags
 * - Properly nested tags
 * - No unclosed tags
 * - Basic character encoding issues
 */
export function validateXMLStructure(xml: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!xml || xml.trim().length === 0) {
    errors.push({ message: "XML obsah je prazdny" })
    return { valid: false, errors, warnings }
  }

  // Check XML declaration
  const trimmed = xml.trim()
  if (!trimmed.startsWith("<?xml")) {
    warnings.push({
      line: 1,
      message: "Chyba XML deklaracia (<?xml version=\"1.0\" encoding=\"UTF-8\"?>)",
    })
  }

  // Check for basic encoding declaration
  if (trimmed.startsWith("<?xml") && !trimmed.includes("encoding=")) {
    warnings.push({
      line: 1,
      message: "XML deklaracia nema atribut encoding - odporuca sa UTF-8",
    })
  }

  // Parse and validate tag structure
  const tagStack: Array<{ name: string; line: number }> = []
  const lines = xml.split("\n")

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    const lineNum = lineIdx + 1

    // Skip XML declaration and comments
    if (line.trim().startsWith("<?") || line.trim().startsWith("<!--")) {
      continue
    }

    // Find all tags on this line
    const tagRegex = /<\/?([a-zA-Z_][\w.-]*)[^>]*\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(line)) !== null) {
      const fullTag = match[0]
      const tagName = match[1]

      // Self-closing tag - skip
      if (fullTag.endsWith("/>")) {
        continue
      }

      // Closing tag
      if (fullTag.startsWith("</")) {
        if (tagStack.length === 0) {
          errors.push({
            line: lineNum,
            message: `Neocakavany uzatvaraci tag </${tagName}>`,
            element: tagName,
          })
        } else {
          const last = tagStack[tagStack.length - 1]
          if (last.name !== tagName) {
            errors.push({
              line: lineNum,
              message: `Nezhoda tagov: ocakavany </${last.name}>, najdeny </${tagName}>`,
              element: tagName,
            })
          } else {
            tagStack.pop()
          }
        }
      } else {
        // Opening tag
        tagStack.push({ name: tagName, line: lineNum })
      }
    }
  }

  // Check for unclosed tags
  for (const unclosed of tagStack) {
    errors.push({
      line: unclosed.line,
      message: `Neuzavrety tag <${unclosed.name}>`,
      element: unclosed.name,
    })
  }

  // Check for unescaped special characters in text content
  const ampersandRegex = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    // Skip lines that are purely tags
    if (line.trim().startsWith("<") && line.trim().endsWith(">")) continue

    if (ampersandRegex.test(line)) {
      warnings.push({
        line: lineIdx + 1,
        message: "Mozny neescapovany znak & - pouzite &amp;",
      })
    }
    ampersandRegex.lastIndex = 0
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate XML content against a known Slovak XSD schema (simulated).
 *
 * Checks that required elements for the given schema type are present
 * in the XML document. Also checks for recommended elements and
 * generates warnings if they are missing.
 *
 * @param xml - XML content string
 * @param schemaType - One of the supported Slovak schema types
 * @returns ValidationResult with errors and warnings
 */
export function validateAgainstSchema(
  xml: string,
  schemaType: string
): ValidationResult {
  // First validate well-formedness
  const structureResult = validateXMLStructure(xml)
  const errors: ValidationError[] = [...structureResult.errors]
  const warnings: ValidationWarning[] = [...structureResult.warnings]

  // Validate schema type
  const validSchemaTypes: SchemaType[] = [
    "dph",
    "kvdph",
    "sv",
    "dppo",
    "dpfo",
    "mesacny_prehlad",
    "rocne_hlasenie",
    "mvp_sp",
    "zp_oznamenie",
    "ruz",
  ]

  if (!validSchemaTypes.includes(schemaType as SchemaType)) {
    errors.push({
      message: `Neznamy typ schemy: "${schemaType}". Podporovane typy: ${validSchemaTypes.join(", ")}`,
    })
    return { valid: false, errors, warnings }
  }

  const schema = schemaType as SchemaType

  // Check required elements
  const requiredElements = SCHEMA_REQUIRED_ELEMENTS[schema]
  for (const element of requiredElements) {
    if (!elementExists(xml, element)) {
      const line = findLineNumber(xml, element)
      errors.push({
        line,
        message: `Chybajuci povinny element <${element}> pre schemu "${schema}"`,
        element,
      })
    }
  }

  // Check recommended elements (warnings only)
  const recommendedElements = SCHEMA_RECOMMENDED_ELEMENTS[schema]
  for (const element of recommendedElements) {
    if (!elementExists(xml, element)) {
      warnings.push({
        message: `Odporucany element <${element}> nie je pritomny v dokumente`,
        element,
      })
    }
  }

  // Schema-specific content checks
  if (schema === "dph" || schema === "kvdph" || schema === "sv") {
    // Check DIC format (10 digits)
    const dic = extractElementValue(xml, "dic")
    if (dic && !/^\d{10}$/.test(dic)) {
      warnings.push({
        message: `DIC "${dic}" nema standardny format (10 cislic)`,
        element: "dic",
        line: findLineNumber(xml, "<dic>"),
      })
    }

    // Check IC DPH format (SK + 10 digits)
    const icDph = extractElementValue(xml, "icDph")
    if (icDph && !/^SK\d{10}$/.test(icDph)) {
      warnings.push({
        message: `IC DPH "${icDph}" nema standardny format (SK + 10 cislic)`,
        element: "icDph",
        line: findLineNumber(xml, "<icDph>"),
      })
    }
  }

  if (schema === "dppo" || schema === "dpfo") {
    // Check DIC format
    const dic = extractElementValue(xml, "dic")
    if (dic && !/^\d{10}$/.test(dic)) {
      warnings.push({
        message: `DIC "${dic}" nema standardny format (10 cislic)`,
        element: "dic",
        line: findLineNumber(xml, "<dic>"),
      })
    }
  }

  if (schema === "mesacny_prehlad" || schema === "rocne_hlasenie") {
    // Check DIC format
    const dic = extractElementValue(xml, "dic")
    if (dic && !/^\d{10}$/.test(dic)) {
      warnings.push({
        message: `DIC "${dic}" nema standardny format (10 cislic)`,
        element: "dic",
        line: findLineNumber(xml, "<dic>"),
      })
    }
  }

  if (schema === "mvp_sp" || schema === "zp_oznamenie") {
    // Check ICO format (8 digits)
    const ico = extractElementValue(xml, "ico")
    if (ico && !/^\d{8}$/.test(ico)) {
      warnings.push({
        message: `ICO "${ico}" nema standardny format (8 cislic)`,
        element: "ico",
        line: findLineNumber(xml, "<ico>"),
      })
    }
  }

  // Check for NaN values in numeric elements
  const nanRegex = />NaN</g
  if (nanRegex.test(xml)) {
    errors.push({
      message: "Dokument obsahuje neplatne numericke hodnoty (NaN)",
      line: findLineNumber(xml, "NaN"),
    })
  }

  // Check for empty required text content
  const rok = extractElementValue(xml, "rok")
  if (rok !== null && (!rok || rok === "0")) {
    errors.push({
      message: "Element <rok> musi obsahovat platny rok",
      element: "rok",
      line: findLineNumber(xml, "<rok>"),
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate XML before download - combines schema validation with
 * business rule checks and returns user-friendly Slovak error messages.
 *
 * @param xml - XML content string
 * @param schemaType - One of the supported Slovak schema types
 * @returns ValidationResult with errors and warnings
 */
export function validateBeforeDownload(
  xml: string,
  schemaType: string
): ValidationResult {
  // Run schema validation first
  const result = validateAgainstSchema(xml, schemaType)
  const errors = [...result.errors]
  const warnings = [...result.warnings]

  // Additional business rule checks

  // Check that XML is not empty/minimal
  if (xml && xml.length < 100) {
    errors.push({
      message: "XML dokument je prilis kratky - moze byt neuplny",
    })
  }

  // Check company DIC is present and not empty
  const dic = extractElementValue(xml, "dic")
  if (!dic || dic === "") {
    errors.push({
      message: "DIC nie je vyplnene - vyplnte udaje firmy v nastaveniach",
      element: "dic",
    })
  }

  // Schema-specific business checks
  const schema = schemaType as SchemaType

  if (schema === "dph") {
    // Check IC DPH is present for DPH
    const icDph = extractElementValue(xml, "icDph")
    if (!icDph || icDph === "") {
      errors.push({
        message: "IC DPH nie je vyplnene - povinne pre DPH priznanie",
        element: "icDph",
      })
    }
  }

  if (schema === "kvdph") {
    // Check IC DPH for KV DPH
    const icDph = extractElementValue(xml, "icDph")
    if (!icDph || icDph === "") {
      errors.push({
        message: "IC DPH nie je vyplnene - povinne pre kontrolny vykaz",
        element: "icDph",
      })
    }
  }

  if (schema === "dppo") {
    // Check ICO is present for DPPO
    const ico = extractElementValue(xml, "ico")
    if (!ico || ico === "") {
      warnings.push({
        message: "ICO nie je vyplnene - odporucane pre DPPO",
        element: "ico",
      })
    }
  }

  if (schema === "mvp_sp" || schema === "zp_oznamenie") {
    // Check company name is present
    const nazov = extractElementValue(xml, "nazov")
    if (!nazov || nazov === "") {
      errors.push({
        message: "Nazov firmy nie je vyplneny",
        element: "nazov",
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
