import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/products/:id - detail produktu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Get product with stock levels
  const { data: product, error } = await (db.from("warehouse_products") as any)
    .select(`
      *,
      warehouse_stock_levels (
        id,
        warehouse_id,
        quantity,
        warehouse:warehouses (id, name, code)
      )
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // Get recent movements
  const { data: movements } = await (db.from("stock_movements") as any)
    .select(`
      *,
      warehouse:warehouses (id, name, code)
    `)
    .eq("product_id", params.id)
    .order("movement_date", { ascending: false })
    .limit(20) as { data: any; error: any }

  return NextResponse.json({
    ...product,
    recent_movements: movements || [],
  })
}

// PUT /api/warehouse/products/:id - aktualizácia produktu
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const parsed = productSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check SKU uniqueness (exclude current product)
  const { data: existing } = await (db.from("warehouse_products") as any)
    .select("id")
    .eq("sku", parsed.data.sku)
    .is("deleted_at", null)
    .neq("id", params.id)
    .maybeSingle() as { data: any; error: any }

  if (existing) {
    return NextResponse.json({ error: "SKU kód už existuje" }, { status: 409 })
  }

  const { data, error } = await (db.from("warehouse_products") as any)
    .update({
      name: parsed.data.name,
      sku: parsed.data.sku,
      description: parsed.data.description || null,
      unit: parsed.data.unit,
      category_id: parsed.data.category_id || null,
      min_stock: parsed.data.min_stock ?? null,
      max_stock: parsed.data.max_stock ?? null,
      ean_code: parsed.data.ean_code || null,
      purchase_price: parsed.data.purchase_price ?? null,
      sale_price: parsed.data.sale_price ?? null,
      vat_rate: parsed.data.vat_rate,
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

// DELETE /api/warehouse/products/:id - soft delete produktu
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { error } = await (db.from("warehouse_products") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
