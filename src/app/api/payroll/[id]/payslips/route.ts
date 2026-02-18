import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/payroll/:id/payslips - generovanie vyplatnych pasok
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

  // Fetch payroll run
  const { data: payrollRun, error: runError } = await (db.from("payroll_runs") as any)
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (runError) {
    return NextResponse.json({ error: "Vyplatna listina nenajdena" }, { status: 404 })
  }

  // Fetch all payroll items for this run
  const { data: items, error: itemsError } = await (db.from("payroll_items") as any)
    .select("*")
    .eq("payroll_run_id", params.id)
    .order("employee_name", { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Generate payslip data for each employee
  const payslips = (items || []).map((item: any) => ({
    employee_id: item.employee_id,
    employee_name: item.employee_name,
    contract_type: item.contract_type,
    period: `${String(payrollRun.period_month).padStart(2, "0")}/${payrollRun.period_year}`,
    period_month: payrollRun.period_month,
    period_year: payrollRun.period_year,

    // Hruba mzda
    gross_salary: item.gross_salary,
    total_gross: item.total_gross,

    // Priplatok
    surcharges: item.surcharges,

    // PN
    sick_leave: item.sick_leave,

    // Odvody zamestnanec
    employee_insurance: item.employee_insurance,

    // Dan
    tax: item.tax,

    // Cista mzda
    net_salary: item.net_salary,

    // Odvody zamestnavatel
    employer_insurance: item.employer_insurance,
  }))

  return NextResponse.json({
    payroll_run: {
      id: payrollRun.id,
      period_month: payrollRun.period_month,
      period_year: payrollRun.period_year,
      status: payrollRun.status,
      total_gross: payrollRun.total_gross,
      total_net: payrollRun.total_net,
      total_employer_cost: payrollRun.total_employer_cost,
    },
    payslips,
  })
}
