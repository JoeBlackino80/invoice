import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validations/warehouse"

// GET /api/warehouse/products - zoznam produktov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const search = searchParams.get("search")
  const category = searchParams.get("category_id")
  const stockStatus = searchParams.get("stock_status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = (db.from("warehouse_products") as any)
    .select("*, warehouse_stock_levels(*)", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,ean_code.ilike.%${search}%`)
  }

  if (category) {
    query = query.eq("category_id", category)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by stock status if needed
  let filteredData = data || []
  if (stockStatus && filteredData.length > 0) {
    filteredData = filteredData.filter((product: any) => {
      const totalStock = (product.warehouse_stock_levels || []).reduce(
        (sum: number, sl: any) => sum + (sl.quantity || 0),
        0
      )
      switch (stockStatus) {
        case "in_stock":
          return totalStock > 0 && (!product.min_stock || totalStock >= product.min_stock)
        case "low_stock":
          return totalStock > 0 && product.min_stock && totalStock < product.min_stock
        case "out_of_stock":
          return totalStock <= 0
        default:
          return true
      }
    })
  }

  return NextResponse.json({
    data: filteredData,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/warehouse/products - vytvorenie produktu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...productData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = productSchema.safeParse(productData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check SKU uniqueness
  const { data: existing } = await (db.from("warehouse_products") as any)
    .select("id")
    .eq("company_id", company_id)
    .eq("sku", parsed.data.sku)
    .is("deleted_at", null)
    .maybeSingle() as { data: any; error: any }

  if (existing) {
    return NextResponse.json({ error: "SKU kód už existuje" }, { status: 409 })
  }

  const { data, error } = await (db.from("warehouse_products") as any)
    .insert({
      company_id,
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
