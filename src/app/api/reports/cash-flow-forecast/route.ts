import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateCashFlowForecast } from "@/lib/reports/financial-reports"

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
  const forecastDays = parseInt(searchParams.get("forecast_days") || "30") as
    | 30
    | 60
    | 90

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny" },
      { status: 400 }
    )
  }

  // Fetch paid invoices for the last 12 months as historical data
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const fromDate = twelveMonthsAgo.toISOString().slice(0, 10)

  const { data: invoices, error } = await (db.from("invoices") as any)
    .select("id, type, status, issue_date, total_amount, paid_amount")
    .eq("company_id", companyId)
    .gte("issue_date", fromDate)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate by month
  const monthlyMap = new Map<string, { income: number; expenses: number }>()

  for (const inv of invoices || []) {
    const month = (inv.issue_date as string).slice(0, 7) // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { income: 0, expenses: 0 })
    }
    const entry = monthlyMap.get(month)!
    const amount = Number(inv.total_amount || 0)

    if (inv.type === "vydana" || inv.type === "proforma" || inv.type === "zalohova") {
      entry.income += amount
    } else if (inv.type === "prijata") {
      entry.expenses += amount
    }
  }

  // Sort by month and build array
  const sortedMonths = Array.from(monthlyMap.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  )

  const historicalData = sortedMonths.map(([month, data]) => ({
    month,
    income: Math.round(data.income * 100) / 100,
    expenses: Math.round(data.expenses * 100) / 100,
  }))

  const validForecastDays = [30, 60, 90].includes(forecastDays)
    ? (forecastDays as 30 | 60 | 90)
    : 30

  const forecast = calculateCashFlowForecast(historicalData, validForecastDays)

  return NextResponse.json(forecast)
}
