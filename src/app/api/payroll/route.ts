import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculatePayroll } from "@/lib/payroll/payroll-calculator"
import type { EmployeePayrollInput, PayrollResult } from "@/lib/payroll/payroll-calculator"

// GET /api/payroll - zoznam vyplatnych obdobi
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const periodMonth = searchParams.get("period_month")
  const periodYear = searchParams.get("period_year")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  let query = (db.from("payroll_runs") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .range(offset, offset + limit - 1)

  if (periodMonth) {
    query = query.eq("period_month", parseInt(periodMonth))
  }

  if (periodYear) {
    query = query.eq("period_year", parseInt(periodYear))
  }

  if (status) {
    query = query.eq("status", status)
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

// POST /api/payroll - vytvorenie novej vyplatnej listiny
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, period_month, period_year } = body

  if (!company_id || !period_month || !period_year) {
    return NextResponse.json(
      { error: "company_id, period_month a period_year su povinne" },
      { status: 400 }
    )
  }

  // Check if payroll run already exists for this period
  const { data: existing } = await (db.from("payroll_runs") as any)
    .select("id")
    .eq("company_id", company_id)
    .eq("period_month", period_month)
    .eq("period_year", period_year)
    .is("deleted_at", null)
    .maybeSingle() as { data: any; error: any }

  if (existing) {
    return NextResponse.json(
      { error: "Vyplatna listina pre toto obdobie uz existuje" },
      { status: 400 }
    )
  }

  // Fetch active employees with contracts and children
  const { data: employees, error: empError } = await (db.from("employees") as any)
    .select(`
      id,
      name,
      surname,
      employee_contracts (
        id,
        contract_type,
        gross_salary,
        work_hours_weekly
      ),
      employee_children (
        id,
        name,
        date_of_birth,
        is_student,
        disability
      )
    `)
    .eq("company_id", company_id)
    .eq("active", true)
    .is("deleted_at", null)

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 })
  }

  if (!employees || employees.length === 0) {
    return NextResponse.json(
      { error: "Ziadni aktivni zamestnanci neboli najdeni" },
      { status: 400 }
    )
  }

  // Standard work fund hours for the period (default 160 if not specified)
  const DEFAULT_WORK_FUND_HOURS = 160

  // Calculate payroll for each employee
  const payrollResults: PayrollResult[] = employees.map((emp: any) => {
    const contracts = emp.employee_contracts || []
    const activeContract = contracts[0] // most recent contract
    const children = (emp.employee_children || []).map((ch: any) => ({
      name: ch.name,
      date_of_birth: ch.date_of_birth,
      is_student: ch.is_student || false,
      disability: ch.disability || false,
    }))

    const input: EmployeePayrollInput = {
      employee_id: emp.id,
      employee_name: `${emp.name} ${emp.surname}`,
      contract_type: activeContract?.contract_type || "hpp",
      gross_salary: activeContract?.gross_salary || 0,
      children,
      worked_hours: DEFAULT_WORK_FUND_HOURS,
      work_fund_hours: DEFAULT_WORK_FUND_HOURS,
      period_month,
      period_year,
    }
    return calculatePayroll(input)
  })

  // Calculate totals
  const totalGross = payrollResults.reduce((s, r) => s + r.total_gross, 0)
  const totalNet = payrollResults.reduce((s, r) => s + r.net_salary, 0)
  const totalEmployerInsurance = payrollResults.reduce((s, r) => s + r.employer_insurance.total, 0)
  const totalEmployerCost = Math.round((totalGross + totalEmployerInsurance) * 100) / 100

  // Create payroll run record
  const { data: payrollRun, error: runError } = await (db.from("payroll_runs") as any)
    .insert({
      company_id,
      period_month,
      period_year,
      status: "draft",
      total_gross: Math.round(totalGross * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      total_employer_cost: Math.round(totalEmployerCost * 100) / 100,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 })
  }

  // Save payroll items for each employee (store full result as JSON)
  const itemsToInsert = payrollResults.map((result) => ({
    payroll_run_id: payrollRun.id,
    company_id,
    employee_id: result.employee_id,
    employee_name: result.employee_name,
    contract_type: result.contract_type,
    gross_salary: result.gross_salary,
    total_gross: result.total_gross,
    net_salary: result.net_salary,
    // Period fields for report queries
    month: period_month,
    year: period_year,
    // Store breakdown as JSONB columns
    surcharges: result.surcharges,
    sick_leave: result.sick_leave,
    employee_insurance: result.employee_insurance,
    employer_insurance: result.employer_insurance,
    tax: result.tax,
  }))

  const { data: items, error: itemsError } = await (db.from("payroll_items") as any)
    .insert(itemsToInsert)
    .select()

  if (itemsError) {
    // Rollback: delete payroll run
    await (db.from("payroll_runs") as any).delete().eq("id", payrollRun.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json(
    { ...payrollRun, items },
    { status: 201 }
  )
}
