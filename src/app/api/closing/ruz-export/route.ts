import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateBalanceSheet } from "@/lib/closing/balance-sheet"
import { calculateProfitLoss } from "@/lib/closing/profit-loss"
import { generateRuzXml } from "@/lib/closing/ruz-xml-generator"
import type { RuzCompanyInfo, RuzFiscalYear } from "@/lib/closing/ruz-xml-generator"

// POST /api/closing/ruz-export - Generate RUZ XML
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id, fiscal_year_id } = body

  if (!company_id || !fiscal_year_id) {
    return NextResponse.json({ error: "company_id a fiscal_year_id su povinne" }, { status: 400 })
  }

  try {
    // Get company info
    const { data: company, error: compError } = await (db.from("companies") as any)
      .select("*")
      .eq("id", company_id)
      .single() as { data: any; error: any }

    if (compError || !company) {
      return NextResponse.json({ error: "Spolocnost sa nenasla" }, { status: 404 })
    }

    // Get fiscal year info
    const { data: fy, error: fyError } = await (db.from("fiscal_years") as any)
      .select("id, year, start_date, end_date")
      .eq("id", fiscal_year_id)
      .eq("company_id", company_id)
      .single() as { data: any; error: any }

    if (fyError || !fy) {
      return NextResponse.json({ error: "Uctovne obdobie sa nenaslo" }, { status: 404 })
    }

    // Calculate balance sheet
    const balanceSheet = await calculateBalanceSheet(company_id, fiscal_year_id, db)

    // Calculate P&L
    const profitLoss = await calculateProfitLoss(company_id, fiscal_year_id, db)

    // Build company info for RUZ
    const companyInfo: RuzCompanyInfo = {
      name: company.name || "",
      ico: company.ico || "",
      dic: company.dic || "",
      ic_dph: company.ic_dph || "",
      address: company.address || "",
      city: company.city || "",
      zip: company.zip || "",
      legal_form: company.legal_form || "",
      sk_nace: company.sk_nace || "",
      size_category: company.size_category || "mala",
    }

    const fiscalYear: RuzFiscalYear = {
      year: fy.year,
      start_date: fy.start_date,
      end_date: fy.end_date,
    }

    // Generate XML
    const xml = generateRuzXml(companyInfo, balanceSheet, profitLoss, fiscalYear)

    // Return as XML file download
    const fileName = `uz_${company.ico}_${fy.year}.xml`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Nepodarilo sa generovat RUZ XML" },
      { status: 500 }
    )
  }
}
