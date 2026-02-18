import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { warehouseSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/warehouses - zoznam skladov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const { data, error } = await (db.from("warehouses") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get stock counts per warehouse
  const warehousesWithCounts = await Promise.all(
    (data || []).map(async (warehouse: any) => {
      const { count } = await (db.from("warehouse_stock_levels") as any)
        .select("*", { count: "exact", head: true })
        .eq("warehouse_id", warehouse.id)
        .gt("quantity", 0)

      return {
        ...warehouse,
        stock_items_count: count || 0,
      }
    })
  )

  return NextResponse.json({
    data: warehousesWithCounts,
  })
}

// POST /api/warehouse/warehouses - vytvorenie skladu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...warehouseData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = warehouseSchema.safeParse(warehouseData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check code uniqueness
  const { data: existing } = await (db.from("warehouses") as any)
    .select("id")
    .eq("company_id", company_id)
    .eq("code", parsed.data.code)
    .is("deleted_at", null)
    .maybeSingle() as { data: any; error: any }

  if (existing) {
    return NextResponse.json({ error: "Kód skladu už existuje" }, { status: 409 })
  }

  // If this is the default, unset other defaults
  if (parsed.data.is_default) {
    await (db.from("warehouses") as any)
      .update({ is_default: false })
      .eq("company_id", company_id)
  }

  const { data, error } = await (db.from("warehouses") as any)
    .insert({
      company_id,
      name: parsed.data.name,
      code: parsed.data.code,
      address: parsed.data.address || null,
      is_default: parsed.data.is_default,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
