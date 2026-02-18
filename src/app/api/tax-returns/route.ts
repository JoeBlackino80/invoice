import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/tax-returns - zoznam danovych priznani
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const year = searchParams.get("year")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("tax_returns") as any)
    .select(`
      id,
      company_id,
      type,
      period_from,
      period_to,
      status,
      recognition_type,
      submitted_at,
      created_at,
      updated_at,
      created_by
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("period_from", { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) {
    query = query.eq("type", type)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (year) {
    query = query.gte("period_from", `${year}-01-01`)
    query = query.lte("period_to", `${year}-12-31`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}
