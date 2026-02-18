import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/bank-transactions/:id/pair - manualne sparovanie transakcie s fakturou
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { invoice_id } = body

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id je povinny" }, { status: 400 })
  }

  // Fetch the bank transaction
  const { data: transaction, error: txError } = await (db
    .from("bank_transactions") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (txError || !transaction) {
    return NextResponse.json({ error: "Bankova transakcia nebola najdena" }, { status: 404 })
  }

  if (transaction.status !== "neparovana") {
    return NextResponse.json({
      error: "Transakcia uz je sparovana alebo zauctovana. Aktualny stav: " + transaction.status
    }, { status: 400 })
  }

  // Fetch the invoice
  const { data: invoice, error: invError } = await (db
    .from("invoices") as any)
    .select("*")
    .eq("id", invoice_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (invError || !invoice) {
    return NextResponse.json({ error: "Faktura nebola najdena" }, { status: 404 })
  }

  if (invoice.status === "uhradena" || invoice.status === "stornovana") {
    return NextResponse.json({
      error: "Faktura je uz uhradena alebo stornovana"
    }, { status: 400 })
  }

  const absAmount = Math.abs(transaction.amount)

  // Update bank_transaction: status="parovana", matched_invoice_id
  const { data: updatedTx, error: updateTxError } = await (db
    .from("bank_transactions") as any)
    .update({
      status: "parovana",
      matched_invoice_id: invoice_id,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateTxError) {
    return NextResponse.json({ error: updateTxError.message }, { status: 500 })
  }

  // Update invoice: paid_amount += abs(transaction.amount)
  const newPaidAmount = (invoice.paid_amount || 0) + absAmount
  const isFullyPaid = newPaidAmount >= invoice.total
  const newStatus = isFullyPaid ? "uhradena" : "ciastocne_uhradena"

  const { error: updateInvError } = await (db
    .from("invoices") as any)
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_by: user.id,
    })
    .eq("id", invoice_id)

  if (updateInvError) {
    // Rollback transaction update
    await (db.from("bank_transactions") as any)
      .update({
        status: "neparovana",
        matched_invoice_id: null,
        updated_by: user.id,
      })
      .eq("id", params.id)

    return NextResponse.json({ error: updateInvError.message }, { status: 500 })
  }

  // Create invoice_payment record
  const { error: paymentError } = await (db
    .from("invoice_payments") as any)
    .insert({
      invoice_id,
      company_id: transaction.company_id,
      amount: absAmount,
      payment_date: transaction.date,
      payment_method: "bankovy_prevod",
      bank_transaction_id: params.id,
      created_by: user.id,
    })

  if (paymentError) {
    // Log but don't fail - the pairing itself succeeded
    console.error("Chyba pri vytvarani zaznamu platby:", paymentError.message)
  }

  return NextResponse.json(updatedTx)
}
