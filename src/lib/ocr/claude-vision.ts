import Anthropic from "@anthropic-ai/sdk"

export interface OCRResult {
  supplier_name: string | null
  supplier_ico: string | null
  supplier_dic: string | null
  supplier_ic_dph: string | null
  supplier_street: string | null
  supplier_city: string | null
  supplier_zip: string | null
  supplier_iban: string | null
  supplier_bic: string | null
  document_number: string | null
  document_type: "faktura" | "blocok" | "dobropis" | "zalohova_faktura" | "iny"
  issue_date: string | null
  delivery_date: string | null
  due_date: string | null
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  currency: string
  items: Array<{
    description: string
    quantity: number
    unit: string
    unit_price: number
    vat_rate: number
  }>
  subtotal: number | null
  vat_amount: number | null
  total: number | null
  confidence: Record<string, number> // field name -> confidence 0-1
  raw_text: string
}

const EXTRACTION_PROMPT = `Si expert na extrakciu udajov zo slovenskych uctovnych dokladov. Analyzuj obrazok a extrahuj vsetky dostupne udaje.

Vrat odpoved VYHRADNE ako JSON objekt (bez markdown, bez komentarov) s nasledujucou strukturou:
{
  "supplier_name": "nazov dodavatela alebo null",
  "supplier_ico": "ICO dodavatela alebo null",
  "supplier_dic": "DIC dodavatela alebo null",
  "supplier_ic_dph": "IC DPH dodavatela alebo null",
  "supplier_street": "ulica a cislo alebo null",
  "supplier_city": "mesto alebo null",
  "supplier_zip": "PSC alebo null",
  "supplier_iban": "IBAN alebo null",
  "supplier_bic": "BIC/SWIFT alebo null",
  "document_number": "cislo faktury/dokladu alebo null",
  "document_type": "faktura|blocok|dobropis|zalohova_faktura|iny",
  "issue_date": "YYYY-MM-DD alebo null",
  "delivery_date": "YYYY-MM-DD alebo null",
  "due_date": "YYYY-MM-DD alebo null",
  "variable_symbol": "variabilny symbol alebo null",
  "constant_symbol": "konstantny symbol alebo null",
  "specific_symbol": "specificky symbol alebo null",
  "currency": "EUR alebo CZK alebo ina mena",
  "items": [
    {
      "description": "popis polozky",
      "quantity": 1,
      "unit": "ks",
      "unit_price": 0.00,
      "vat_rate": 23
    }
  ],
  "subtotal": 0.00,
  "vat_amount": 0.00,
  "total": 0.00,
  "confidence": {
    "supplier_name": 0.95,
    "document_number": 0.9,
    "total": 0.85
  },
  "raw_text": "cely rozpoznany text z dokladu"
}

Pravidla:
- Datumy vzdy vo formate YYYY-MM-DD
- Sumy vzdy ako cisla (nie string)
- DPH sadzby na Slovensku: 23%, 19%, 5%, 0%
- Ak pole nie je najdene, pouzi null
- Confidence je cislo 0-1 vyjadrujuce istotu pre kazde extrahovane pole
- raw_text obsahuje cely rozpoznany text z dokumentu
- Ak je doklad v cestine alebo anglictine, stale extrahuj udaje`

function parseOCRResponse(text: string): OCRResult {
  let jsonStr = text.trim()
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const result = JSON.parse(jsonStr) as OCRResult
    return result
  } catch {
    throw new Error(`Failed to parse OCR result: ${jsonStr.substring(0, 200)}`)
  }
}

export async function processDocumentWithClaude(
  imageBase64: string,
  mimeType: string
): Promise<OCRResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === "text")
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude Vision API")
  }

  return parseOCRResponse(textContent.text)
}

export async function processDocumentPDFWithClaude(
  pdfBase64: string
): Promise<OCRResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === "text")
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude Vision API")
  }

  return parseOCRResponse(textContent.text)
}
