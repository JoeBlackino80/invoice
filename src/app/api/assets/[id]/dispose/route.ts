import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assetDisposeSchema } from "@/lib/validations/asset"

// POST /api/assets/:id/dispose - vyradenie majetku
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
  const parsed = assetDisposeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

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
    return NextResponse.json({ error: "Majetok je uz vyradeny" }, { status: 400 })
  }

  const reasonLabels: Record<string, string> = {
    predaj: "Predaj",
    likvidacia: "Likvidacia",
    strata: "Strata",
    dar: "Darovanie",
  }

  // Update asset status
  const { error: updateError } = await (db.from("assets") as any)
    .update({
      status: "disposed",
      disposed_at: parsed.data.disposed_date,
      disposed_reason: parsed.data.disposed_reason,
      updated_by: user.id,
    })
    .eq("id", params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Create asset_movement record
  const movementDescription = `${reasonLabels[parsed.data.disposed_reason] || parsed.data.disposed_reason} majetku`
  const { data: movement, error: movementError } = await (db.from("asset_movements") as any)
    .insert({
      company_id: asset.company_id,
      asset_id: params.id,
      type: parsed.data.disposed_reason,
      date: parsed.data.disposed_date,
      amount: parsed.data.sale_amount || 0,
      description: movementDescription,
    })
    .select()
    .single() as { data: any; error: any }

  if (movementError) {
    return NextResponse.json({ error: movementError.message }, { status: 500 })
  }

  return NextResponse.json({
    message: "Majetok bol uspesne vyradeny",
    movement,
  })
}
