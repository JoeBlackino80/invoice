import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/travel-orders/reports - suhrn cestovnych prikazov
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
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const employeeId = searchParams.get("employee_id")

  if (!companyId) {
    return NextResponse.json(
      { error: "company_id je povinny parameter" },
      { status: 400 }
    )
  }

  // 1. Zakladny query pre cestovne prikazy
  let query = (db.from("travel_orders") as any)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (dateFrom) {
    query = query.gte("date_from", dateFrom)
  }

  if (dateTo) {
    query = query.lte("date_to", dateTo)
  }

  if (employeeId) {
    query = query.eq("employee_id", employeeId)
  }

  const { data: orders, error: ordersError } = await query

  if (ordersError) {
    return NextResponse.json(
      { error: ordersError.message },
      { status: 500 }
    )
  }

  const allOrders: any[] = orders || []

  // 2. Nacitanie vyuctovani
  const orderIds = allOrders.map((o: any) => o.id)
  let settlements: any[] = []

  if (orderIds.length > 0) {
    const { data: settData } = await (db
      .from("travel_settlements") as any)
      .select("*")
      .in("travel_order_id", orderIds)

    settlements = settData || []
  }

  // Mapa settlement podla travel_order_id
  const settlementMap: Record<string, any> = {}
  for (const s of settlements) {
    settlementMap[s.travel_order_id] = s
  }

  // 3. Vypocet sumarnych udajov
  const totalOrders = allOrders.length
  const settledOrders = allOrders.filter(
    (o: any) => o.status === "settled" || o.status === "accounted"
  )

  let totalMealAllowance = 0
  let totalTransport = 0
  let totalAccommodation = 0
  let totalOther = 0
  let totalExpenses = 0

  for (const s of settlements) {
    totalMealAllowance += s.meal_allowance || 0
    totalTransport += s.transport_cost || 0
    totalAccommodation += s.accommodation_cost || 0
    totalOther += s.other_costs || 0
    totalExpenses += s.total_expenses || 0
  }

  // 4. Naklady podla zamestnancov
  const employeeMap = new Map<string, { name: string; count: number; total: number }>()
  for (const o of allOrders) {
    const empKey = o.employee_id || o.employee_name || "Neuvedeny"
    const empName = o.employee_name || "Neuvedeny"
    const existing = employeeMap.get(empKey)
    const settlement = settlementMap[o.id]
    const expenses = settlement ? settlement.total_expenses || 0 : 0

    if (existing) {
      existing.count += 1
      existing.total += expenses
    } else {
      employeeMap.set(empKey, {
        name: empName,
        count: 1,
        total: expenses,
      })
    }
  }

  const byEmployee = Array.from(employeeMap.entries()).map(([id, data]) => ({
    employee_id: id,
    employee_name: data.name,
    travel_count: data.count,
    total_expenses: Math.round(data.total * 100) / 100,
  }))

  // 5. Naklady podla destinacii
  const destMap = new Map<string, { count: number; total: number }>()
  for (const o of allOrders) {
    const dest = o.destination || "Neuvedena"
    const existing = destMap.get(dest)
    const settlement = settlementMap[o.id]
    const expenses = settlement ? settlement.total_expenses || 0 : 0

    if (existing) {
      existing.count += 1
      existing.total += expenses
    } else {
      destMap.set(dest, { count: 1, total: expenses })
    }
  }

  const byDestination = Array.from(destMap.entries())
    .map(([destination, data]) => ({
      destination,
      travel_count: data.count,
      total_expenses: Math.round(data.total * 100) / 100,
    }))
    .sort((a, b) => b.total_expenses - a.total_expenses)

  // 6. Mesacny prehlad
  const monthlyMap = new Map<string, { count: number; total: number }>()
  for (const o of allOrders) {
    const date = new Date(o.date_from)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const existing = monthlyMap.get(monthKey)
    const settlement = settlementMap[o.id]
    const expenses = settlement ? settlement.total_expenses || 0 : 0

    if (existing) {
      existing.count += 1
      existing.total += expenses
    } else {
      monthlyMap.set(monthKey, { count: 1, total: expenses })
    }
  }

  const monthlySummary = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      travel_count: data.count,
      total_expenses: Math.round(data.total * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 7. Tuzemske vs zahranicne
  const domestic = allOrders.filter((o: any) => !o.is_foreign)
  const foreign = allOrders.filter((o: any) => o.is_foreign)

  const domesticExpenses = domestic.reduce((sum: number, o: any) => {
    const s = settlementMap[o.id]
    return sum + (s ? s.total_expenses || 0 : 0)
  }, 0)

  const foreignExpenses = foreign.reduce((sum: number, o: any) => {
    const s = settlementMap[o.id]
    return sum + (s ? s.total_expenses || 0 : 0)
  }, 0)

  return NextResponse.json({
    summary: {
      total_orders: totalOrders,
      settled_orders: settledOrders.length,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      average_expenses:
        settledOrders.length > 0
          ? Math.round((totalExpenses / settledOrders.length) * 100) / 100
          : 0,
      domestic_count: domestic.length,
      foreign_count: foreign.length,
      domestic_expenses: Math.round(domesticExpenses * 100) / 100,
      foreign_expenses: Math.round(foreignExpenses * 100) / 100,
    },
    by_category: {
      meal_allowance: Math.round(totalMealAllowance * 100) / 100,
      transport: Math.round(totalTransport * 100) / 100,
      accommodation: Math.round(totalAccommodation * 100) / 100,
      other: Math.round(totalOther * 100) / 100,
    },
    by_employee: byEmployee,
    by_destination: byDestination,
    monthly_summary: monthlySummary,
  })
}
