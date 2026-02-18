import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { bankAccountSchema } from "@/lib/validations/bank"

// GET /api/bank-accounts/:id - detail bankoveho uctu
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

  const { data: account, error } = await (db.from("bank_accounts") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Bankovy ucet nenajdeny" }, { status: 404 })
  }

  // Calculate current balance from transactions
  const { data: transactions } = await (db.from("bank_transactions") as any)
    .select("amount")
    .eq("bank_account_id", account.id)
    .is("deleted_at", null)

  let balance = account.opening_balance || 0
  if (transactions) {
    for (const tx of transactions) {
      balance += tx.amount
    }
  }

  // Count unmatched transactions
  const { count: unmatchedCount } = await (db.from("bank_transactions") as any)
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", account.id)
    .eq("status", "neparovana")
    .is("deleted_at", null)

  return NextResponse.json({
    ...account,
    current_balance: balance,
    unmatched_count: unmatchedCount || 0,
  })
}

// PUT /api/bank-accounts/:id - aktualizacia bankoveho uctu
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

  const body = await request.json()
  const parsed = bankAccountSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("bank_accounts") as any)
    .update({
      ...parsed.data,
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

// DELETE /api/bank-accounts/:id - soft delete bankoveho uctu
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

  const { error } = await (db.from("bank_accounts") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
