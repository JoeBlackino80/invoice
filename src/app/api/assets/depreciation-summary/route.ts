import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDepreciationForYear, getUsefulLife } from "@/lib/tax/depreciation-calculator"

// GET /api/assets/depreciation-summary - prehlad odpisov za rok
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Get all active assets for the company
  const { data: assets, error } = await (db.from("assets") as any)
    .select("*, asset_categories(id, name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("depreciation_group")
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get existing depreciation records for this year
  const { data: existingDeps } = await (db.from("asset_depreciations") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("year", year)

  const existingDepsMap = new Map<string, any>()
  if (existingDeps) {
    for (const dep of existingDeps) {
      existingDepsMap.set(dep.asset_id, dep)
    }
  }

  // Calculate depreciation for each asset
  const assetSummaries: any[] = []
  const groupSubtotals: Record<number, {
    count: number
    tax_depreciation: number
    accounting_depreciation: number
    difference: number
  }> = {}

  let totalTaxDepreciation = 0
  let totalAccountingDepreciation = 0

  for (const asset of (assets || [])) {
    // Check if asset should be depreciated in this year
    const startYear = new Date(asset.acquisition_date).getFullYear()
    const usefulLife = asset.useful_life_years || getUsefulLife(asset.depreciation_group)
    const endYear = startYear + usefulLife - 1

    if (year < startYear || year > endYear) {
      continue // skip assets not being depreciated this year
    }

    if (asset.status === "disposed") {
      const disposedYear = asset.disposed_at ? new Date(asset.disposed_at).getFullYear() : null
      if (disposedYear && year > disposedYear) {
        continue // skip assets disposed before this year
      }
    }

    // Check if already calculated
    const existingDep = existingDepsMap.get(asset.id)

    // Calculate theoretical depreciation
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

    const summary = {
      asset_id: asset.id,
      asset_name: asset.name,
      acquisition_cost: asset.acquisition_cost,
      depreciation_group: asset.depreciation_group,
      depreciation_method: asset.depreciation_method,
      status: asset.status,
      category_name: asset.asset_categories?.name || null,
      year,
      is_calculated: !!existingDep,
      tax_depreciation: existingDep?.tax_depreciation ?? depResult?.tax_depreciation ?? 0,
      accounting_depreciation: existingDep?.accounting_depreciation ?? depResult?.accounting_depreciation ?? 0,
      tax_accumulated: existingDep?.tax_accumulated ?? depResult?.tax_accumulated ?? 0,
      accounting_accumulated: existingDep?.accounting_accumulated ?? depResult?.accounting_accumulated ?? 0,
      tax_net_value: existingDep?.tax_net_value ?? depResult?.tax_net_value ?? 0,
      accounting_net_value: existingDep?.accounting_net_value ?? depResult?.accounting_net_value ?? 0,
      difference: (existingDep?.tax_depreciation ?? depResult?.tax_depreciation ?? 0) -
                  (existingDep?.accounting_depreciation ?? depResult?.accounting_depreciation ?? 0),
    }

    assetSummaries.push(summary)

    // Group subtotals
    const g = asset.depreciation_group
    if (!groupSubtotals[g]) {
      groupSubtotals[g] = { count: 0, tax_depreciation: 0, accounting_depreciation: 0, difference: 0 }
    }
    groupSubtotals[g].count++
    groupSubtotals[g].tax_depreciation += summary.tax_depreciation
    groupSubtotals[g].accounting_depreciation += summary.accounting_depreciation
    groupSubtotals[g].difference += summary.difference

    totalTaxDepreciation += summary.tax_depreciation
    totalAccountingDepreciation += summary.accounting_depreciation
  }

  // Round subtotals
  for (const g in groupSubtotals) {
    groupSubtotals[g].tax_depreciation = Math.round(groupSubtotals[g].tax_depreciation * 100) / 100
    groupSubtotals[g].accounting_depreciation = Math.round(groupSubtotals[g].accounting_depreciation * 100) / 100
    groupSubtotals[g].difference = Math.round(groupSubtotals[g].difference * 100) / 100
  }

  return NextResponse.json({
    year,
    assets: assetSummaries,
    group_subtotals: groupSubtotals,
    totals: {
      tax_depreciation_total: Math.round(totalTaxDepreciation * 100) / 100,
      accounting_depreciation_total: Math.round(totalAccountingDepreciation * 100) / 100,
      difference_total: Math.round((totalTaxDepreciation - totalAccountingDepreciation) * 100) / 100,
      asset_count: assetSummaries.length,
    },
  })
}
