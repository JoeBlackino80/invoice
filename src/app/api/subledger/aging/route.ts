import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/subledger/aging - Analýza splatnosti (Aging analysis)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovaný prístup" }, { status: 401 })
  }

  const db = createAdminClient()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")
  const type = searchParams.get("type") // "receivables" or "payables"

  if (!companyId) {
    return NextResponse.json({ error: "company_id je povinný" }, { status: 400 })
  }

  if (!type || (type !== "receivables" && type !== "payables")) {
    return NextResponse.json({ error: "type musí byť 'receivables' alebo 'payables'" }, { status: 400 })
  }

  const invoiceType = type === "receivables" ? "vydana" : "prijata"

  // Fetch invoices
  const { data: invoices, error } = await (db.from("invoices") as any)
    .select(`
      id,
      number,
      due_date,
      total,
      paid_amount,
      currency,
      status,
      contact_id,
      contact:contacts(id, name)
    `)
    .eq("company_id", companyId)
    .eq("type", invoiceType)
    .is("deleted_at", null)
    .not("status", "eq", "stornovana")
    .not("status", "eq", "draft")
    .not("status", "eq", "uhradena")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter to only invoices with remaining balance
  const unpaidInvoices = (invoices || []).filter((inv: any) => {
    const remaining = (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)
    return remaining > 0.01
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Define aging buckets
  const buckets = {
    current: { count: 0, total_amount: 0, label: "Aktuálne (pred splatnosťou)" },
    "1_30": { count: 0, total_amount: 0, label: "1-30 dní" },
    "31_60": { count: 0, total_amount: 0, label: "31-60 dní" },
    "61_90": { count: 0, total_amount: 0, label: "61-90 dní" },
    "91_180": { count: 0, total_amount: 0, label: "91-180 dní" },
    "180_plus": { count: 0, total_amount: 0, label: "180+ dní" },
  }

  let totalOutstanding = 0
  let totalDaysOverdue = 0
  let overdueCount = 0

  for (const inv of unpaidInvoices) {
    const total = Number(inv.total) || 0
    const paidAmount = Number(inv.paid_amount) || 0
    const remaining = total - paidAmount
    const dueDate = new Date(inv.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    totalOutstanding += remaining

    if (daysOverdue <= 0) {
      buckets.current.count += 1
      buckets.current.total_amount += remaining
    } else if (daysOverdue <= 30) {
      buckets["1_30"].count += 1
      buckets["1_30"].total_amount += remaining
      totalDaysOverdue += daysOverdue
      overdueCount += 1
    } else if (daysOverdue <= 60) {
      buckets["31_60"].count += 1
      buckets["31_60"].total_amount += remaining
      totalDaysOverdue += daysOverdue
      overdueCount += 1
    } else if (daysOverdue <= 90) {
      buckets["61_90"].count += 1
      buckets["61_90"].total_amount += remaining
      totalDaysOverdue += daysOverdue
      overdueCount += 1
    } else if (daysOverdue <= 180) {
      buckets["91_180"].count += 1
      buckets["91_180"].total_amount += remaining
      totalDaysOverdue += daysOverdue
      overdueCount += 1
    } else {
      buckets["180_plus"].count += 1
      buckets["180_plus"].total_amount += remaining
      totalDaysOverdue += daysOverdue
      overdueCount += 1
    }
  }

  // Calculate percentages
  const bucketsWithPercentage = Object.entries(buckets).map(([key, bucket]) => ({
    key,
    label: bucket.label,
    count: bucket.count,
    total_amount: bucket.total_amount,
    percentage: totalOutstanding > 0
      ? Math.round((bucket.total_amount / totalOutstanding) * 10000) / 100
      : 0,
  }))

  // Calculate DPO (Days Payable/Receivable Outstanding)
  const averageDaysOverdue = overdueCount > 0
    ? Math.round(totalDaysOverdue / overdueCount)
    : 0

  // Simplified DPO calculation: weighted average days outstanding for all invoices
  let weightedDays = 0
  let totalWeight = 0
  for (const inv of unpaidInvoices) {
    const total = Number(inv.total) || 0
    const paidAmount = Number(inv.paid_amount) || 0
    const remaining = total - paidAmount
    const dueDate = new Date(inv.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const daysOutstanding = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    weightedDays += daysOutstanding * remaining
    totalWeight += remaining
  }
  const dpo = totalWeight > 0 ? Math.round(weightedDays / totalWeight) : 0

  return NextResponse.json({
    type,
    buckets: bucketsWithPercentage,
    summary: {
      total_outstanding: totalOutstanding,
      total_invoices: unpaidInvoices.length,
      average_days_overdue: averageDaysOverdue,
      dpo,
    },
  })
}
