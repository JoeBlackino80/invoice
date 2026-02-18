import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { chartOfAccountSchema } from "@/lib/validations/accounting"

// GET /api/chart-of-accounts - zoznam ucetnych uctov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const search = searchParams.get("search")
  const typ = searchParams.get("typ")
  const active = searchParams.get("active")
  const trieda = searchParams.get("trieda")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("chart_of_accounts") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("synteticky_ucet")
    .order("analyticky_ucet")
    .range(offset, offset + limit - 1)

  if (typ) {
    query = query.eq("typ", typ)
  }

  if (active !== null && active !== undefined && active !== "") {
    query = query.eq("aktivny", active === "true")
  }

  if (trieda) {
    query = query.like("synteticky_ucet", `${trieda}%`)
  }

  if (search) {
    query = query.or(`synteticky_ucet.ilike.%${search}%,analyticky_ucet.ilike.%${search}%,nazov.ilike.%${search}%`)
  }

  const { data, error, count } = await query

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

// POST /api/chart-of-accounts - vytvorenie uctu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...accountData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = chartOfAccountSchema.safeParse(accountData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check for duplicate synteticky_ucet + analyticky_ucet
  const { data: existing } = await (db.from("chart_of_accounts") as any)
    .select("id")
    .eq("company_id", company_id)
    .eq("synteticky_ucet", parsed.data.synteticky_ucet)
    .eq("analyticky_ucet", parsed.data.analyticky_ucet || "")
    .is("deleted_at", null)
    .maybeSingle() as { data: any; error: any }

  if (existing) {
    return NextResponse.json(
      { error: "Ucet s tymto syntetickym a analytickym uctom uz existuje" },
      { status: 409 }
    )
  }

  const { data, error } = await (db.from("chart_of_accounts") as any)
    .insert({
      ...parsed.data,
      analyticky_ucet: parsed.data.analyticky_ucet || null,
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
