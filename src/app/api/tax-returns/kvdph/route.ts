import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateKVDPHXml } from "@/lib/tax/xml-generator"
import type { CompanyInfo, PeriodInfo, RecognitionType } from "@/lib/tax/xml-generator"
import type { KVDPHData } from "@/lib/tax/kvdph-calculator"

// POST /api/tax-returns/kvdph - ulozenie KV DPH
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

  // Fetch company info
  const { data: company, error: companyError } = await (db
    .from("companies") as any)
    .select("id, name, ico, dic, ic_dph")
    .eq("id", company_id)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma nebola najdena" }, { status: 404 })
  }

  const companyInfo: CompanyInfo = {
    name: company.name || "",
    ico: company.ico || "",
    dic: company.dic || "",
    ic_dph: company.ic_dph || "",
  }

  const fromDate = new Date(period_from)
  const toDate = new Date(period_to)
  const year = fromDate.getFullYear()

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
  const kvdphData = data as KVDPHData
  const xmlContent = generateKVDPHXml(companyInfo, kvdphData, periodInfo, recognitionType)

  // Count total records
  const totalRecords =
    (kvdphData.a1?.length || 0) +
    (kvdphData.a2?.length || 0) +
    (kvdphData.b1?.length || 0) +
    (kvdphData.b2?.length || 0) +
    (kvdphData.b3?.length || 0) +
    (kvdphData.c1?.length || 0) +
    (kvdphData.c2?.length || 0) +
    (kvdphData.d1?.length || 0) +
    (kvdphData.d2?.length || 0)

  // Save tax return
  const { data: taxReturn, error: taxReturnError } = await (db
    .from("tax_returns") as any)
    .insert({
      company_id,
      type: "kv_dph",
      period_from,
      period_to,
      status: "draft",
      xml_content: xmlContent,
      data: kvdphData,
      recognition_type: recognitionType,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (taxReturnError) {
    return NextResponse.json({ error: taxReturnError.message }, { status: 500 })
  }

  // Save summary lines
  const linesToInsert = [
    { tax_return_id: taxReturn.id, company_id, line_number: 1, description: "A.1 - Vydane faktury, DPH >= 5000", value: kvdphData.a1?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 2, description: "A.2 - Vydane faktury, DPH < 5000", value: kvdphData.a2?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 3, description: "B.1 - Prijate faktury, DPH >= 5000", value: kvdphData.b1?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 4, description: "B.2 - Prijate faktury, DPH < 5000", value: kvdphData.b2?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 5, description: "B.3 - Prijate zjednodusene faktury", value: kvdphData.b3?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 6, description: "C.1 - Vydane dobropisy", value: kvdphData.c1?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 7, description: "C.2 - Prijate dobropisy", value: kvdphData.c2?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 8, description: "D.1 - Tuzemsky prenos - dodavatel", value: kvdphData.d1?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 9, description: "D.2 - Tuzemsky prenos - odberatel", value: kvdphData.d2?.length || 0 },
    { tax_return_id: taxReturn.id, company_id, line_number: 10, description: "Celkovy pocet zaznamov", value: totalRecords },
  ]

  const { error: linesError } = await (db
    .from("tax_return_lines") as any)
    .insert(linesToInsert)

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  return NextResponse.json(taxReturn, { status: 201 })
}
