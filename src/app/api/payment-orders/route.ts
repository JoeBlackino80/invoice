import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { paymentOrderSchema } from "@/lib/validations/payment-order"
import { generateSepaXml } from "@/lib/bank/sepa-generator"
import type { SepaDocument, SepaPayment } from "@/lib/bank/sepa-generator"

// GET /api/payment-orders - zoznam platobnych prikazov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const status = searchParams.get("status")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("payment_orders") as any)
    .select(`
      id,
      company_id,
      bank_account_id,
      status,
      total_amount,
      payment_count,
      notes,
      approved_by,
      approved_at,
      created_at,
      updated_at,
      created_by,
      bank_account:bank_accounts(id, name, iban)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq("status", status)
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom)
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo + "T23:59:59")
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/payment-orders - vytvorenie platobneho prikazu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...orderData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = paymentOrderSchema.safeParse(orderData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Fetch bank account for debtor info
  const { data: bankAccount, error: bankError } = await (db
    .from("bank_accounts") as any)
    .select("*")
    .eq("id", parsed.data.bank_account_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (bankError || !bankAccount) {
    return NextResponse.json({ error: "Bankovy ucet nebol najdeny" }, { status: 404 })
  }

  // Fetch company info for SEPA initiator
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("id, name")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma nebola najdena" }, { status: 404 })
  }

  // Validate each item's invoice
  const sepaPayments: SepaPayment[] = []

  for (const item of parsed.data.items) {
    // Fetch invoice
    const { data: invoice, error: invError } = await (db
      .from("invoices") as any)
      .select("*, contact:contacts(id, name)")
      .eq("id", item.invoice_id)
      .is("deleted_at", null)
      .single() as { data: any; error: any }

    if (invError || !invoice) {
      return NextResponse.json(
        { error: `Faktura ${item.invoice_id} nebola najdena` },
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

    // Look up contact bank account (IBAN)
    const { data: contactBankAccounts } = await (db
      .from("contact_bank_accounts") as any)
      .select("*")
      .eq("contact_id", invoice.contact_id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })

    const creditorAccount = contactBankAccounts?.[0]
    if (!creditorAccount || !creditorAccount.iban) {
      return NextResponse.json(
        { error: `Kontakt "${invoice.contact?.name || invoice.supplier_name}" nema zadany IBAN` },
        { status: 400 }
      )
    }

    sepaPayments.push({
      id: `PMT-${item.invoice_id.substring(0, 8)}`,
      amount: item.amount,
      currency: invoice.currency || "EUR",
      creditor_name: invoice.contact?.name || invoice.supplier_name || "Neznamy",
      creditor_iban: creditorAccount.iban,
      creditor_bic: creditorAccount.bic || undefined,
      variable_symbol: item.variable_symbol || invoice.variable_symbol || undefined,
      constant_symbol: item.constant_symbol || undefined,
      specific_symbol: item.specific_symbol || undefined,
      remittance_info: `Uhrada fa. ${invoice.number}`,
      requested_date: parsed.data.requested_date || undefined,
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
      bank_account_id: parsed.data.bank_account_id,
      status: "nova",
      total_amount: totalAmount,
      payment_count: sepaPayments.length,
      sepa_xml: sepaXml,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  return NextResponse.json(order, { status: 201 })
}
