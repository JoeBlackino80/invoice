import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { employeeChildSchema } from "@/lib/validations/employee"

// GET /api/employees/:id/children – zoznam deti zamestnanca
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

  const { data, error } = await (db.from("employee_children") as any)
    .select("*")
    .eq("employee_id", params.id)
    .order("date_of_birth", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/employees/:id/children – pridanie dietata
export async function POST(
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
  const childData = { ...body, employee_id: params.id }

  const parsed = employeeChildSchema.safeParse(childData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("employee_children") as any)
    .insert({
      employee_id: params.id,
      name: parsed.data.name,
      date_of_birth: parsed.data.date_of_birth,
      is_student: parsed.data.is_student,
      disability: parsed.data.disability,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/employees/:id/children – odstranenie dietata
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

  const body = await request.json()
  const { child_id } = body

  if (!child_id) {
    return NextResponse.json({ error: "child_id je povinny" }, { status: 400 })
  }

  // Verify child belongs to this employee
  const { data: child, error: findError } = await (db.from("employee_children") as any)
    .select("id")
    .eq("id", child_id)
    .eq("employee_id", params.id)
    .single() as { data: any; error: any }

  if (findError || !child) {
    return NextResponse.json({ error: "Dieta nebolo najdene" }, { status: 404 })
  }

  const { error } = await (db.from("employee_children") as any)
    .delete()
    .eq("id", child_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
