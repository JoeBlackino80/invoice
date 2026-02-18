import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateSV } from "@/lib/tax/sv-calculator"
import { generateSVXml } from "@/lib/tax/sv-xml-generator"

// GET /api/tax-returns/sv - Zoznam suhrnnych vykazov
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
    .eq("type", "sv")
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

// POST /api/tax-returns/sv - Ulozit suhrnny vykaz
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, period_from, period_to, recognition_type, generate_xml } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!period_from || !period_to) {
    return NextResponse.json({ error: "period_from a period_to su povinne" }, { status: 400 })
  }

  const recognitionType = recognition_type || "riadne"

  // Fetch company data
  const { data: company, error: companyError } = await (db.from("companies") as any)
    .select("*")
    .eq("id", company_id)
    .is("deleted_at", null)
    .single() as { data: any; error: any }

  if (companyError || !company) {
    return NextResponse.json({ error: "Firma sa nenasla" }, { status: 404 })
  }

  // Fetch invoices and contacts for calculation
  const { data: invoices, error: invoicesError } = await (db.from("invoices") as any)
    .select("id, type, subtotal, vat_amount, total, contact_id, reverse_charge_text, issue_date")
    .eq("company_id", company_id)
    .eq("type", "vydana")
    .gte("issue_date", period_from)
    .lte("issue_date", period_to)
    .is("deleted_at", null)

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  const contactIds = Array.from(new Set(
    (invoices || [])
      .filter((inv: any) => inv.contact_id)
      .map((inv: any) => inv.contact_id)
  ))

  let contacts: any[] = []
  if (contactIds.length > 0) {
    const { data: contactsData, error: contactsError } = await (db.from("contacts") as any)
      .select("id, name, ico, dic, ic_dph, country")
      .in("id", contactIds)
      .is("deleted_at", null)

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 })
    }
    contacts = contactsData || []
  }

  // Calculate SV
  const svData = calculateSV(invoices || [], contacts, period_from, period_to)

  // Generate XML if requested
  let xmlContent: string | null = null
  if (generate_xml) {
    const periodDate = new Date(period_from)
    const periodEndDate = new Date(period_to)

    // Determine month/quarter
    const startMonth = periodDate.getMonth() + 1
    const endMonth = periodEndDate.getMonth() + 1
    const year = periodDate.getFullYear()

    let month: number | undefined
    let quarter: number | undefined

    // If period spans exactly 3 months, it's a quarter
    if (endMonth - startMonth === 2) {
      quarter = Math.ceil(endMonth / 3)
    } else {
      month = startMonth
    }

    xmlContent = generateSVXml(
      company,
      svData,
      { period_from, period_to, month, quarter, year },
      recognitionType
    )
  }

  // Save tax return
  const { data: taxReturn, error: saveError } = await (db.from("tax_returns") as any)
    .insert({
      company_id,
      type: "sv",
      period_from,
      period_to,
      status: "draft",
      recognition_type: recognitionType,
      xml_content: xmlContent,
      data: svData,
      created_by: user.id,
    })
    .select()
    .single() as { data: any; error: any }

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  // Save tax return lines
  const linesToInsert = svData.records.map((record, index) => ({
    tax_return_id: taxReturn.id,
    company_id,
    line_number: index + 1,
    description: `${record.country_code} | ${record.ic_dph_customer} | ${record.customer_name} | ${record.supply_type}`,
    value: record.total_value,
  }))

  if (linesToInsert.length > 0) {
    const { error: linesError } = await (db.from("tax_return_lines") as any)
      .insert(linesToInsert)

    if (linesError) {
      // Log but don't fail - the main return is saved
      console.error("Chyba pri ukladani riadkov SV:", linesError.message)
    }
  }

  return NextResponse.json({
    ...taxReturn,
    sv_data: svData,
  }, { status: 201 })
}
