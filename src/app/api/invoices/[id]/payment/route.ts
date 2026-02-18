import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createPaymentJournalEntry } from "@/lib/accounting/auto-posting"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const body = await request.json()
  const { amount, payment_date, payment_method, notes } = body

  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Suma platby musí byť kladná" }, { status: 400 })
  }

  const db = createAdminClient()

  // Načítať faktúru
  const { data: invoice, error: invError } = await (db.from("invoices") as any)
    .select("id, company_id, total, paid_amount, status, type, number")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single()

  if (invError || !invoice) return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 })

  const paymentAmount = Number(amount)
  const currentPaid = Number(invoice.paid_amount) || 0
  const total = Number(invoice.total) || 0
  const newPaid = Math.min(currentPaid + paymentAmount, total)

  // Uložiť platbu
  await (db.from("invoice_payments") as any).insert({
    company_id: invoice.company_id,
    invoice_id: params.id,
    amount: paymentAmount,
    payment_date: payment_date || new Date().toISOString().split("T")[0],
    payment_method: payment_method || "prevod",
    notes: notes || "",
    created_by: user.id,
  })

  // Aktualizovať faktúru
  const newStatus = newPaid >= total ? "uhradena" : "ciastocne_uhradena"
  await (db.from("invoices") as any)
    .update({ paid_amount: newPaid, status: newStatus, updated_by: user.id })
    .eq("id", params.id)

  // Auto-posting
  const postingResult = await createPaymentJournalEntry(
    { db, companyId: invoice.company_id, userId: user.id },
    params.id,
    paymentAmount,
    payment_method || "prevod"
  )

  return NextResponse.json({
    success: true,
    new_paid_amount: newPaid,
    new_status: newStatus,
    journal_entry_id: postingResult.journalEntryId,
  })
}
