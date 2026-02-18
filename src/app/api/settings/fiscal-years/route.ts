import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fiscalYearSchema } from "@/lib/validations/settings"

// GET /api/settings/fiscal-years - List fiscal years for company
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
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user has access
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  if (roleError || !role) {
    return NextResponse.json({ error: "Pristup zamietnuty" }, { status: 403 })
  }

  const { data, error } = await (db
    .from("fiscal_years") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/settings/fiscal-years - Create new fiscal year
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...yearData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  const parsed = fiscalYearSchema.safeParse(yearData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check for overlapping fiscal years
  const { data: existing, error: existingError } = await (db
    .from("fiscal_years") as any)
    .select("id, name, start_date, end_date")
    .eq("company_id", company_id)
    .or(`and(start_date.lte.${parsed.data.end_date},end_date.gte.${parsed.data.start_date})`)

  if (!existingError && existing && existing.length > 0) {
    return NextResponse.json({
      error: "Fiskalny rok sa prekryva s existujucim obdobim",
    }, { status: 400 })
  }

  const { data, error } = await (db
    .from("fiscal_years") as any)
    .insert({
      company_id,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      status: parsed.data.status || "active",
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PUT /api/settings/fiscal-years - Update fiscal year (close/reopen)
export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { id, company_id, status } = body

  if (!id || !company_id || !status) {
    return NextResponse.json({ error: "id, company_id a status su povinne" }, { status: 400 })
  }

  // Verify user is admin
  const { data: role, error: roleError } = await (db
    .from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .single() as { data: any; error: any }

  if (roleError || !role || role.role !== "admin") {
    return NextResponse.json({ error: "Pristup zamietnuty - vyzaduje sa rola admin" }, { status: 403 })
  }

  // If closing, check there are no unclosed prior years
  if (status === "closed") {
    const { data: currentYear } = await (db
      .from("fiscal_years") as any)
      .select("start_date")
      .eq("id", id)
      .single() as { data: any; error: any }

    if (currentYear) {
      const { data: unclosedPrior } = await (db
        .from("fiscal_years") as any)
        .select("id")
        .eq("company_id", company_id)
        .eq("status", "active")
        .lt("start_date", currentYear.start_date)

      if (unclosedPrior && unclosedPrior.length > 0) {
        return NextResponse.json({
          error: "Nemozno uzavriet - existuju neuzavrete predchadzajuce fiskalny roky",
        }, { status: 400 })
      }
    }
  }

  const { data, error } = await (db
    .from("fiscal_years") as any)
    .update({ status, updated_by: user.id })
    .eq("id", id)
    .eq("company_id", company_id)
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
