import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// PUT /api/bank-matching-rules/:id - uprava pravidla parovania
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if exists
  const { data: existing, error: fetchError } = await (db
    .from("bank_matching_rules") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Pravidlo parovania nebolo najdene" }, { status: 404 })
  }

  const body = await request.json()
  const { name, condition_type, condition_value, debit_account, credit_account, description } = body

  if (!name || !condition_type || !condition_value || !debit_account || !credit_account) {
    return NextResponse.json({
      error: "Nazov, typ podmienky, hodnota podmienky, MD ucet a D ucet su povinne"
    }, { status: 400 })
  }

  const validConditionTypes = ["text", "iban", "vs"]
  if (!validConditionTypes.includes(condition_type)) {
    return NextResponse.json({
      error: "Neplatny typ podmienky. Povolene: text, iban, vs"
    }, { status: 400 })
  }

  const { data, error } = await (db
    .from("bank_matching_rules") as any)
    .update({
      name,
      condition_type,
      condition_value,
      debit_account,
      credit_account,
      description: description || null,
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

// DELETE /api/bank-matching-rules/:id - soft delete pravidla
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  // Check if exists
  const { data: existing, error: fetchError } = await (db
    .from("bank_matching_rules") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Pravidlo parovania nebolo najdene" }, { status: 404 })
  }

  const { error } = await (db
    .from("bank_matching_rules") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
