import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateSepaXml } from "@/lib/bank/sepa-generator"
import type { SepaDocument, SepaPayment } from "@/lib/bank/sepa-generator"

// POST /api/payment-orders/from-invoices - vytvorenie prikazu z vybranych faktur
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, bank_account_id, invoice_ids, requested_date, notes } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!bank_account_id) {
    return NextResponse.json({ error: "bank_account_id je povinny" }, { status: 400 })
  }

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return NextResponse.json({ error: "Vyberte aspon jednu fakturu" }, { status: 400 })
  }

  // Fetch bank account for debtor info
  const { data: bankAccount, error: bankError } = await (db
    .from("bank_accounts") as any)
    .select("*")
    .eq("id", bank_account_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (bankError || !bankAccount) {
    return NextResponse.json({ error: "Bankovy ucet nebol najdeny" }, { status: 404 })
  }

  // Fetch company info
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("id, name")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma nebola najdena" }, { status: 404 })
  }

  // Process each invoice
  const sepaPayments: SepaPayment[] = []
  const warnings: string[] = []

  for (const invoiceId of invoice_ids) {
    // Fetch invoice with contact
    const { data: invoice, error: invError } = await (db
      .from("invoices") as any)
      .select(`
        *,
        contact:contacts(id, name)
      `)
      .eq("id", invoiceId)
      .is("deleted_at", null)
      .single() as { data: any; error: any }

    if (invError || !invoice) {
      return NextResponse.json(
        { error: `Faktura ${invoiceId} nebola najdena` },
        { status: 404 }
      )
    }

    if (invoice.type !== "prijata") {
      return NextResponse.json(
        { error: `Faktura ${invoice.number} nie je typu 'prijata'` },
        { status: 400 }
      )
    }

    if (invoice.status === "uhradena") {
      return NextResponse.json(
        { error: `Faktura ${invoice.number} je uz uhradena` },
        { status: 400 }
      )
    }

    // Find contact bank account
    let creditorIban = ""
    let creditorBic = ""

    if (invoice.contact_id) {
      const { data: contactBankAccounts } = await (db
        .from("contact_bank_accounts") as any)
        .select("*")
        .eq("contact_id", invoice.contact_id)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })

      if (contactBankAccounts && contactBankAccounts.length > 0) {
        creditorIban = contactBankAccounts[0].iban || ""
        creditorBic = contactBankAccounts[0].bic || ""
      }
    }

    if (!creditorIban) {
      const contactName = invoice.contact?.name || invoice.supplier_name || "Neznamy"
      return NextResponse.json(
        { error: `Kontakt "${contactName}" (faktura ${invoice.number}) nema zadany IBAN` },
        { status: 400 }
      )
    }

    // Calculate remaining amount (total - already paid)
    const totalAmount = Number(invoice.total_amount) || 0
    const paidAmount = Number(invoice.paid_amount) || 0
    const remainingAmount = totalAmount - paidAmount

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: `Faktura ${invoice.number} nema zostatok na uhradu` },
        { status: 400 }
      )
    }

    sepaPayments.push({
      id: `PMT-${invoiceId.substring(0, 8)}`,
      amount: remainingAmount,
      currency: invoice.currency || "EUR",
      creditor_name: invoice.contact?.name || invoice.supplier_name || "Neznamy",
      creditor_iban: creditorIban,
      creditor_bic: creditorBic || undefined,
      variable_symbol: invoice.variable_symbol || undefined,
      constant_symbol: invoice.constant_symbol || undefined,
      specific_symbol: invoice.specific_symbol || undefined,
      remittance_info: `Uhrada fa. ${invoice.number}`,
      requested_date: requested_date || undefined,
    })
  }

  // Generate SEPA XML
  const now = new Date()
  const messageId = `PO-${now.getTime()}-${Math.random().toString(36).substring(2, 8)}`

  const sepaDoc: SepaDocument = {
    message_id: messageId,
    creation_date: now.toISOString(),
    initiator_name: company.name,
    debtor_name: company.name,
    debtor_iban: bankAccount.iban,
    debtor_bic: bankAccount.bic || undefined,
    payments: sepaPayments,
  }

  const sepaXml = generateSepaXml(sepaDoc)

  const totalAmount = sepaPayments.reduce((sum, p) => sum + p.amount, 0)

  // Insert payment order
  const { data: order, error: orderError } = await (db
    .from("payment_orders") as any)
    .insert({
      company_id,
      bank_account_id,
      status: "nova",
      total_amount: totalAmount,
      payment_count: sepaPayments.length,
      sepa_xml: sepaXml,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  return NextResponse.json(order, { status: 201 })
}
