import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { quoteSchema } from "@/lib/validations/quote"

// GET /api/quotes - zoznam cenových ponúk
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const status = searchParams.get("status")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = db
    .from("quotes")
    .select(`
      *,
      contact:contacts(id, name, ico)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(`number.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/quotes - vytvorenie cenovej ponuky
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...quoteData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = quoteSchema.safeParse(quoteData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Generate quote number
  const { data: quoteNumber, error: numberError } = await (db
    .rpc as any)("generate_next_number", {
      p_company_id: company_id,
      p_type: "cenova_ponuka",
    })

  if (numberError) {
    return NextResponse.json({ error: numberError.message }, { status: 500 })
  }

  const { items, ...quoteHeaderData } = parsed.data

  // Calculate total
  const total = items.reduce((sum, item) => {
    const subtotal = (item.quantity || 1) * item.unit_price
    const vat = subtotal * ((item.vat_rate || 23) / 100)
    return sum + subtotal + vat
  }, 0)

  // Insert quote
  const { data: quote, error: quoteError } = await (db
    .from("quotes") as any)
    .insert({
      ...quoteHeaderData,
      company_id,
      number: quoteNumber,
      contact_id: parsed.data.contact_id || null,
      notes: parsed.data.notes || null,
      items,
      total: Math.round(total * 100) / 100,
      status: "draft",
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  return NextResponse.json(quote, { status: 201 })
}
