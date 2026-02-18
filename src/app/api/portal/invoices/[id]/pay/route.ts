import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createStripePaymentIntent,
  createGoPayPayment,
  generatePayBySquareQRCode,
  createPaymentRecord,
} from "@/lib/payments/payment-service"

// Pomocná funkcia na overenie portál tokenu
async function verifyPortalToken(db: any, token: string) {
  const { data, error } = await (db
    .from("portal_tokens") as any)
    .select("id, contact_id, company_id, expires_at")
    .eq("token", token)
    .single() as { data: any; error: any }

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null

  return data
}

// POST /api/portal/invoices/:id/pay - Iniciovať platbu za faktúru
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const db = createAdminClient()

  const portalToken = request.headers.get("x-portal-token")
  if (!portalToken) {
    return NextResponse.json({ error: "Chýba prístupový token" }, { status: 401 })
  }

  const session = await verifyPortalToken(db, portalToken)
  if (!session) {
    return NextResponse.json({ error: "Neplatný alebo expirovaný token" }, { status: 401 })
  }

  const body = await request.json()
  const { method } = body

  if (!method || !["stripe", "gopay", "bank_transfer"].includes(method)) {
    return NextResponse.json({ error: "Neplatný spôsob platby" }, { status: 400 })
  }

  // Načítať faktúru
  const { data: invoice, error: invoiceError } = await (db
    .from("invoices") as any)
    .select("id, number, total_with_vat, currency, status, variable_symbol, constant_symbol, specific_symbol, due_date, supplier_name, supplier_iban, notes")
    .eq("id", params.id)
    .eq("company_id", session.company_id)
    .eq("contact_id", session.contact_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  // Overiť, či je faktúra splatná
  if (invoice.status === "uhradena") {
    return NextResponse.json({ error: "Faktúra je už uhradená" }, { status: 400 })
  }

  if (invoice.status === "draft" || invoice.status === "stornovana") {
    return NextResponse.json({ error: "Faktúru nie je možné uhradiť" }, { status: 400 })
  }

  const amount = invoice.total_with_vat || 0
  const currency = invoice.currency || "EUR"

  try {
    if (method === "stripe") {
      const paymentIntent = await createStripePaymentIntent(
        Math.round(amount * 100), // Stripe uses cents
        currency,
        invoice.id,
        session.company_id
      )

      // Vytvoriť záznam o platbe
      const paymentRecord = createPaymentRecord(invoice.id, amount, "stripe", paymentIntent.id)

      await (db
        .from("invoice_payments") as any)
        .insert({
          invoice_id: invoice.id,
          company_id: session.company_id,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          method: paymentRecord.method,
          status: paymentRecord.status,
          transaction_id: paymentRecord.transaction_id,
        })

      return NextResponse.json({
        method: "stripe",
        payment_url: paymentIntent.payment_url,
        client_secret: paymentIntent.client_secret,
        payment_id: paymentIntent.id,
      })
    }

    if (method === "gopay") {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const returnUrl = `${baseUrl}/portal/invoices/${invoice.id}?payment=completed`

      const goPayPayment = await createGoPayPayment(amount, currency, invoice.id, returnUrl)

      // Vytvoriť záznam o platbe
      const paymentRecord = createPaymentRecord(invoice.id, amount, "gopay", goPayPayment.id)

      await (db
        .from("invoice_payments") as any)
        .insert({
          invoice_id: invoice.id,
          company_id: session.company_id,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          method: paymentRecord.method,
          status: paymentRecord.status,
          transaction_id: paymentRecord.transaction_id,
        })

      return NextResponse.json({
        method: "gopay",
        payment_url: goPayPayment.gw_url,
        payment_id: goPayPayment.id,
      })
    }

    if (method === "bank_transfer") {
      // Generovať QR kód PAY by square
      const iban = invoice.supplier_iban || ""
      const vs = invoice.variable_symbol || ""
      const ks = invoice.constant_symbol || ""
      const ss = invoice.specific_symbol || ""
      const note = `Úhrada faktúry ${invoice.number}`

      let qrCode: string | null = null
      if (iban) {
        try {
          qrCode = await generatePayBySquareQRCode(
            iban,
            amount,
            invoice.supplier_name || "",
            vs,
            ks,
            ss,
            note,
            invoice.due_date || undefined
          )
        } catch {
          // QR kód sa nepodarilo vygenerovať
          qrCode = null
        }
      }

      return NextResponse.json({
        method: "bank_transfer",
        bank_details: {
          iban: iban,
          amount: amount,
          currency: currency,
          variable_symbol: vs,
          constant_symbol: ks,
          specific_symbol: ss,
          recipient_name: invoice.supplier_name || "",
          note: note,
        },
        qr_code: qrCode,
      })
    }
  } catch (err) {
    return NextResponse.json({
      error: "Nepodarilo sa iniciovať platbu",
    }, { status: 500 })
  }

  return NextResponse.json({ error: "Neplatný spôsob platby" }, { status: 400 })
}
