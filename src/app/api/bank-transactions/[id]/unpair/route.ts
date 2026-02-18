import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/bank-transactions/:id/unpair - zrusenie sparovania transakcie
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

  if (transaction.status !== "parovana") {
    return NextResponse.json({
      error: "Odparovat mozno iba transakcie v stave 'parovana'. Aktualny stav: " + transaction.status
    }, { status: 400 })
  }

  const invoiceId = transaction.matched_invoice_id
  const absAmount = Math.abs(transaction.amount)

  // Update bank_transaction: status="neparovana", remove matched_invoice_id
  const { data: updatedTx, error: updateTxError } = await (db
    .from("bank_transactions") as any)
    .update({
      status: "neparovana",
      matched_invoice_id: null,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (updateTxError) {
    return NextResponse.json({ error: updateTxError.message }, { status: 500 })
  }

  // Update invoice: paid_amount -= abs(transaction.amount), recalculate status
  if (invoiceId) {
    const { data: invoice, error: invFetchError } = await (db
      .from("invoices") as any)
      .select("total, paid_amount")
      .eq("id", invoiceId)
      .single() as { data: any; error: any }

    if (!invFetchError && invoice) {
      const newPaidAmount = Math.max((invoice.paid_amount || 0) - absAmount, 0)
      let newStatus: string

      if (newPaidAmount <= 0) {
        // Revert to the original non-paid status
        newStatus = "nova"
      } else if (newPaidAmount >= invoice.total) {
        newStatus = "uhradena"
      } else {
        newStatus = "ciastocne_uhradena"
      }

      await (db.from("invoices") as any)
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_by: user.id,
        })
        .eq("id", invoiceId)
    }

    // Delete the invoice_payment record linked to this transaction
    await (db.from("invoice_payments") as any)
      .delete()
      .eq("bank_transaction_id", params.id)
  }

  return NextResponse.json(updatedTx)
}
