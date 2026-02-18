import { NextResponse } from "next/server"
import { apiHandler } from "@/lib/api/handler"
import {
  createStripeCheckoutSession,
  createStripePaymentIntent,
  createPaymentRecord,
} from "@/lib/payments/payment-service"
import { isStripeConfigured } from "@/lib/payments/stripe-client"

// POST /api/payments/checkout - create a payment session for an invoice
export const POST = apiHandler(async (request, { user, db, log }) => {
  const body = await request.json()
  const { invoice_id, method } = body

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id je povinný" }, { status: 400 })
  }

  // Fetch invoice
  const { data: invoice } = await (db.from("invoices") as any)
    .select("id, number, total, currency, status, company_id, paid_amount")
    .eq("id", invoice_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (!invoice) {
    return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })
  }

  if (invoice.status === "uhradena") {
    return NextResponse.json({ error: "Faktúra je už uhradená" }, { status: 400 })
  }

  if (invoice.status === "draft" || invoice.status === "stornovana") {
    return NextResponse.json({ error: "Faktúru nie je možné uhradiť" }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const remaining = (Number(invoice.total) || 0) - (Number(invoice.paid_amount) || 0)
  const amountCents = Math.round(remaining * 100)
  const currency = invoice.currency || "EUR"

  if (method === "checkout" || method === "stripe_checkout") {
    // Stripe Checkout Session (hosted page)
    const session = await createStripeCheckoutSession(
      amountCents,
      currency,
      invoice.id,
      invoice.number,
      invoice.company_id,
      `${baseUrl}/invoices/${invoice.id}?payment=success`,
      `${baseUrl}/invoices/${invoice.id}?payment=cancel`
    )

    // Save payment record
    const record = createPaymentRecord(invoice.id, remaining, "stripe", session.sessionId)
    await (db.from("invoice_payments") as any).insert({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      amount: record.amount,
      currency: record.currency,
      method: record.method,
      status: record.status,
      transaction_id: record.transaction_id,
    })

    log.info("Stripe checkout session created", {
      invoiceId: invoice.id,
      sessionId: session.sessionId,
    })

    return NextResponse.json({
      method: "stripe_checkout",
      url: session.url,
      session_id: session.sessionId,
    })
  }

  if (method === "payment_intent" || method === "stripe") {
    // Stripe PaymentIntent (embedded Elements)
    const intent = await createStripePaymentIntent(
      amountCents,
      currency,
      invoice.id,
      invoice.company_id
    )

    // Save payment record
    const record = createPaymentRecord(invoice.id, remaining, "stripe", intent.id)
    await (db.from("invoice_payments") as any).insert({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      amount: record.amount,
      currency: record.currency,
      method: record.method,
      status: record.status,
      transaction_id: record.transaction_id,
    })

    log.info("Stripe payment intent created", {
      invoiceId: invoice.id,
      intentId: intent.id,
    })

    return NextResponse.json({
      method: "stripe",
      client_secret: intent.client_secret,
      payment_id: intent.id,
      publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    })
  }

  return NextResponse.json({
    error: "Neplatný spôsob platby. Použite: checkout, payment_intent",
    stripe_configured: isStripeConfigured(),
  }, { status: 400 })
})
