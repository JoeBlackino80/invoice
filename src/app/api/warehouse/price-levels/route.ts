import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/warehouse/price-levels – zoznam cenových hladín
export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const { data, error } = await (db.from("price_levels") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/warehouse/price-levels – vytvorenie / aktualizácia cenovej hladiny
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { id, company_id, name, type, percentage, is_default } = body as {
    id?: string
    company_id: string
    name: string
    type: "margin" | "markup"
    percentage: number
    is_default: boolean
  }

  if (!company_id || !name || !type || percentage === undefined) {
    return NextResponse.json(
      { error: "company_id, name, type a percentage sú povinné" },
      { status: 400 }
    )
  }

  if (type !== "margin" && type !== "markup") {
    return NextResponse.json(
      { error: "type musí byť 'margin' alebo 'markup'" },
      { status: 400 }
    )
  }

  if (percentage < 0 || percentage > 999) {
    return NextResponse.json(
      { error: "percentage musí byť medzi 0 a 999" },
      { status: 400 }
    )
  }

  // If setting as default, unset others first
  if (is_default) {
    await (db.from("price_levels") as any)
      .update({ is_default: false })
      .eq("company_id", company_id)
      .eq("is_default", true)
  }

  if (id) {
    // Update
    const { data, error } = await (db.from("price_levels") as any)
      .update({
        name,
        type,
        percentage,
        is_default: !!is_default,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single() as { data: any; error: any }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  }

  // Create
  const { data, error } = await (db.from("price_levels") as any)
    .insert({
      company_id,
      name,
      type,
      percentage,
      is_default: !!is_default,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
