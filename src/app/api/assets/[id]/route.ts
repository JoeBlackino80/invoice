import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assetSchema } from "@/lib/validations/asset"
import { calculateDepreciationSchedule } from "@/lib/tax/depreciation-calculator"

// GET /api/assets/:id - detail majetku s odpisovym planom
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

  const { data: asset, error } = await (db.from("assets") as any)
    .select("*, asset_categories(id, name)")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Majetok nenajdeny" }, { status: 404 })
  }

  // Get existing depreciation records
  const { data: depreciations } = await (db.from("asset_depreciations") as any)
    .select("*")
    .eq("asset_id", params.id)
    .order("year", { ascending: true })

  // Get asset movements
  const { data: movements } = await (db.from("asset_movements") as any)
    .select("*")
    .eq("asset_id", params.id)
    .order("date", { ascending: false })

  // Calculate full depreciation schedule
  const schedule = calculateDepreciationSchedule({
    name: asset.name,
    acquisition_cost: asset.acquisition_cost,
    acquisition_date: asset.acquisition_date,
    depreciation_group: asset.depreciation_group,
    depreciation_method: asset.depreciation_method,
    useful_life_years: asset.useful_life_years,
  })

  return NextResponse.json({
    ...asset,
    depreciations: depreciations || [],
    movements: movements || [],
    schedule,
  })
}

// PUT /api/assets/:id - aktualizacia majetku (iba ak este neboli vypocitane odpisy)
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

  // Check if any depreciations have been calculated
  const { count } = await (db.from("asset_depreciations") as any)
    .select("id", { count: "exact", head: true })
    .eq("asset_id", params.id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Majetok nie je mozne upravit, pretoze uz boli vypocitane odpisy" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const parsed = assetSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("assets") as any)
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      acquisition_date: parsed.data.acquisition_date,
      acquisition_cost: parsed.data.acquisition_cost,
      category_id: parsed.data.category_id || null,
      depreciation_group: parsed.data.depreciation_group,
      depreciation_method: parsed.data.depreciation_method,
      useful_life_years: parsed.data.useful_life_years,
      tax_residual_value: parsed.data.tax_residual_value || 0,
      accounting_residual_value: parsed.data.accounting_residual_value || 0,
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

// DELETE /api/assets/:id - soft delete majetku
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

  const { error } = await (db.from("assets") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
