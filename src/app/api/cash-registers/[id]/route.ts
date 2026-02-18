import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cashRegisterSchema } from "@/lib/validations/cash-register"

// GET /api/cash-registers/:id - detail pokladne
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

  const { data: register, error } = await (db.from("cash_registers") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Pokladna nenajdena" }, { status: 404 })
  }

  // Calculate current balance from transactions
  const { data: transactions } = await (db.from("cash_transactions") as any)
    .select("type, amount")
    .eq("cash_register_id", register.id)
    .is("deleted_at", null)

  let balance = register.initial_balance || 0
  if (transactions) {
    for (const tx of transactions) {
      if (tx.type === "prijem") {
        balance += tx.amount
      } else {
        balance -= tx.amount
      }
    }
  }

  return NextResponse.json({
    ...register,
    current_balance: balance,
  })
}

// PUT /api/cash-registers/:id - aktualizacia pokladne
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
  const parsed = cashRegisterSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("cash_registers") as any)
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

// DELETE /api/cash-registers/:id - soft delete pokladne
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

  const { error } = await (db.from("cash_registers") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
