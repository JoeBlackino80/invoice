import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDPPO } from "@/lib/tax/income-tax-calculator"
import { generateDPPOXml } from "@/lib/tax/income-tax-xml-generator"

// GET /api/tax-returns/dppo - Zoznam danovych priznani DPPO
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
    .eq("type", "dppo")
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

// POST /api/tax-returns/dppo - Ulozit danove priznanie DPPO
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, year, adjustments, recognition_type, generate_xml, dppo_data } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!year) {
    return NextResponse.json({ error: "year je povinny" }, { status: 400 })
  }

  if (!dppo_data) {
    return NextResponse.json({ error: "dppo_data je povinny - najprv vypocitajte dan" }, { status: 400 })
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
    xmlContent = generateDPPOXml(company, dppo_data, year, recognitionType)
  }

  // Save tax return
  const { data: taxReturn, error: saveError } = await (db.from("tax_returns") as any)
    .insert({
      company_id,
      type: "dppo",
      period_from: periodFrom,
      period_to: periodTo,
      status: "draft",
      recognition_type: recognitionType,
      xml_content: xmlContent,
      data: dppo_data,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  // Save tax return lines (key values)
  const linesToInsert = [
    { line_number: 100, description: "Vynosy", value: dppo_data.total_revenues },
    { line_number: 110, description: "Naklady", value: dppo_data.total_expenses },
    { line_number: 200, description: "Vysledok hospodarenia", value: dppo_data.accounting_profit },
    { line_number: 210, description: "Nedanove naklady", value: dppo_data.non_deductible_expenses },
    { line_number: 220, description: "Nadmerne odpisy", value: dppo_data.excess_depreciation },
    { line_number: 230, description: "Neuhradene zavazky", value: dppo_data.unpaid_liabilities },
    { line_number: 310, description: "Oslobodene prijmy", value: dppo_data.tax_exempt_income },
    { line_number: 400, description: "Zaklad dane", value: dppo_data.tax_base },
    { line_number: 410, description: "Odpocet straty", value: dppo_data.tax_loss_deduction },
    { line_number: 420, description: "Upraveny zaklad dane", value: dppo_data.adjusted_tax_base },
    { line_number: 510, description: "Dan", value: dppo_data.tax_amount },
    { line_number: 520, description: "Preddavky", value: dppo_data.prepayments_paid },
    { line_number: 530, description: "Doplatok/preplatok", value: dppo_data.tax_to_pay },
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
    console.error("Chyba pri ukladani riadkov DPPO:", linesError.message)
  }

  return NextResponse.json({
    ...taxReturn,
    dppo_data,
  }, { status: 201 })
}
