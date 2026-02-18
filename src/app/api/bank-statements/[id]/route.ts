import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/bank-statements/:id - detail vypisu s jeho transakciami
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

  const { data: statement, error } = await (db.from("bank_statements") as any)
    .select("*, bank_account:bank_accounts(id, name, iban, currency)")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Vypis nenajdeny" }, { status: 404 })
  }

  // Fetch transactions for this statement
  const { data: transactions, error: txError } = await (db.from("bank_transactions") as any)
    .select("*")
    .eq("bank_statement_id", params.id)
    .is("deleted_at", null)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...statement,
    transactions: transactions || [],
  })
}

// DELETE /api/bank-statements/:id - soft delete vypisu aj jeho transakcii
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

  // Check that statement exists
  const { data: statement, error: stmtError } = await (db.from("bank_statements") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (stmtError || !statement) {
    return NextResponse.json({ error: "Vypis nenajdeny" }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Soft delete all transactions belonging to this statement
  const { error: txDeleteError } = await (db.from("bank_transactions") as any)
    .update({ deleted_at: now })
    .eq("bank_statement_id", params.id)

  if (txDeleteError) {
    return NextResponse.json({ error: txDeleteError.message }, { status: 500 })
  }

  // Soft delete the statement itself
  const { error } = await (db.from("bank_statements") as any)
    .update({ deleted_at: now })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
