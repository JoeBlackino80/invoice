import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateDPHXml } from "@/lib/tax/xml-generator"
import type { CompanyInfo, PeriodInfo, RecognitionType } from "@/lib/tax/xml-generator"
import type { DPHData } from "@/lib/tax/dph-calculator"

// POST /api/tax-returns/dph - ulozenie DPH priznania
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, period_from, period_to, recognition_type, data } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!period_from || !period_to) {
    return NextResponse.json({ error: "period_from a period_to su povinne" }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "data su povinne" }, { status: 400 })
  }

  const recognitionType: RecognitionType = recognition_type || "riadne"

  // Fetch company info for XML generation
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("id, name, ico, dic, ic_dph")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma nebola najdena" }, { status: 404 })
  }

  // Build company and period info for XML
  const companyInfo: CompanyInfo = {
    name: company.name || "",
    ico: company.ico || "",
    dic: company.dic || "",
    ic_dph: company.ic_dph || "",
  }

  const fromDate = new Date(period_from)
  const toDate = new Date(period_to)
  const year = fromDate.getFullYear()

  // Determine if monthly or quarterly
  const monthDiff = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + toDate.getMonth() - fromDate.getMonth()
  const isQuarterly = monthDiff >= 2

  const periodInfo: PeriodInfo = {
    period_from,
    period_to,
    year,
    month: isQuarterly ? undefined : fromDate.getMonth() + 1,
    quarter: isQuarterly ? Math.ceil((fromDate.getMonth() + 1) / 3) : undefined,
  }

  // Generate XML
  const dphData = data as DPHData
  const xmlContent = generateDPHXml(companyInfo, dphData, periodInfo, recognitionType)

  // Save tax return
  const { data: taxReturn, error: taxReturnError } = await (db
    .from("tax_returns") as any)
    .insert({
      company_id,
      type: "dph",
      period_from,
      period_to,
      status: "draft",
      xml_content: xmlContent,
      data: dphData,
      recognition_type: recognitionType,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (taxReturnError) {
    return NextResponse.json({ error: taxReturnError.message }, { status: 500 })
  }

  // Save tax return lines
  const linesToInsert = [
    { tax_return_id: taxReturn.id, company_id, line_number: 1, description: "Zaklad dane 23% - vystup", value: dphData.output_vat_base_23 },
    { tax_return_id: taxReturn.id, company_id, line_number: 2, description: "DPH 23% - vystup", value: dphData.output_vat_amount_23 },
    { tax_return_id: taxReturn.id, company_id, line_number: 3, description: "Zaklad dane 19% - vystup", value: dphData.output_vat_base_19 },
    { tax_return_id: taxReturn.id, company_id, line_number: 4, description: "DPH 19% - vystup", value: dphData.output_vat_amount_19 },
    { tax_return_id: taxReturn.id, company_id, line_number: 5, description: "Zaklad dane 5% - vystup", value: dphData.output_vat_base_5 },
    { tax_return_id: taxReturn.id, company_id, line_number: 6, description: "DPH 5% - vystup", value: dphData.output_vat_amount_5 },
    { tax_return_id: taxReturn.id, company_id, line_number: 7, description: "Vystupna DPH celkom", value: dphData.output_vat_total },
    { tax_return_id: taxReturn.id, company_id, line_number: 8, description: "Zaklad dane 23% - vstup", value: dphData.input_vat_base_23 },
    { tax_return_id: taxReturn.id, company_id, line_number: 9, description: "DPH 23% - vstup", value: dphData.input_vat_amount_23 },
    { tax_return_id: taxReturn.id, company_id, line_number: 10, description: "Zaklad dane 19% - vstup", value: dphData.input_vat_base_19 },
    { tax_return_id: taxReturn.id, company_id, line_number: 11, description: "DPH 19% - vstup", value: dphData.input_vat_amount_19 },
    { tax_return_id: taxReturn.id, company_id, line_number: 12, description: "Zaklad dane 5% - vstup", value: dphData.input_vat_base_5 },
    { tax_return_id: taxReturn.id, company_id, line_number: 13, description: "DPH 5% - vstup", value: dphData.input_vat_amount_5 },
    { tax_return_id: taxReturn.id, company_id, line_number: 14, description: "Vstupna DPH celkom", value: dphData.input_vat_total },
    { tax_return_id: taxReturn.id, company_id, line_number: 15, description: "Vlastna danova povinnost", value: dphData.own_tax_liability },
    { tax_return_id: taxReturn.id, company_id, line_number: 16, description: "Nadmerny odpocet", value: dphData.excess_deduction },
  ]

  const { error: linesError } = await (db
    .from("tax_return_lines") as any)
    .insert(linesToInsert)

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json(taxReturn, { status: 201 })
}
