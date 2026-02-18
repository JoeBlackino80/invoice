import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { employeeSchema } from "@/lib/validations/employee"

// GET /api/employees/:id – detail zamestnanca s zmluvami a detmi
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

  const { data, error } = await (db.from("employees") as any)
    .select(`
      *,
      employee_contracts (*),
      employee_children (*)
    `)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/employees/:id – aktualizacia zamestnanca
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

  const body = await request.json()
  const parsed = employeeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("employees") as any)
    .update({
      ...parsed.data,
      rodne_cislo: parsed.data.rodne_cislo || null,
      address_street: parsed.data.address_street || null,
      address_city: parsed.data.address_city || null,
      address_zip: parsed.data.address_zip || null,
      iban: parsed.data.iban || null,
      id_number: parsed.data.id_number || null,
      sp_registration_number: parsed.data.sp_registration_number || null,
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

// DELETE /api/employees/:id – soft delete zamestnanca
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

  const { error } = await (db.from("employees") as any)
    .update({
      deleted_at: new Date().toISOString(),
      active: false,
      updated_by: user.id,
    })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
