import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { depreciateSchema } from "@/lib/validations/asset"
import { getDepreciationForYear } from "@/lib/tax/depreciation-calculator"

// POST /api/assets/:id/depreciate - vypocitat a ulozit odpis za rok
export async function POST(
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
  const parsed = depreciateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { year } = parsed.data

  // Get the asset
  const { data: asset, error: assetError } = await (db.from("assets") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (assetError || !asset) {
    return NextResponse.json({ error: "Majetok nenajdeny" }, { status: 404 })
  }

  if (asset.status === "disposed") {
    return NextResponse.json({ error: "Majetok je vyradeny, nie je mozne odpisovat" }, { status: 400 })
  }

  // Check if depreciation for this year already exists
  const { data: existing } = await (db.from("asset_depreciations") as any)
    .select("id")
    .eq("asset_id", params.id)
    .eq("year", year)
    .single() as { data: any; error: any }

  if (existing) {
    return NextResponse.json(
      { error: `Odpis za rok ${year} uz bol vypocitany` },
      { status: 400 }
    )
  }

  // Check that the year is valid for this asset
  const startYear = new Date(asset.acquisition_date).getFullYear()
  const usefulLife = asset.useful_life_years || 4
  const endYear = startYear + usefulLife - 1

  if (year < startYear || year > endYear) {
    return NextResponse.json(
      { error: `Rok ${year} nie je v rozsahu odpisovania (${startYear}-${endYear})` },
      { status: 400 }
    )
  }

  // Check that previous years are depreciated
  if (year > startYear) {
    const { count: prevCount } = await (db.from("asset_depreciations") as any)
      .select("id", { count: "exact", head: true })
      .eq("asset_id", params.id)
      .eq("year", year - 1)

    if (!prevCount || prevCount === 0) {
      return NextResponse.json(
        { error: `Najprv je potrebne vypocitat odpis za rok ${year - 1}` },
        { status: 400 }
      )
    }
  }

  // Calculate depreciation
  const depResult = getDepreciationForYear(
    {
      name: asset.name,
      acquisition_cost: asset.acquisition_cost,
      acquisition_date: asset.acquisition_date,
      depreciation_group: asset.depreciation_group,
      depreciation_method: asset.depreciation_method,
      useful_life_years: asset.useful_life_years,
    },
    year
  )

  if (!depResult) {
    return NextResponse.json(
      { error: "Nie je mozne vypocitat odpis pre dany rok" },
      { status: 400 }
    )
  }

  // Save to asset_depreciations table
  const { data: depRecord, error: depError } = await (db.from("asset_depreciations") as any)
    .insert({
      company_id: asset.company_id,
      asset_id: params.id,
      year,
      period: year,
      tax_depreciation: depResult.tax_depreciation,
      accounting_depreciation: depResult.accounting_depreciation,
      tax_accumulated: depResult.tax_accumulated,
      accounting_accumulated: depResult.accounting_accumulated,
      tax_net_value: depResult.tax_net_value,
      accounting_net_value: depResult.accounting_net_value,
    })
    .select()
    .single() as { data: any; error: any }

  if (depError) {
    return NextResponse.json({ error: depError.message }, { status: 500 })
  }

  return NextResponse.json(depRecord, { status: 201 })
}
