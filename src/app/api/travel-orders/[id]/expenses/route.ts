import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { travelExpenseSchema } from "@/lib/validations/travel-order"

// GET /api/travel-orders/:id/expenses
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { data, error } = await (db.from("travel_expenses") as any)
    .select("*")
    .eq("travel_order_id", params.id)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/travel-orders/:id/expenses
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  // Overit ze cestovny prikaz existuje
  const { data: order, error: orderError } = await (
    db.from("travel_orders") as any
  )
    .select("id, company_id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (order.status === "settled") {
    return NextResponse.json(
      { error: "Nemozno pridat vydavok k vyuctovanemu cestovnemu prikazu" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const parsed = travelExpenseSchema.safeParse({
    ...body,
    travel_order_id: params.id,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await (db.from("travel_expenses") as any)
    .insert({
      travel_order_id: params.id,
      company_id: order.company_id,
      expense_type: parsed.data.expense_type,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      description: parsed.data.description || null,
      receipt_url: parsed.data.receipt_url || null,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aktualizovat celkovu sumu na cestovnom prikaze
  const { data: allExpenses } = await (db.from("travel_expenses") as any)
    .select("amount")
    .eq("travel_order_id", params.id)

  const totalExpenses = (allExpenses || []).reduce(
    (sum: number, e: any) => sum + (e.amount || 0),
    0
  )

  await (db.from("travel_orders") as any)
    .update({ total_amount: totalExpenses })
    .eq("id", params.id)

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/travel-orders/:id/expenses
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const body = await request.json()
  const { expense_id } = body

  if (!expense_id) {
    return NextResponse.json(
      { error: "expense_id je povinny" },
      { status: 400 }
    )
  }

  // Overit ze cestovny prikaz existuje a nie je vyuctovany
  const { data: order, error: orderError } = await (
    db.from("travel_orders") as any
  )
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Cestovny prikaz nebol najdeny" },
      { status: 404 }
    )
  }

  if (order.status === "settled") {
    return NextResponse.json(
      {
        error: "Nemozno odstranit vydavok z vyuctovaneho cestovneho prikazu",
      },
      { status: 400 }
    )
  }

  const { error } = await (db.from("travel_expenses") as any)
    .delete()
    .eq("id", expense_id)
    .eq("travel_order_id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aktualizovat celkovu sumu
  const { data: allExpenses } = await (db.from("travel_expenses") as any)
    .select("amount")
    .eq("travel_order_id", params.id)

  const totalExpenses = (allExpenses || []).reduce(
    (sum: number, e: any) => sum + (e.amount || 0),
    0
  )

  await (db.from("travel_orders") as any)
    .update({ total_amount: totalExpenses })
    .eq("id", params.id)

  return NextResponse.json({ success: true })
}
