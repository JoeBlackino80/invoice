import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { predkontaciaSchema } from "@/lib/validations/journal"

// GET /api/predkontacie/:id - detail predkontacie
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { data, error } = await (db
    .from("predkontacie") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: "Predkontacia nebola najdena" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/predkontacie/:id - uprava predkontacie
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
    .from("predkontacie") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Predkontacia nebola najdena" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = predkontaciaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db
    .from("predkontacie") as any)
    .update({
      name: parsed.data.name,
      document_type: parsed.data.document_type,
      description: parsed.data.description || null,
      lines: parsed.data.lines,
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

// DELETE /api/predkontacie/:id - soft delete
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
    .from("predkontacie") as any)
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Predkontacia nebola najdena" }, { status: 404 })
  }

  const { error } = await (db
    .from("predkontacie") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
