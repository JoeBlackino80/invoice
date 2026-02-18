import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateZPReport } from "@/lib/payroll/zp-report-generator"

// GET /api/payroll/reports/zp - mesacne oznamenie pre zdravotne poistovne
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const month = parseInt(searchParams.get("month") || "0")
  const year = parseInt(searchParams.get("year") || "0")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Neplatne obdobie (month, year)" }, { status: 400 })
  }

  // Nacitat spolocnost
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("*")
    .eq("id", companyId)
    .single() as { data: any; error: any }

  if (companyError) {
    return NextResponse.json({ error: "Spolocnost sa nenasla" }, { status: 404 })
  }

  // Nacitat zamestnancov
  const { data: employees, error: empError } = await (db
    .from("employees") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 })
  }

  // Nacitat mzdove polozky za obdobie
  const { data: payrollItems, error: payrollError } = await (db
    .from("payroll_items") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("month", month)
    .eq("year", year)

  if (payrollError) {
    return NextResponse.json({ error: payrollError.message }, { status: 500 })
  }

  const report = generateZPReport(payrollItems || [], employees || [], company, { month, year })

  return NextResponse.json(report)
}
