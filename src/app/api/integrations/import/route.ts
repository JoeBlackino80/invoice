import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  parseCSV,
  detectColumns,
  type EntityType,
} from "@/lib/integrations/csv-import"
import {
  parsePohodaInvoices,
  parsePohodaContacts,
  parsePohodaJournalEntries,
} from "@/lib/integrations/pohoda-import"

// POST /api/integrations/import
// Upload file and get parsed preview with column mapping suggestions
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const importType = formData.get("import_type") as string // pohoda_xml, csv, xlsx
    const entityType = formData.get("entity_type") as EntityType

    if (!file) {
      return NextResponse.json({ error: "Subor je povinny" }, { status: 400 })
    }

    if (!entityType) {
      return NextResponse.json({ error: "Typ entity je povinny" }, { status: 400 })
    }

    const content = await file.text()

    if (importType === "pohoda_xml") {
      // Parse Pohoda XML based on entity type
      let parsedData: any[] = []
      let headers: string[] = []
      let rows: string[][] = []

      if (entityType === "invoices") {
        const invoices = parsePohodaInvoices(content)
        parsedData = invoices

        headers = [
          "Cislo", "Typ", "Datum vystavenia", "Datum splatnosti",
          "Variabilny symbol", "Odberatel", "ICO", "Suma bez DPH",
          "DPH", "Suma s DPH", "Mena", "Poznamka"
        ]

        rows = invoices.map((inv) => [
          inv.number,
          inv.invoiceType === "issuedInvoice" ? "vydana" : "prijata",
          inv.date,
          inv.dateDue,
          inv.symVar,
          inv.partnerIdentity.name,
          inv.partnerIdentity.ico,
          inv.totalWithoutVat.toString(),
          inv.totalVat.toString(),
          inv.totalWithVat.toString(),
          inv.currency,
          inv.text || inv.note,
        ])
      } else if (entityType === "contacts") {
        const contacts = parsePohodaContacts(content)
        parsedData = contacts

        headers = [
          "Nazov", "ICO", "DIC", "IC DPH", "Ulica", "Mesto",
          "PSC", "Email", "Telefon", "IBAN"
        ]

        rows = contacts.map((c) => [
          c.name,
          c.ico,
          c.dic,
          c.icDph,
          c.street,
          c.city,
          c.zip,
          c.email,
          c.phone,
          c.iban,
        ])
      } else if (entityType === "journal_entries") {
        const entries = parsePohodaJournalEntries(content)
        parsedData = entries

        headers = [
          "Cislo", "Datum", "Popis", "Variabilny symbol",
          "Polozky (MD/DAL/Suma)", "Celkova suma"
        ]

        rows = entries.map((e) => [
          e.number,
          e.date,
          e.text,
          e.symVar,
          e.items.map((item) => `${item.md}/${item.dal}/${item.amount}`).join("; "),
          e.totalAmount.toString(),
        ])
      }

      // Auto-detect column mapping for Pohoda data
      const columnMapping = detectColumns(headers, entityType)

      return NextResponse.json({
        import_type: "pohoda_xml",
        entity_type: entityType,
        headers,
        rows: rows.slice(0, 100), // Limit preview
        total_rows: rows.length,
        column_mapping: columnMapping,
        preview_rows: rows.slice(0, 5),
        raw_data: parsedData.slice(0, 5), // Include raw parsed data for preview
      })
    } else {
      // CSV import
      const parsed = parseCSV(content)

      if (parsed.headers.length === 0) {
        return NextResponse.json({ error: "Subor je prazdny alebo nema hlavicku" }, { status: 400 })
      }

      // Auto-detect column mapping
      const columnMapping = detectColumns(parsed.headers, entityType)

      return NextResponse.json({
        import_type: "csv",
        entity_type: entityType,
        headers: parsed.headers,
        rows: parsed.rows.slice(0, 100), // Limit preview
        total_rows: parsed.rowCount,
        delimiter: parsed.delimiter,
        column_mapping: columnMapping,
        preview_rows: parsed.rows.slice(0, 5),
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri spracovani suboru: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}
