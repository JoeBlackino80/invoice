import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateBalanceSheet } from "@/lib/closing/balance-sheet"

// GET /api/closing/balance-sheet - Suvaha (Balance Sheet)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const fiscalYearId = searchParams.get("fiscal_year_id")
  const dateTo = searchParams.get("date_to") || undefined

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!fiscalYearId) {
    return NextResponse.json({ error: "fiscal_year_id je povinny" }, { status: 400 })
  }

  try {
    const balanceSheet = await calculateBalanceSheet(companyId, fiscalYearId, db, dateTo)
    return NextResponse.json(balanceSheet)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Nepodarilo sa vypocitat suvahu" },
      { status: 500 }
    )
  }
}
