import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/bank-matching-rules - zoznam pravidiel parovania
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const { data, error, count } = await (db.from("bank_matching_rules") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/bank-matching-rules - vytvorenie pravidla parovania
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, name, condition_type, condition_value, debit_account, credit_account, description } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!name || !condition_type || !condition_value || !debit_account || !credit_account) {
    return NextResponse.json({
      error: "Nazov, typ podmienky, hodnota podmienky, MD ucet a D ucet su povinne"
    }, { status: 400 })
  }

  const validConditionTypes = ["text", "iban", "vs"]
  if (!validConditionTypes.includes(condition_type)) {
    return NextResponse.json({
      error: "Neplatny typ podmienky. Povolene: text, iban, vs"
    }, { status: 400 })
  }

  const { data, error } = await (db.from("bank_matching_rules") as any)
    .insert({
      company_id,
      name,
      condition_type,
      condition_value,
      debit_account,
      credit_account,
      description: description || null,
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
