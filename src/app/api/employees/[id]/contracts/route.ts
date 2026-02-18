import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { employeeContractSchema } from "@/lib/validations/employee"

// GET /api/employees/:id/contracts – zoznam zmluv zamestnanca
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

  const { data, error } = await (db.from("employee_contracts") as any)
    .select("*")
    .eq("employee_id", params.id)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/employees/:id/contracts – vytvorenie zmluvy
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
  const contractData = { ...body, employee_id: params.id }

  const parsed = employeeContractSchema.safeParse(contractData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("employee_contracts") as any)
    .insert({
      employee_id: params.id,
      contract_type: parsed.data.contract_type,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      gross_salary: parsed.data.gross_salary,
      position: parsed.data.position,
      work_hours_weekly: parsed.data.work_hours_weekly,
      probation_months: parsed.data.probation_months || null,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
