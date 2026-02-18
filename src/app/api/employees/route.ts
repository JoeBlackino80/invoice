import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { employeeSchema } from "@/lib/validations/employee"

// GET /api/employees – zoznam zamestnancov
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const search = searchParams.get("search")
  const contractType = searchParams.get("contract_type")
  const status = searchParams.get("status") // active / inactive
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("employees") as any)
    .select(`
      id,
      name,
      surname,
      date_of_birth,
      address_city,
      iban,
      health_insurance,
      marital_status,
      active,
      created_at,
      employee_contracts (
        id,
        contract_type,
        start_date,
        end_date,
        gross_salary,
        position,
        work_hours_weekly
      )
    `, { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("surname")
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,surname.ilike.%${search}%,rodne_cislo.ilike.%${search}%`)
  }

  if (status === "active") {
    query = query.eq("active", true)
  } else if (status === "inactive") {
    query = query.eq("active", false)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by contract_type on the application side (joined data)
  let filtered = data || []
  if (contractType && contractType !== "vsetky") {
    filtered = filtered.filter((emp: any) => {
      const contracts = emp.employee_contracts || []
      return contracts.some((c: any) => c.contract_type === contractType)
    })
  }

  return NextResponse.json({
    data: filtered,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/employees – vytvorenie zamestnanca
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, ...employeeData } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const parsed = employeeSchema.safeParse(employeeData)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await (db.from("employees") as any)
    .insert({
      ...parsed.data,
      company_id,
      rodne_cislo: parsed.data.rodne_cislo || null,
      address_street: parsed.data.address_street || null,
      address_city: parsed.data.address_city || null,
      address_zip: parsed.data.address_zip || null,
      iban: parsed.data.iban || null,
      id_number: parsed.data.id_number || null,
      sp_registration_number: parsed.data.sp_registration_number || null,
      active: true,
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
