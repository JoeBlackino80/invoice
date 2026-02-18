import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/bank-transactions/:id - detail transakcie
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

  const { data, error } = await (db.from("bank_transactions") as any)
    .select(
      "*, bank_account:bank_accounts(id, name, iban, currency), bank_statement:bank_statements(id, statement_number, date), invoice:invoices(id, number, total_amount, status, contact:contacts(id, name))"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Transakcia nenajdena" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/bank-transactions/:id - aktualizacia transakcie
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

  // Check if transaction exists
  const { data: existing, error: existError } = await (db.from("bank_transactions") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (existError || !existing) {
    return NextResponse.json({ error: "Transakcia nenajdena" }, { status: 404 })
  }

  if (existing.status === "zauctovana") {
    return NextResponse.json({ error: "Zauctovanu transakciu nie je mozne upravit" }, { status: 400 })
  }

  const body = await request.json()

  // Build update object - only allow certain fields to be updated
  const updateData: Record<string, any> = {
    updated_by: user.id,
  }

  const allowedFields = [
    "date",
    "amount",
    "type",
    "counterparty_name",
    "counterparty_iban",
    "variable_symbol",
    "constant_symbol",
    "specific_symbol",
    "description",
    "reference",
    "status",
    "invoice_id",
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  const { data, error } = await (db.from("bank_transactions") as any)
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
