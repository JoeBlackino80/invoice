import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/payments/link/:token - Údaje platobného odkazu
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createClient()
  const db = createAdminClient()

  try {
    // Dekódovať token (formát: base64url z "companySlug:invoiceId:timestamp")
    const decoded = Buffer.from(params.token, "base64url").toString("utf-8")
    const parts = decoded.split(":")

    if (parts.length < 2) {
      return NextResponse.json({ error: "Neplatný platobný odkaz" }, { status: 400 })
    }

    const companySlug = parts[0]
    const invoiceId = parts[1]

    // Načítať firmu
    const { data: company, error: companyError } = await (db
      .from("companies") as any)
      .select("id, name, logo_url, bank_account_iban, bank_bic")
      .or(`slug.eq.${companySlug},id.eq.${companySlug}`)
      .single() as { data: any; error: any }

    if (companyError || !company) {
      return NextResponse.json({ error: "Firma nenájdená" }, { status: 404 })
    }

    // Načítať faktúru
    const { data: invoice, error: invoiceError } = await (db
      .from("invoices") as any)
      .select(`
        id,
        number,
        issue_date,
        due_date,
        total_amount,
        total_with_vat,
        currency,
        status,
        variable_symbol,
        constant_symbol,
        specific_symbol,
        supplier_name,
        supplier_iban,
        customer_name,
        notes,
        invoice_items (
          id,
          description,
          quantity,
          unit,
          unit_price,
          vat_rate,
          total_without_vat,
          total_with_vat
        )
      `)
      .eq("id", invoiceId)
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .neq("status", "draft")
      .single() as { data: any; error: any }

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
    }

    // Zistiť dostupné platobné metódy
    const { data: paymentSettings } = await (db
      .from("payment_settings") as any)
      .select("stripe_enabled, gopay_enabled, bank_transfer_enabled")
      .eq("company_id", company.id)
      .single() as { data: any; error: any }

    const paymentMethods: string[] = []
    if (paymentSettings?.stripe_enabled) paymentMethods.push("stripe")
    if (paymentSettings?.gopay_enabled) paymentMethods.push("gopay")
    if (paymentSettings?.bank_transfer_enabled !== false) paymentMethods.push("bank_transfer")
    // Ak nie sú nastavenia, povolíme bankový prevod
    if (paymentMethods.length === 0) paymentMethods.push("bank_transfer")

    return NextResponse.json({
      company: {
        name: company.name,
        logo_url: company.logo_url,
      },
      invoice: {
        id: invoice.id,
        number: invoice.number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        total_with_vat: invoice.total_with_vat,
        currency: invoice.currency,
        status: invoice.status,
        variable_symbol: invoice.variable_symbol,
        customer_name: invoice.customer_name,
        items: invoice.invoice_items || [],
      },
      bank_details: {
        iban: invoice.supplier_iban || company.bank_account_iban || "",
        bic: company.bank_bic || "",
        variable_symbol: invoice.variable_symbol || "",
        constant_symbol: invoice.constant_symbol || "",
        specific_symbol: invoice.specific_symbol || "",
        recipient_name: invoice.supplier_name || company.name,
      },
      payment_methods: paymentMethods,
    })
  } catch (err) {
    return NextResponse.json({ error: "Neplatný platobný odkaz" }, { status: 400 })
  }
}
