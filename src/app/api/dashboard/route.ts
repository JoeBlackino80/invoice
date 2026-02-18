import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getRevenueData,
  getExpenseData,
  getCashFlowData,
  getQuickMetrics,
  getVATObligation,
  getAccountBalances,
  getUpcomingDeadlines,
  getUnpaidInvoicesCount,
  getRecentActivity,
} from "@/lib/reports/dashboard-data"

// GET /api/dashboard - aggregate dashboard data
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1

  const [revenue, expenses, cashFlow, metrics, vat, accounts, deadlines, unpaid, activity] =
    await Promise.all([
      getRevenueData(companyId, db, year),
      getExpenseData(companyId, db, year),
      getCashFlowData(companyId, db, year),
      getQuickMetrics(companyId, db),
      getVATObligation(companyId, db, currentMonth, year),
      getAccountBalances(companyId, db),
      getUpcomingDeadlines(companyId, db),
      getUnpaidInvoicesCount(companyId, db),
      getRecentActivity(companyId, db),
    ])

  return NextResponse.json({
    revenue,
    expenses,
    cashFlow,
    metrics,
    vat,
    accounts,
    deadlines,
    unpaid,
    activity,
  })
}
