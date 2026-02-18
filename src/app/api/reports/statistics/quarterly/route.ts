import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuarterlyReport } from "@/lib/reports/export-generator"

// GET /api/reports/statistics/quarterly - Stvrtrocny statisticky vykaz
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
  const year = searchParams.get("year")
  const quarter = searchParams.get("quarter")

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  if (!year || !quarter) {
    return NextResponse.json(
      { error: "year a quarter su povinne" },
      { status: 400 }
    )
  }

  const yearNum = parseInt(year)
  const quarterNum = parseInt(quarter)

  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json({ error: "Neplatny rok" }, { status: 400 })
  }

  if (isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
    return NextResponse.json(
      { error: "Neplatny stvrtrok (1-4)" },
      { status: 400 }
    )
  }

  try {
    const report = await generateQuarterlyReport(
      companyId,
      yearNum,
      quarterNum, db)
    return NextResponse.json(report)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Chyba pri generovani stvrtrocneho vykazu" },
      { status: 500 }
    )
  }
}
