import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get("invoice_id")
  const companyId = searchParams.get("company_id")

  const db = createAdminClient()
  let query = (db.from("reminders") as any)
    .select("*")
    .order("created_at", { ascending: false })

  if (invoiceId) query = query.eq("invoice_id", invoiceId)
  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query.limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const body = await request.json()
  const db = createAdminClient()

  const { data, error } = await (db.from("reminders") as any)
    .insert({
      company_id: body.company_id,
      invoice_id: body.invoice_id,
      level: body.level || 1,
      notes: body.notes || "",
      sent_at: new Date().toISOString(),
      sent_to: body.sent_to || "",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
