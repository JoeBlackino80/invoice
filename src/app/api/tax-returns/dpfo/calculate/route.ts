import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDPFO } from "@/lib/tax/income-tax-calculator"

// POST /api/tax-returns/dpfo/calculate - Vypocitat dan z prijmov fyzickych osob
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const {
    company_id,
    year,
    income,
    expense_type,
    actual_expenses,
    children_count,
    spouse_income,
    pension_insurance,
    prepayments,
  } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!year) {
    return NextResponse.json({ error: "year je povinny" }, { status: 400 })
  }

  // Validate expense_type
  const validExpenseType = expense_type === "flat_rate" ? "flat_rate" : "actual"

  // Calculate DPFO
  const dpfoData = calculateDPFO({
    business_income: Number(income) || 0,
    expense_type: validExpenseType,
    actual_expenses: Number(actual_expenses) || 0,
    children_count: Number(children_count) || 0,
    spouse_income: Number(spouse_income) || 0,
    pension_insurance_paid: Number(pension_insurance) || 0,
    prepayments_paid: Number(prepayments) || 0,
    year: Number(year),
  })

  return NextResponse.json({
    data: dpfoData,
  })
}
