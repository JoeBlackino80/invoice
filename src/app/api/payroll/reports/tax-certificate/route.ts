import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateTaxCertificate } from "@/lib/payroll/tax-declarations"

// GET /api/payroll/reports/tax-certificate - potvrdenie o zdanitelnych prijmoch
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const employeeId = searchParams.get("employee_id")
  const year = parseInt(searchParams.get("year") || "0")

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id je povinny" }, { status: 400 })
  }

  if (!year || year < 2000) {
    return NextResponse.json({ error: "Neplatny rok" }, { status: 400 })
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

  // Nacitat zamestnanca (map name/surname to first_name/last_name for tax-declarations)
  const { data: rawEmployee, error: empError } = await (db
    .from("employees") as any)
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .single() as { data: any; error: any }

  // Remap name fields for tax-declarations compatibility
  const employee = rawEmployee ? {
    ...rawEmployee,
    first_name: rawEmployee.name,
    last_name: rawEmployee.surname,
  } : null

  if (empError) {
    return NextResponse.json({ error: "Zamestnanec sa nenasiel" }, { status: 404 })
  }

  // Nacitat mzdove polozky zamestnanca za rok
  const { data: payrollItems, error: payrollError } = await (db
    .from("payroll_items") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .eq("year", year)
    .order("month", { ascending: true })

  if (payrollError) {
    return NextResponse.json({ error: payrollError.message }, { status: 500 })
  }

  const certificate = generateTaxCertificate(payrollItems || [], employee, company, year)

  return NextResponse.json(certificate)
}
