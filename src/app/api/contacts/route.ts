import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { contactSchema } from "@/lib/validations/contact"

// GET /api/contacts – zoznam kontaktov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  let query = db
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name")
    .range(offset, offset + limit - 1)

  if (type && type !== "vsetky") {
    query = query.eq("type", type)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,ico.ilike.%${search}%,email.ilike.%${search}%`)
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

// POST /api/contacts – vytvorenie kontaktu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...contactData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(contactData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await db
    .from("contacts")
    .insert({
      ...parsed.data,
      company_id,
      ico: parsed.data.ico || null,
      dic: parsed.data.dic || null,
      ic_dph: parsed.data.ic_dph || null,
      street: parsed.data.street || null,
      city: parsed.data.city || null,
      zip: parsed.data.zip || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      web: parsed.data.web || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
    } as any)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
