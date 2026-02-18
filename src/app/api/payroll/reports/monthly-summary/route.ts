import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const month = parseInt(searchParams.get("month") || "0")
  const year = parseInt(searchParams.get("year") || "0")

  if (!companyId || !month || !year) {
    return NextResponse.json({ error: "Chýbajú parametre" }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: items } = await (db.from("payroll_items") as any)
    .select("*, employees(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("month", month)
    .eq("year", year)
    .is("deleted_at", null)

  if (!items || items.length === 0) {
    return NextResponse.json({ data: [], totals: { totalGross: 0, totalNet: 0, totalEmployerCost: 0, totalTax: 0, employeeCount: 0 } })
  }

  let totalGross = 0, totalNet = 0, totalTax = 0
  let totalEmployeeInsurance = 0, totalEmployerInsurance = 0

  const breakdown = items.map((item: any) => {
    const gross = Number(item.total_gross || item.gross_salary || 0)
    const net = Number(item.net_salary || 0)
    const tax = Number(item.tax || 0)
    const empIns = Number(item.employee_insurance?.total || 0)
    const emrIns = Number(item.employer_insurance?.total || 0)

    totalGross += gross
    totalNet += net
    totalTax += tax
    totalEmployeeInsurance += empIns
    totalEmployerInsurance += emrIns

    return {
      employee_id: item.employee_id,
      name: `${item.employees?.last_name || ""} ${item.employees?.first_name || ""}`.trim(),
      gross,
      net,
      tax,
      employee_insurance: empIns,
      employer_insurance: emrIns,
    }
  })

  return NextResponse.json({
    data: breakdown,
    totals: {
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalEmployerCost: Math.round((totalGross + totalEmployerInsurance) * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalEmployeeInsurance: Math.round(totalEmployeeInsurance * 100) / 100,
      totalEmployerInsurance: Math.round(totalEmployerInsurance * 100) / 100,
      employeeCount: items.length,
    },
  })
}
