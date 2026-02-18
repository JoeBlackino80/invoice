import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizovaný" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get("employee_id")

  const db = createAdminClient()

  // Fetch payroll item
  let query = (db.from("payroll_items") as any)
    .select("*, employees(first_name, last_name, rodne_cislo)")
    .eq("payroll_id", params.id)

  if (employeeId) query = query.eq("employee_id", employeeId)

  const { data: items, error } = await query

  if (error || !items?.length) {
    return NextResponse.json({ error: "Výplatná páska nenájdená" }, { status: 404 })
  }

  const item = items[0]
  const emp = item.employees || {}

  // Generate simple text-based payslip (React-PDF would be better but requires more setup)
  const lines = [
    `VÝPLATNÁ PÁSKA`,
    ``,
    `Zamestnanec: ${emp.last_name || ""} ${emp.first_name || ""}`,
    `Obdobie: ${item.month}/${item.year}`,
    ``,
    `--- PRÍJMY ---`,
    `Hrubá mzda:              ${Number(item.gross_salary || 0).toFixed(2)} EUR`,
    `Príplatky:                ${Number(item.surcharges || 0).toFixed(2)} EUR`,
    `Náhrada PN:               ${Number(item.sick_leave_pay || 0).toFixed(2)} EUR`,
    `Hrubý príjem spolu:       ${Number(item.total_gross || 0).toFixed(2)} EUR`,
    ``,
    `--- ZRÁŽKY ZAMESTNANEC ---`,
    `Zdravotné poistenie:      ${Number(item.employee_insurance?.health || 0).toFixed(2)} EUR`,
    `Sociálne poistenie:       ${Number(item.employee_insurance?.social || item.employee_insurance?.total_social || 0).toFixed(2)} EUR`,
    `Preddavok na daň:         ${Number(item.tax || 0).toFixed(2)} EUR`,
    ``,
    `--- ČISTÁ MZDA ---`,
    `Čistá mzda:               ${Number(item.net_salary || 0).toFixed(2)} EUR`,
    ``,
    `--- NÁKLADY ZAMESTNÁVATEĽ ---`,
    `ZP zamestnávateľ:         ${Number(item.employer_insurance?.health || 0).toFixed(2)} EUR`,
    `SP zamestnávateľ:         ${Number(item.employer_insurance?.social || item.employer_insurance?.total_social || 0).toFixed(2)} EUR`,
  ]

  const content = lines.join("\n")

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="vyplatna_paska_${item.month}_${item.year}.txt"`,
    },
  })
}
