import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cashTransactionSchema } from "@/lib/validations/cash-register"

// GET /api/cash-transactions/:id - detail transakcie
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await (db.from("cash_transactions") as any)
    .select("*, cash_register:cash_registers(id, name, currency), invoice:invoices(id, number)")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Transakcia nenajdena" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/cash-transactions/:id - aktualizacia transakcie (len ak nie je zauctovana)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if transaction exists and is not posted
  const { data: existing, error: existError } = await (db.from("cash_transactions") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (existError || !existing) {
    return NextResponse.json({ error: "Transakcia nenajdena" }, { status: 404 })
  }

  if (existing.posted_at) {
    return NextResponse.json({ error: "Zauctovanu transakciu nie je mozne upravit" }, { status: 400 })
  }

  const body = await request.json()
  const parsed = cashTransactionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // If type is vydaj or amount changed, re-validate balance
  if (parsed.data.type === "vydaj") {
    const { data: register } = await (db.from("cash_registers") as any)
      .select("initial_balance, currency")
      .eq("id", parsed.data.cash_register_id)
      .single() as { data: any; error: any }

    const { data: allTx } = await (db.from("cash_transactions") as any)
      .select("id, type, amount")
      .eq("cash_register_id", parsed.data.cash_register_id)
      .is("deleted_at", null)
      .neq("id", params.id) // exclude current transaction

    let balance = register?.initial_balance || 0
    if (allTx) {
      for (const tx of allTx) {
        if (tx.type === "prijem") {
          balance += tx.amount
        } else {
          balance -= tx.amount
        }
      }
    }

    if (balance < parsed.data.amount) {
      return NextResponse.json(
        { error: "Nedostatocny zostatok v pokladni. Aktualny zostatok: " + balance.toFixed(2) + " " + (register?.currency || "EUR") },
        { status: 400 }
      )
    }
  }

  const { data, error } = await (db.from("cash_transactions") as any)
    .update({
      cash_register_id: parsed.data.cash_register_id,
      type: parsed.data.type,
      date: parsed.data.date,
      amount: parsed.data.amount,
      purpose: parsed.data.purpose,
      person: parsed.data.person || null,
      invoice_id: parsed.data.invoice_id || null,
      notes: parsed.data.notes || null,
      updated_by: user.id,
    })
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/cash-transactions/:id - soft delete (len ak nie je zauctovana)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if transaction is posted
  const { data: existing, error: existError } = await (db.from("cash_transactions") as any)
    .select("posted_at")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (existError || !existing) {
    return NextResponse.json({ error: "Transakcia nenajdena" }, { status: 404 })
  }

  if (existing.posted_at) {
    return NextResponse.json({ error: "Zauctovanu transakciu nie je mozne odstranit" }, { status: 400 })
  }

  const { error } = await (db.from("cash_transactions") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
