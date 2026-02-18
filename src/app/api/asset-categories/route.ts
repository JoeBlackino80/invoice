import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assetCategorySchema } from "@/lib/validations/asset"

// GET /api/asset-categories - zoznam kategorii majetku
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

  const { data, error } = await (db.from("asset_categories") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/asset-categories - vytvorenie kategorie
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...categoryData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = assetCategorySchema.safeParse(categoryData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("asset_categories") as any)
    .insert({
      name: parsed.data.name,
      depreciation_group: parsed.data.depreciation_group,
      useful_life: parsed.data.useful_life || null,
      depreciation_method: parsed.data.depreciation_method,
      company_id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
