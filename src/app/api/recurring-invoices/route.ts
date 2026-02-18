import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { recurringInvoiceSchema } from "@/lib/validations/recurring-invoice"

// GET /api/recurring-invoices - zoznam opakovaných faktúr
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const { data, error, count } = await (db
    .from("recurring_invoices") as any)
    .select(`
      *,
      contact:contacts(id, name, ico)
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("next_generation_date", { ascending: true })
    .range(offset, offset + limit - 1) as { data: any; error: any; count: number | null }

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

// POST /api/recurring-invoices - vytvorenie opakovanej faktúry
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...recurringData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const parsed = recurringInvoiceSchema.safeParse(recurringData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: recurring, error: recurringError } = await (db
    .from("recurring_invoices") as any)
    .insert({
      company_id,
      type: parsed.data.type,
      contact_id: parsed.data.contact_id || null,
      interval: parsed.data.interval,
      next_generation_date: parsed.data.next_generation_date,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      variable_symbol: parsed.data.variable_symbol || null,
      reverse_charge: parsed.data.reverse_charge,
      notes: parsed.data.notes || null,
      is_active: parsed.data.is_active,
      items: JSON.stringify(parsed.data.items),
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (recurringError) {
    return NextResponse.json({ error: recurringError.message }, { status: 500 })
  }

  return NextResponse.json(recurring, { status: 201 })
}
