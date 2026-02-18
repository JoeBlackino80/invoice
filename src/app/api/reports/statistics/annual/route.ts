import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAnnualReport } from "@/lib/reports/export-generator"

// GET /api/reports/statistics/annual - Rocny statisticky vykaz (Uc POD)
export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Neautorizovany pristup" },
      { status: 401 }
    )
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const fiscalYearId = searchParams.get("fiscal_year_id")

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  if (!fiscalYearId) {
    return NextResponse.json(
      { error: "fiscal_year_id je povinny" },
      { status: 400 }
    )
  }

  try {
    const report = await generateAnnualReport(
      companyId,
      fiscalYearId, db)
    return NextResponse.json(report)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Chyba pri generovani rocneho vykazu" },
      { status: 500 }
    )
  }
}
