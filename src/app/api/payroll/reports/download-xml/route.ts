import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateMonthlyTaxReport, generateAnnualTaxReport } from "@/lib/payroll/tax-declarations"
import { generateMonthlyTaxReportXML, generateAnnualTaxReportXML } from "@/lib/payroll/payroll-xml-generator"
import { generateSPReport, generateSPReportXML } from "@/lib/payroll/sp-report-generator"
import { generateZPReport, generateZPReportXML } from "@/lib/payroll/zp-report-generator"

// GET /api/payroll/reports/download-xml - stiahnutie XML suboru
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type")
  const month = parseInt(searchParams.get("month") || "0")
  const year = parseInt(searchParams.get("year") || "0")
  const insurer = searchParams.get("insurer") || ""

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!type) {
    return NextResponse.json({ error: "type je povinny (monthly-tax|annual-tax|sp|zp)" }, { status: 400 })
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

  let xmlContent = ""
  let filename = ""

  if (type === "monthly-tax") {
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: "Neplatny mesiac" }, { status: 400 })
    }

    const { data: payrollItems } = await (db
      .from("payroll_items") as any)
      .select(`
        *,
        employee:employees (id, name, surname, rodne_cislo)
      `)
      .eq("company_id", companyId)
      .eq("month", month)
      .eq("year", year)

    const report = generateMonthlyTaxReport(payrollItems || [], company, { month, year })
    xmlContent = generateMonthlyTaxReportXML(report)
    filename = `mesacny-prehlad-${year}-${month.toString().padStart(2, "0")}.xml`

  } else if (type === "annual-tax") {
    const { data: payrollItems } = await (db
      .from("payroll_items") as any)
      .select(`
        *,
        employee:employees (id, name, surname, rodne_cislo)
      `)
      .eq("company_id", companyId)
      .eq("year", year)

    const report = generateAnnualTaxReport(payrollItems || [], company, year)
    xmlContent = generateAnnualTaxReportXML(report)
    filename = `rocne-hlasenie-${year}.xml`

  } else if (type === "sp") {
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: "Neplatny mesiac" }, { status: 400 })
    }

    const { data: employees } = await (db
      .from("employees") as any)
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)

    const { data: payrollItems } = await (db
      .from("payroll_items") as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("month", month)
      .eq("year", year)

    const report = generateSPReport(payrollItems || [], employees || [], company, { month, year })
    xmlContent = generateSPReportXML(report)
    filename = `sp-mvp-${year}-${month.toString().padStart(2, "0")}.xml`

  } else if (type === "zp") {
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: "Neplatny mesiac" }, { status: 400 })
    }

    if (!insurer) {
      return NextResponse.json({ error: "insurer je povinny pre ZP vykaz" }, { status: 400 })
    }

    const { data: employees } = await (db
      .from("employees") as any)
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)

    const { data: payrollItems } = await (db
      .from("payroll_items") as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("month", month)
      .eq("year", year)

    const report = generateZPReport(payrollItems || [], employees || [], company, { month, year })
    xmlContent = generateZPReportXML(report, insurer)
    filename = `zp-${insurer}-${year}-${month.toString().padStart(2, "0")}.xml`

  } else {
    return NextResponse.json({ error: "Neplatny typ reportu" }, { status: 400 })
  }

  return new NextResponse(xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
