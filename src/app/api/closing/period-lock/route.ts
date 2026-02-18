import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { periodLockSchema } from "@/lib/validations/closing"

// GET /api/closing/period-lock - Ziskanie stavu uzamknutia obdobi
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const fiscalYear = searchParams.get("fiscal_year")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("period_locks") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("period_start", { ascending: true })

  if (fiscalYear) {
    query = query
      .gte("period_start", `${fiscalYear}-01-01`)
      .lte("period_end", `${fiscalYear}-12-31`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/closing/period-lock - Uzamknutie obdobia
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()

  const parsed = periodLockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { company_id, period_start, period_end, locked } = parsed.data

  // Validate dates
  if (new Date(period_start) > new Date(period_end)) {
    return NextResponse.json({ error: "Zaciatok obdobia nemoze byt po konci obdobia" }, { status: 400 })
  }

  try {
    // Check if a period lock already exists for this period
    const { data: existing } = await (db.from("period_locks") as any)
      .select("id, locked")
      .eq("company_id", company_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .is("deleted_at", null)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing lock
      const { data: updated, error: updateError } = await (db.from("period_locks") as any)
        .update({
          locked,
          locked_at: locked ? new Date().toISOString() : null,
          locked_by: locked ? user.id : null,
          updated_by: user.id,
        })
        .eq("id", existing[0].id)
        .select()
        .single() as { data: any; error: any }

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json(updated)
    } else {
      // Create new lock
      const { data: created, error: createError } = await (db.from("period_locks") as any)
        .insert({
          company_id,
          period_start,
          period_end,
          locked,
          locked_at: locked ? new Date().toISOString() : null,
          locked_by: locked ? user.id : null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single() as { data: any; error: any }

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      return NextResponse.json(created, { status: 201 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa zmenit uzamknutie obdobia" }, { status: 500 })
  }
}

// DELETE /api/closing/period-lock - Odomknutie obdobia (iba admin)
export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const periodStart = searchParams.get("period_start")
  const periodEnd = searchParams.get("period_end")

  if (!companyId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "company_id, period_start a period_end su povinne" }, { status: 400 })
  }

  // Check admin role
  const { data: role } = await (db.from("user_company_roles") as any)
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .limit(1)

  if (!role || role.length === 0 || role[0].role !== "admin") {
    return NextResponse.json({ error: "Odomknutie obdobia je povolene iba pre administratorov" }, { status: 403 })
  }

  try {
    const { data: existing } = await (db.from("period_locks") as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .is("deleted_at", null)
      .limit(1)

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "Uzamknutie obdobia nebolo najdene" }, { status: 404 })
    }

    const { data: updated, error: updateError } = await (db.from("period_locks") as any)
      .update({
        locked: false,
        locked_at: null,
        locked_by: null,
        updated_by: user.id,
      })
      .eq("id", existing[0].id)
      .select()
      .single() as { data: any; error: any }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Nepodarilo sa odomknut obdobie" }, { status: 500 })
  }
}
