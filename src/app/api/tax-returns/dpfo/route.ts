import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDPFO } from "@/lib/tax/income-tax-calculator"
import { generateDPFOXml } from "@/lib/tax/income-tax-xml-generator"

// GET /api/tax-returns/dpfo - Zoznam danovych priznani DPFO
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  const { data, error, count } = await (db.from("tax_returns") as any)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .eq("type", "dpfo")
    .is("deleted_at", null)
    .order("period_from", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

// POST /api/tax-returns/dpfo - Ulozit danove priznanie DPFO
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, year, recognition_type, generate_xml, dpfo_data } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!year) {
    return NextResponse.json({ error: "year je povinny" }, { status: 400 })
  }

  if (!dpfo_data) {
    return NextResponse.json({ error: "dpfo_data je povinny - najprv vypocitajte dan" }, { status: 400 })
  }

  const recognitionType = recognition_type || "riadne"
  const periodFrom = `${year}-01-01`
  const periodTo = `${year}-12-31`

  // Fetch company data for XML
  const { data: company, error: companyError } = await (db.from("companies") as any)
    .select("*")
    .eq("id", company_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma sa nenasla" }, { status: 404 })
  }

  // Generate XML if requested
  let xmlContent: string | null = null
  if (generate_xml) {
    xmlContent = generateDPFOXml(company, dpfo_data, year, recognitionType)
  }

  // Save tax return
  const { data: taxReturn, error: saveError } = await (db.from("tax_returns") as any)
    .insert({
      company_id,
      type: "dpfo",
      period_from: periodFrom,
      period_to: periodTo,
      status: "draft",
      recognition_type: recognitionType,
      xml_content: xmlContent,
      data: dpfo_data,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  // Save tax return lines (key values)
  const linesToInsert = [
    { line_number: 600, description: "Prijmy z podnikania", value: dpfo_data.business_income },
    { line_number: 610, description: "Vydavky", value: dpfo_data.expenses_used },
    { line_number: 620, description: "Dielci zaklad dane", value: dpfo_data.partial_tax_base },
    { line_number: 700, description: "Nezdanitelna cast - danovnik", value: dpfo_data.personal_allowance },
    { line_number: 710, description: "Nezdanitelna cast - manzel/ka", value: dpfo_data.spouse_allowance },
    { line_number: 720, description: "Dochodkove poistenie", value: dpfo_data.pension_insurance },
    { line_number: 800, description: "Zaklad dane", value: dpfo_data.tax_base },
    { line_number: 830, description: "Dan", value: dpfo_data.tax_amount },
    { line_number: 900, description: "Danovy bonus na deti", value: dpfo_data.child_bonus },
    { line_number: 920, description: "Dan po znizeni", value: dpfo_data.final_tax },
    { line_number: 930, description: "Preddavky", value: dpfo_data.prepayments_paid },
    { line_number: 940, description: "Doplatok/preplatok", value: dpfo_data.tax_to_pay },
  ].map((line) => ({
    tax_return_id: taxReturn.id,
    company_id,
    line_number: line.line_number,
    description: line.description,
    value: line.value || 0,
  }))

  const { error: linesError } = await (db.from("tax_return_lines") as any)
    .insert(linesToInsert)

  if (linesError) {
    console.error("Chyba pri ukladani riadkov DPFO:", linesError.message)
  }

  return NextResponse.json({
    ...taxReturn,
    dpfo_data,
  }, { status: 201 })
}
