import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  verifyStripeWebhook,
  handleStripeWebhook,
  matchPaymentToInvoice,
} from "@/lib/payments/payment-service"
import { logger } from "@/lib/logging/logger"
import { trackError } from "@/lib/monitoring/error-tracker"

// POST /api/payments/webhook - Prijímanie webhook notifikácií od platobných brán
export async function POST(request: Request) {
  const db = createAdminClient()

  const rawBody = await request.text()
  const source = request.headers.get("x-payment-source") || "stripe"

  try {
    if (source === "stripe") {
      const signature = request.headers.get("stripe-signature")
      const event = await verifyStripeWebhook(rawBody, signature)

      if (!event) {
        logger.warn("Stripe webhook signature verification failed")
        return NextResponse.json({ error: "Neplatný podpis" }, { status: 400 })
      }

      const result = await handleStripeWebhook(event)

      if (!result.success || !result.invoice_id || !result.payment_id) {
        return NextResponse.json({
          received: true,
          processed: false,
          error: result.error || "Chýbajúce údaje",
        })
      }

      // Aktualizovať záznam o platbe
      await (db.from("invoice_payments") as any)
        .update({ status: result.status, paid_at: new Date().toISOString() })
        .eq("transaction_id", result.payment_id)

      // Načítať faktúru pre matching
      const { data: invoice } = await (db.from("invoices") as any)
        .select("id, total_with_vat")
        .eq("id", result.invoice_id)
        .single() as { data: any; error: any }

      if (invoice && result.status === "completed") {
        await processPaymentCompletion(db, result.invoice_id, result.payment_id, invoice.total_with_vat, source)
      }

      logger.info(`Stripe webhook processed: ${event.type}`, {
        module: "payments",
        data: { payment_id: result.payment_id, invoice_id: result.invoice_id },
      })

      return NextResponse.json({ received: true, processed: true })
    }

    if (source === "gopay") {
      const body = JSON.parse(rawBody)
      const paymentId = body.id as string
      const state = body.state as string

      if (!paymentId) {
        return NextResponse.json({ error: "Chýba ID platby" }, { status: 400 })
      }

      let paymentStatus = "pending"
      if (state === "PAID") paymentStatus = "completed"
      else if (state === "CANCELED" || state === "TIMEOUTED") paymentStatus = "failed"
      else if (state === "REFUNDED") paymentStatus = "refunded"

      const { data: paymentRecord } = await (db.from("invoice_payments") as any)
        .update({
          status: paymentStatus,
          paid_at: paymentStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("transaction_id", paymentId)
        .select("invoice_id, amount")
        .single() as { data: any; error: any }

      if (paymentRecord && paymentStatus === "completed") {
        const { data: invoice } = await (db.from("invoices") as any)
          .select("id, total_with_vat")
          .eq("id", paymentRecord.invoice_id)
          .single() as { data: any; error: any }

        if (invoice) {
          await processPaymentCompletion(db, paymentRecord.invoice_id, paymentId, invoice.total_with_vat, "gopay")
        }
      }

      return NextResponse.json({ received: true, processed: true })
    }

    return NextResponse.json({ error: "Neznámy zdroj platby" }, { status: 400 })
  } catch (err) {
    trackError(err, { module: "payments", action: "webhook", requestMethod: "POST" }, "high")
    logger.error("Webhook processing error", err, { module: "payments" })
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 })
  }
}

/** Shared logic for processing completed payments */
async function processPaymentCompletion(
  db: any,
  invoiceId: string,
  paymentId: string,
  invoiceTotal: number,
  source: string
) {
  // Get total paid
  const { data: payments } = await (db.from("invoice_payments") as any)
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("status", "completed")

  const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const matchResult = matchPaymentToInvoice(
    {
      id: "",
      invoice_id: invoiceId,
      amount: 0,
      currency: "EUR",
      method: source as any,
      status: "completed",
      transaction_id: paymentId,
      created_at: new Date().toISOString(),
    },
    invoiceTotal || 0,
    totalPaid
  )

  // Update invoice status
  await (db.from("invoices") as any)
    .update({ status: matchResult.invoice_status })
    .eq("id", invoiceId)

  // Create notification
  const { data: invoiceData } = await (db.from("invoices") as any)
    .select("company_id, number")
    .eq("id", invoiceId)
    .single() as { data: any; error: any }

  if (invoiceData) {
    await (db.from("notifications") as any)
      .insert({
        company_id: invoiceData.company_id,
        type: "payment_received",
        title: "Platba prijatá",
        message: `Faktúra ${invoiceData.number} bola uhradená cez ${source}.`,
        data: {
          invoice_id: invoiceId,
          payment_id: paymentId,
          status: matchResult.invoice_status,
        },
      })
  }
}
