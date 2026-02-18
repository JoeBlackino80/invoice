import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { exportToPohodaXML } from "@/lib/integrations/pohoda-import"

// POST /api/integrations/export
// Export data in specified format
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const body = await request.json()
    const {
      format, // pohoda_xml, csv, ubl
      entity_type,
      company_id,
      filters,
    } = body as {
      format: string
      entity_type: string
      company_id: string
      filters?: {
        date_from?: string
        date_to?: string
        status?: string
      }
    }

    if (!format || !entity_type || !company_id) {
      return NextResponse.json(
        { error: "Format, typ entity a ID spolocnosti su povinne" },
        { status: 400 }
      )
    }

    // Verify user access
    const { data: companyAccess } = await (db.from("user_company_roles") as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .single() as { data: any; error: any }

    if (!companyAccess) {
      return NextResponse.json({ error: "Nemate pristup k tejto spolocnosti" }, { status: 403 })
    }

    // Fetch data based on entity type
    let data: any[] = []

    if (entity_type === "invoices") {
      let query = (db.from("invoices") as any)
        .select(`
          *,
          invoice_items (*),
          contact:contacts (
            id, name, ico, dic, ic_dph,
            street, city, zip, country,
            phone, email, web, bank_account, iban, swift
          )
        `)
        .eq("company_id", company_id)
        .is("deleted_at", null)

      if (filters?.date_from) {
        query = query.gte("issue_date", filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte("issue_date", filters.date_to)
      }
      if (filters?.status) {
        query = query.eq("status", filters.status)
      }

      const { data: invoiceData, error } = await query.order("issue_date", { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      data = invoiceData || []
    } else if (entity_type === "contacts") {
      let query = (db.from("contacts") as any)
        .select("*")
        .eq("company_id", company_id)
        .is("deleted_at", null)

      const { data: contactData, error } = await query.order("name")

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      data = contactData || []
    } else if (entity_type === "journal_entries") {
      let query = (db.from("journal_entries") as any)
        .select("*")
        .eq("company_id", company_id)

      if (filters?.date_from) {
        query = query.gte("date", filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte("date", filters.date_to)
      }

      const { data: journalData, error } = await query.order("date", { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      data = journalData || []
    } else {
      return NextResponse.json({ error: "Nepodporovany typ entity" }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "Ziadne data na export" }, { status: 404 })
    }

    // Generate export based on format
    if (format === "pohoda_xml") {
      const invoices = entity_type === "invoices"
        ? data.map((inv: any) => ({
            id: inv.id,
            number: inv.number || "",
            type: inv.type || "issued",
            issue_date: inv.issue_date || "",
            tax_date: inv.tax_date || inv.issue_date || "",
            due_date: inv.due_date || "",
            variable_symbol: inv.variable_symbol,
            constant_symbol: inv.constant_symbol,
            specific_symbol: inv.specific_symbol,
            contact_name: inv.contact?.name,
            contact_ico: inv.contact?.ico,
            contact_dic: inv.contact?.dic,
            contact_ic_dph: inv.contact?.ic_dph,
            contact_street: inv.contact?.street,
            contact_city: inv.contact?.city,
            contact_zip: inv.contact?.zip,
            payment_method: inv.payment_method,
            bank_account: inv.bank_account,
            iban: inv.iban,
            swift: inv.swift,
            currency: inv.currency,
            exchange_rate: inv.exchange_rate,
            note: inv.notes,
            items: (inv.invoice_items || []).map((item: any) => ({
              description: item.description || "",
              quantity: item.quantity || 1,
              unit: item.unit || "ks",
              unit_price: item.unit_price || 0,
              vat_rate: item.vat_rate || 20,
              total_without_vat: (item.quantity || 1) * (item.unit_price || 0),
              total_vat: (item.quantity || 1) * (item.unit_price || 0) * ((item.vat_rate || 20) / 100),
              total_with_vat: (item.quantity || 1) * (item.unit_price || 0) * (1 + (item.vat_rate || 20) / 100),
            })),
            total_without_vat: inv.total_without_vat || 0,
            total_vat: inv.total_vat || 0,
            total_with_vat: inv.total_with_vat || 0,
          }))
        : []

      const contacts = entity_type === "contacts"
        ? data.map((c: any) => ({
            id: c.id,
            name: c.name || "",
            ico: c.ico,
            dic: c.dic,
            ic_dph: c.ic_dph,
            street: c.street,
            city: c.city,
            zip: c.zip,
            country: c.country,
            phone: c.phone,
            email: c.email,
            web: c.web,
            bank_account: c.bank_account,
            iban: c.iban,
            swift: c.swift,
            note: c.note,
          }))
        : []

      const xmlContent = exportToPohodaXML(invoices, contacts)

      return new Response(xmlContent, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="export_${entity_type}_${new Date().toISOString().split("T")[0]}.xml"`,
        },
      })
    } else if (format === "csv") {
      // Generate CSV
      let csvContent = ""

      if (entity_type === "invoices") {
        const headers = [
          "Cislo", "Typ", "Datum vystavenia", "Datum splatnosti", "Datum DPH",
          "Variabilny symbol", "Konstantny symbol",
          "Odberatel", "ICO", "DIC",
          "Suma bez DPH", "DPH", "Suma s DPH",
          "Mena", "Stav", "Sposob platby", "Poznamka"
        ]
        csvContent = headers.join(";") + "\n"

        for (const inv of data) {
          const row = [
            inv.number || "",
            inv.type || "issued",
            inv.issue_date || "",
            inv.due_date || "",
            inv.tax_date || "",
            inv.variable_symbol || "",
            inv.constant_symbol || "",
            inv.contact?.name || "",
            inv.contact?.ico || "",
            inv.contact?.dic || "",
            (inv.total_without_vat || 0).toString(),
            (inv.total_vat || 0).toString(),
            (inv.total_with_vat || 0).toString(),
            inv.currency || "EUR",
            inv.status || "",
            inv.payment_method || "",
            (inv.notes || "").replace(/[;\n\r]/g, " "),
          ]
          csvContent += row.map((v) => `"${v}"`).join(";") + "\n"
        }
      } else if (entity_type === "contacts") {
        const headers = [
          "Nazov", "ICO", "DIC", "IC DPH",
          "Ulica", "Mesto", "PSC", "Krajina",
          "Email", "Telefon", "Web",
          "IBAN", "Poznamka"
        ]
        csvContent = headers.join(";") + "\n"

        for (const c of data) {
          const row = [
            c.name || "",
            c.ico || "",
            c.dic || "",
            c.ic_dph || "",
            c.street || "",
            c.city || "",
            c.zip || "",
            c.country || "SK",
            c.email || "",
            c.phone || "",
            c.web || "",
            c.iban || "",
            (c.note || "").replace(/[;\n\r]/g, " "),
          ]
          csvContent += row.map((v) => `"${v}"`).join(";") + "\n"
        }
      } else if (entity_type === "journal_entries") {
        const headers = [
          "Cislo", "Datum", "Popis",
          "Ucet MD", "Ucet DAL", "Suma",
          "Variabilny symbol", "Typ dokladu"
        ]
        csvContent = headers.join(";") + "\n"

        for (const je of data) {
          const row = [
            je.number || "",
            je.date || "",
            (je.description || "").replace(/[;\n\r]/g, " "),
            je.debit_account || "",
            je.credit_account || "",
            (je.amount || 0).toString(),
            je.variable_symbol || "",
            je.document_type || "",
          ]
          csvContent += row.map((v) => `"${v}"`).join(";") + "\n"
        }
      }

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export_${entity_type}_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } else if (format === "ubl") {
      // UBL 2.1 format - only for invoices
      if (entity_type !== "invoices") {
        return NextResponse.json({ error: "UBL format je dostupny len pre faktury" }, { status: 400 })
      }

      // Generate UBL 2.1 XML for each invoice (simplified)
      let ublContent = `<?xml version="1.0" encoding="UTF-8"?>\n<Invoices>\n`

      for (const inv of data) {
        ublContent += `  <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:ID>${inv.number || inv.id}</cbc:ID>
    <cbc:IssueDate>${inv.issue_date || ""}</cbc:IssueDate>
    <cbc:DueDate>${inv.due_date || ""}</cbc:DueDate>
    <cbc:InvoiceTypeCode>${inv.type === "received" ? "381" : "380"}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${inv.currency || "EUR"}</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty>
      <cac:Party>
        <cac:PartyName><cbc:Name>${inv.contact?.name || ""}</cbc:Name></cac:PartyName>
      </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:LegalMonetaryTotal>
      <cbc:TaxExclusiveAmount currencyID="${inv.currency || "EUR"}">${inv.total_without_vat || 0}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="${inv.currency || "EUR"}">${inv.total_with_vat || 0}</cbc:TaxInclusiveAmount>
      <cbc:PayableAmount currencyID="${inv.currency || "EUR"}">${inv.total_with_vat || 0}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
  </Invoice>\n`
      }

      ublContent += `</Invoices>`

      return new Response(ublContent, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="export_ubl_${new Date().toISOString().split("T")[0]}.xml"`,
        },
      })
    } else {
      return NextResponse.json({ error: "Nepodporovany format exportu" }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Chyba pri exporte: ${err.message || "unknown"}` },
      { status: 500 }
    )
  }
}
