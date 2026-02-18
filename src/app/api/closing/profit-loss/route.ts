import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateProfitLoss } from "@/lib/closing/profit-loss"

// GET /api/closing/profit-loss - Vykaz ziskov a strat (P&L)
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
  const dateFrom = searchParams.get("date_from") || undefined
  const dateTo = searchParams.get("date_to") || undefined

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  if (!fiscalYearId) {
    return NextResponse.json({ error: "fiscal_year_id je povinny" }, { status: 400 })
  }

  try {
    const profitLoss = await calculateProfitLoss(
      companyId,
      fiscalYearId, db,
      dateFrom,
      dateTo
    )
    return NextResponse.json(profitLoss)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Nepodarilo sa vypocitat vykaz ziskov a strat" },
      { status: 500 }
    )
  }
}
