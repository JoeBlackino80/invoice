import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  handleStripeWebhook,
  matchPaymentToInvoice,
} from "@/lib/payments/payment-service"

// POST /api/payments/webhook - Prijímanie webhook notifikácií od platobných brán
export async function POST(request: Request) {
  const supabase = createClient()
  const db = createAdminClient()

  const body = await request.json()
  const source = request.headers.get("x-payment-source") || "stripe"

  try {
    if (source === "stripe") {
      // Simulácia overenia Stripe webhook podpisu
      // V produkcii: const sig = request.headers.get("stripe-signature")
      // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

      const result = await handleStripeWebhook(body)

      if (!result.success || !result.invoice_id || !result.payment_id) {
        return NextResponse.json({
          received: true,
          processed: false,
          error: result.error || "Chýbajúce údaje",
        })
      }

      // Aktualizovať záznam o platbe
      await (db
        .from("invoice_payments") as any)
        .update({ status: result.status, paid_at: new Date().toISOString() })
        .eq("transaction_id", result.payment_id)

      // Načítať faktúru pre matching
      const { data: invoice } = await (db
        .from("invoices") as any)
        .select("id, total_with_vat")
        .eq("id", result.invoice_id)
        .single() as { data: any; error: any }

      if (invoice && result.status === "completed") {
        // Načítať celkovo zaplatené
        const { data: payments } = await (db
          .from("invoice_payments") as any)
          .select("amount")
          .eq("invoice_id", result.invoice_id)
          .eq("status", "completed")

        const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

        const matchResult = matchPaymentToInvoice(
          {
            id: "",
            invoice_id: result.invoice_id,
            amount: 0,
            currency: "EUR",
            method: "stripe",
            status: "completed",
            transaction_id: result.payment_id,
            created_at: new Date().toISOString(),
          },
          invoice.total_with_vat || 0,
          totalPaid
        )

        // Aktualizovať stav faktúry
        await (db
          .from("invoices") as any)
          .update({ status: matchResult.invoice_status })
          .eq("id", result.invoice_id)

        // Vytvoriť notifikáciu
        const { data: invoiceData } = await (db
          .from("invoices") as any)
          .select("company_id, number")
          .eq("id", result.invoice_id)
          .single() as { data: any; error: any }

        if (invoiceData) {
          await (db
            .from("notifications") as any)
            .insert({
              company_id: invoiceData.company_id,
              type: "payment_received",
              title: "Platba prijatá",
              message: `Faktúra ${invoiceData.number} bola uhradená cez ${source}.`,
              data: {
                invoice_id: result.invoice_id,
                payment_id: result.payment_id,
                status: matchResult.invoice_status,
              },
            })
        }
      }

      return NextResponse.json({ received: true, processed: true })
    }

    if (source === "gopay") {
      // Simulácia GoPay webhook spracovania
      const paymentId = body.id as string
      const state = body.state as string

      if (!paymentId) {
        return NextResponse.json({ error: "Chýba ID platby" }, { status: 400 })
      }

      let paymentStatus = "pending"
      if (state === "PAID") paymentStatus = "completed"
      else if (state === "CANCELED" || state === "TIMEOUTED") paymentStatus = "failed"
      else if (state === "REFUNDED") paymentStatus = "refunded"

      // Aktualizovať záznam o platbe
      const { data: paymentRecord } = await (db
        .from("invoice_payments") as any)
        .update({
          status: paymentStatus,
          paid_at: paymentStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("transaction_id", paymentId)
        .select("invoice_id, amount")
        .single() as { data: any; error: any }

      if (paymentRecord && paymentStatus === "completed") {
        // Načítať faktúru
        const { data: invoice } = await (db
          .from("invoices") as any)
          .select("id, total_with_vat, company_id, number")
          .eq("id", paymentRecord.invoice_id)
          .single() as { data: any; error: any }

        if (invoice) {
          // Celkové platby
          const { data: payments } = await (db
            .from("invoice_payments") as any)
            .select("amount")
            .eq("invoice_id", paymentRecord.invoice_id)
            .eq("status", "completed")

          const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

          const matchResult = matchPaymentToInvoice(
            {
              id: "",
              invoice_id: paymentRecord.invoice_id,
              amount: paymentRecord.amount || 0,
              currency: "EUR",
              method: "gopay",
              status: "completed",
              transaction_id: paymentId,
              created_at: new Date().toISOString(),
            },
            invoice.total_with_vat || 0,
            totalPaid
          )

          await (db
            .from("invoices") as any)
            .update({ status: matchResult.invoice_status })
            .eq("id", paymentRecord.invoice_id)

          await (db
            .from("notifications") as any)
            .insert({
              company_id: invoice.company_id,
              type: "payment_received",
              title: "Platba prijatá",
              message: `Faktúra ${invoice.number} bola uhradená cez GoPay.`,
              data: {
                invoice_id: paymentRecord.invoice_id,
                payment_id: paymentId,
                status: matchResult.invoice_status,
              },
            })
        }
      }

      return NextResponse.json({ received: true, processed: true })
    }

    return NextResponse.json({ error: "Neznámy zdroj platby" }, { status: 400 })
  } catch (err) {
    console.error("[Webhook Error]", err)
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 })
  }
}
