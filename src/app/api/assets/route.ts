import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assetSchema } from "@/lib/validations/asset"
import { getUsefulLife } from "@/lib/tax/depreciation-calculator"

// GET /api/assets - zoznam majetku
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const status = searchParams.get("status")
  const group = searchParams.get("group")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("assets") as any)
    .select("*, asset_categories(id, name)", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq("status", status)
  }

  if (group) {
    query = query.eq("depreciation_group", parseInt(group))
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch latest depreciation data for each asset
  const assetsWithDepreciation = await Promise.all(
    (data || []).map(async (asset: any) => {
      const { data: latestDep } = await (db.from("asset_depreciations") as any)
        .select("*")
        .eq("asset_id", asset.id)
        .order("year", { ascending: false })
        .limit(1)
        .single() as { data: any; error: any }

      return {
        ...asset,
        latest_depreciation: latestDep || null,
      }
    })
  )

  return NextResponse.json({
    data: assetsWithDepreciation,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/assets - vytvorenie majetku
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...assetData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = assetSchema.safeParse(assetData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Auto-set useful_life from depreciation group if not provided
  const usefulLife = parsed.data.useful_life_years || getUsefulLife(parsed.data.depreciation_group)

  const { data, error } = await (db.from("assets") as any)
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      acquisition_date: parsed.data.acquisition_date,
      acquisition_cost: parsed.data.acquisition_cost,
      category_id: parsed.data.category_id || null,
      depreciation_group: parsed.data.depreciation_group,
      depreciation_method: parsed.data.depreciation_method,
      useful_life_years: usefulLife,
      tax_residual_value: parsed.data.tax_residual_value || 0,
      accounting_residual_value: parsed.data.accounting_residual_value || 0,
      status: "active",
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
