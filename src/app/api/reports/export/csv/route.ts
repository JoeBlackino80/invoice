import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateCSV } from "@/lib/reports/export-generator"

// POST /api/reports/export/csv - Generate CSV export
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const body = await request.json()
  const { type, company_id, filters } = body

  if (!company_id) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  if (!type) {
    return NextResponse.json({ error: "type je povinny" }, { status: 400 })
  }

  const dateFrom = filters?.date_from
  const dateTo = filters?.date_to
  const status = filters?.status

  let headers: string[] = []
  let rows: any[][] = []
  let filename = "export.csv"

  try {
    switch (type) {
      case "invoices": {
        const invoiceType = filters?.invoice_type // vydana, prijata
        let query = (db.from("invoices") as any)
          .select(
            "number, type, issue_date, due_date, status, total_amount, total_with_vat, currency, variable_symbol, contact:contacts(name, ico)"
          )
          .eq("company_id", company_id)
          .is("deleted_at", null)
          .order("issue_date", { ascending: false })

        if (invoiceType) query = query.eq("type", invoiceType)
        if (status) query = query.eq("status", status)
        if (dateFrom) query = query.gte("issue_date", dateFrom)
        if (dateTo) query = query.lte("issue_date", dateTo)

        const { data, error } = await query
        if (error) throw new Error(error.message)

        headers = [
          "Cislo",
          "Typ",
          "Datum vystavenia",
          "Splatnost",
          "Stav",
          "Zaklad",
          "Celkom s DPH",
          "Mena",
          "VS",
          "Kontakt",
          "ICO",
        ]
        rows = (data || []).map((inv: any) => [
          inv.number,
          inv.type,
          inv.issue_date,
          inv.due_date,
          inv.status,
          Number(inv.total_amount).toFixed(2),
          Number(inv.total_with_vat).toFixed(2),
          inv.currency || "EUR",
          inv.variable_symbol || "",
          inv.contact?.name || "",
          inv.contact?.ico || "",
        ])
        filename = `faktury_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      case "journal": {
        let query = (db.from("journal_entries") as any)
          .select(
            `
            number,
            date,
            document_type,
            description,
            status,
            total_md,
            total_d,
            lines:journal_entry_lines(
              account:chart_of_accounts(synteticky_ucet, analyticky_ucet, nazov),
              side,
              amount,
              description
            )
          `
          )
          .eq("company_id", company_id)
          .is("deleted_at", null)
          .order("date", { ascending: false })

        if (status) query = query.eq("status", status)
        if (dateFrom) query = query.gte("date", dateFrom)
        if (dateTo) query = query.lte("date", dateTo)

        const { data, error } = await query
        if (error) throw new Error(error.message)

        headers = [
          "Cislo dokladu",
          "Datum",
          "Typ dokladu",
          "Popis",
          "Stav",
          "Ucet",
          "Nazov uctu",
          "Strana",
          "Suma",
          "Popis riadku",
        ]
        rows = []
        for (const entry of data || []) {
          for (const line of entry.lines || []) {
            const acct = line.account
            const accountCode = acct
              ? `${acct.synteticky_ucet}${acct.analyticky_ucet ? "." + acct.analyticky_ucet : ""}`
              : ""
            rows.push([
              entry.number,
              entry.date,
              entry.document_type,
              entry.description || "",
              entry.status,
              accountCode,
              acct?.nazov || "",
              line.side,
              Number(line.amount).toFixed(2),
              line.description || "",
            ])
          }
        }
        filename = `uctovne_zapisy_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      case "contacts": {
        const { data, error } = await (db.from("contacts") as any)
          .select(
            "name, ico, dic, ic_dph, email, phone, street, city, postal_code, country, type, is_supplier, is_customer"
          )
          .eq("company_id", company_id)
          .is("deleted_at", null)
          .order("name")

        if (error) throw new Error(error.message)

        headers = [
          "Nazov",
          "ICO",
          "DIC",
          "IC DPH",
          "Email",
          "Telefon",
          "Ulica",
          "Mesto",
          "PSC",
          "Krajina",
          "Typ",
          "Dodavatel",
          "Odberatel",
        ]
        rows = (data || []).map((c: any) => [
          c.name,
          c.ico || "",
          c.dic || "",
          c.ic_dph || "",
          c.email || "",
          c.phone || "",
          c.street || "",
          c.city || "",
          c.postal_code || "",
          c.country || "SK",
          c.type || "",
          c.is_supplier ? "Ano" : "Nie",
          c.is_customer ? "Ano" : "Nie",
        ])
        filename = `kontakty_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      case "employees": {
        const { data, error } = await (db.from("employees") as any)
          .select(
            "first_name, last_name, personal_number, birth_date, email, phone, status, position, department, hire_date"
          )
          .eq("company_id", company_id)
          .is("deleted_at", null)
          .order("last_name")

        if (error) throw new Error(error.message)

        headers = [
          "Meno",
          "Priezvisko",
          "Osobne cislo",
          "Datum narodenia",
          "Email",
          "Telefon",
          "Stav",
          "Pozicia",
          "Oddelenie",
          "Datum nastupu",
        ]
        rows = (data || []).map((e: any) => [
          e.first_name,
          e.last_name,
          e.personal_number || "",
          e.birth_date || "",
          e.email || "",
          e.phone || "",
          e.status || "",
          e.position || "",
          e.department || "",
          e.hire_date || "",
        ])
        filename = `zamestnanci_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      case "products": {
        const { data, error } = await (db.from("products") as any)
          .select(
            "name, sku, description, unit, unit_price, vat_rate, category, is_service, is_active"
          )
          .eq("company_id", company_id)
          .is("deleted_at", null)
          .order("name")

        if (error) throw new Error(error.message)

        headers = [
          "Nazov",
          "SKU",
          "Popis",
          "Jednotka",
          "Cena",
          "Sadzba DPH",
          "Kategoria",
          "Sluzba",
          "Aktivny",
        ]
        rows = (data || []).map((p: any) => [
          p.name,
          p.sku || "",
          p.description || "",
          p.unit || "",
          Number(p.unit_price).toFixed(2),
          p.vat_rate ? `${p.vat_rate}%` : "",
          p.category || "",
          p.is_service ? "Ano" : "Nie",
          p.is_active ? "Ano" : "Nie",
        ])
        filename = `produkty_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      case "bank-transactions": {
        let query = (db.from("bank_transactions") as any)
          .select(
            "date, amount, currency, type, description, counterparty_name, counterparty_iban, variable_symbol, reference, is_matched"
          )
          .eq("company_id", company_id)
          .order("date", { ascending: false })

        if (dateFrom) query = query.gte("date", dateFrom)
        if (dateTo) query = query.lte("date", dateTo)

        const { data, error } = await query
        if (error) throw new Error(error.message)

        headers = [
          "Datum",
          "Suma",
          "Mena",
          "Typ",
          "Popis",
          "Protiucet",
          "IBAN",
          "VS",
          "Referencia",
          "Sparovane",
        ]
        rows = (data || []).map((t: any) => [
          t.date,
          Number(t.amount).toFixed(2),
          t.currency || "EUR",
          t.type || "",
          t.description || "",
          t.counterparty_name || "",
          t.counterparty_iban || "",
          t.variable_symbol || "",
          t.reference || "",
          t.is_matched ? "Ano" : "Nie",
        ])
        filename = `bankove_transakcie_${new Date().toISOString().slice(0, 10)}.csv`
        break
      }

      default:
        return NextResponse.json(
          {
            error:
              "Neplatny typ exportu. Povolene: invoices, journal, contacts, employees, products, bank-transactions",
          },
          { status: 400 }
        )
    }

    const csvContent = generateCSV(headers, rows)

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Chyba pri generovani exportu" },
      { status: 500 }
    )
  }
}
