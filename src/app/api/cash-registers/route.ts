import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cashRegisterSchema } from "@/lib/validations/cash-register"

// GET /api/cash-registers - zoznam pokladni
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Fetch cash registers
  const { data: registers, error } = await (db.from("cash_registers") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate current balance for each register from transactions
  const registersWithBalance = await Promise.all(
    (registers || []).map(async (register: any) => {
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

      return {
        ...register,
        current_balance: balance,
      }
    })
  )

  return NextResponse.json({ data: registersWithBalance })
}

// POST /api/cash-registers - vytvorenie pokladne
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...registerData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = cashRegisterSchema.safeParse(registerData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("cash_registers") as any)
    .insert({
      ...parsed.data,
      company_id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
