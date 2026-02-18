import type { SupabaseClient } from "@supabase/supabase-js"

// ---------- Types ----------

export interface MonthlyAmount {
  month: number
  amount: number
}

export interface RevenueData {
  currentYear: MonthlyAmount[]
  previousYear: MonthlyAmount[]
  year: number
}

export interface ExpenseCategory {
  category: string
  amount: number
}

export interface ExpenseData {
  monthly: MonthlyAmount[]
  byCategory: ExpenseCategory[]
  year: number
}

export interface CashFlowMonth {
  month: number
  income: number
  expense: number
  net: number
}

export interface CashFlowData {
  monthly: CashFlowMonth[]
  year: number
}

export interface QuickMetrics {
  obrat: number
  obratChange: number
  zisk: number
  ziskChange: number
  pohladavky: number
  pohladavkyCount: number
  zavazky: number
  zavazkyCount: number
  pocetFaktur: number
}

export interface VATObligation {
  vystup: number
  vstup: number
  rozdiel: number
  month: number
  year: number
}

export interface AccountBalance {
  id: string
  name: string
  type: "bank" | "cash"
  balance: number
  currency: string
}

export interface AccountBalancesData {
  accounts: AccountBalance[]
  total: number
}

export interface UpcomingDeadline {
  id: string
  title: string
  date: string
  type: "invoice" | "tax"
  urgency: "overdue" | "today" | "tomorrow" | "this_week" | "later"
  amount?: number
}

export interface UnpaidInvoicesSummary {
  count: number
  totalAmount: number
  aging: {
    bucket: string
    count: number
    amount: number
  }[]
}

export interface RecentActivity {
  id: string
  action: string
  description: string
  date: string
  type: string
}

// ---------- Helper ----------

function emptyMonths(): MonthlyAmount[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))
}

function getUrgency(dateStr: string): UpcomingDeadline["urgency"] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return "overdue"
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff <= 7) return "this_week"
  return "later"
}

// ---------- Revenue Data ----------

export async function getRevenueData(
  companyId: string,
  supabase: SupabaseClient,
  year: number
): Promise<RevenueData> {
  try {
    const startCurrent = `${year}-01-01`
    const endCurrent = `${year}-12-31`
    const startPrev = `${year - 1}-01-01`
    const endPrev = `${year - 1}-12-31`

    const { data: currentData } = await (supabase.from("invoices") as any)
      .select("issue_date, total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .is("deleted_at", null)
      .gte("issue_date", startCurrent)
      .lte("issue_date", endCurrent)

    const { data: prevData } = await (supabase.from("invoices") as any)
      .select("issue_date, total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .is("deleted_at", null)
      .gte("issue_date", startPrev)
      .lte("issue_date", endPrev)

    const currentYear = emptyMonths()
    const previousYear = emptyMonths()

    if (currentData) {
      for (const inv of currentData) {
        const m = new Date(inv.issue_date).getMonth()
        currentYear[m].amount += Number(inv.total_amount) || 0
      }
    }

    if (prevData) {
      for (const inv of prevData) {
        const m = new Date(inv.issue_date).getMonth()
        previousYear[m].amount += Number(inv.total_amount) || 0
      }
    }

    return { currentYear, previousYear, year }
  } catch {
    return { currentYear: emptyMonths(), previousYear: emptyMonths(), year }
  }
}

// ---------- Expense Data ----------

export async function getExpenseData(
  companyId: string,
  supabase: SupabaseClient,
  year: number
): Promise<ExpenseData> {
  try {
    const start = `${year}-01-01`
    const end = `${year}-12-31`

    const { data } = await (supabase.from("invoices") as any)
      .select("issue_date, total_amount, category")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .is("deleted_at", null)
      .gte("issue_date", start)
      .lte("issue_date", end)

    const monthly = emptyMonths()
    const categoryMap = new Map<string, number>()

    if (data) {
      for (const inv of data) {
        const m = new Date(inv.issue_date).getMonth()
        const amount = Number(inv.total_amount) || 0
        monthly[m].amount += amount

        const cat = inv.category || "ostatne"
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + amount)
      }
    }

    const byCategory = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }))

    return { monthly, byCategory, year }
  } catch {
    return { monthly: emptyMonths(), byCategory: [], year }
  }
}

// ---------- Cash Flow Data ----------

export async function getCashFlowData(
  companyId: string,
  supabase: SupabaseClient,
  year: number
): Promise<CashFlowData> {
  try {
    const start = `${year}-01-01`
    const end = `${year}-12-31`

    const { data: issued } = await (supabase.from("invoices") as any)
      .select("issue_date, total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .eq("status", "paid")
      .is("deleted_at", null)
      .gte("issue_date", start)
      .lte("issue_date", end)

    const { data: received } = await (supabase.from("invoices") as any)
      .select("issue_date, total_amount")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .eq("status", "paid")
      .is("deleted_at", null)
      .gte("issue_date", start)
      .lte("issue_date", end)

    const monthly: CashFlowMonth[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
      net: 0,
    }))

    if (issued) {
      for (const inv of issued) {
        const m = new Date(inv.issue_date).getMonth()
        monthly[m].income += Number(inv.total_amount) || 0
      }
    }

    if (received) {
      for (const inv of received) {
        const m = new Date(inv.issue_date).getMonth()
        monthly[m].expense += Number(inv.total_amount) || 0
      }
    }

    for (const m of monthly) {
      m.net = m.income - m.expense
    }

    return { monthly, year }
  } catch {
    return {
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        income: 0,
        expense: 0,
        net: 0,
      })),
      year,
    }
  }
}

// ---------- Quick Metrics ----------

export async function getQuickMetrics(
  companyId: string,
  supabase: SupabaseClient
): Promise<QuickMetrics> {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const currentStart = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const currentEnd = new Date(year, month + 1, 0).toISOString().split("T")[0]

    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const prevStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`
    const prevEnd = new Date(prevYear, prevMonth + 1, 0).toISOString().split("T")[0]

    // Current month issued
    const { data: currentIssued } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .is("deleted_at", null)
      .gte("issue_date", currentStart)
      .lte("issue_date", currentEnd)

    // Previous month issued
    const { data: prevIssued } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .is("deleted_at", null)
      .gte("issue_date", prevStart)
      .lte("issue_date", prevEnd)

    // Current month received (expenses)
    const { data: currentReceived } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .is("deleted_at", null)
      .gte("issue_date", currentStart)
      .lte("issue_date", currentEnd)

    // Previous month received
    const { data: prevReceived } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .is("deleted_at", null)
      .gte("issue_date", prevStart)
      .lte("issue_date", prevEnd)

    // Unpaid issued (receivables)
    const { data: unpaidIssued } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .in("status", ["sent", "overdue", "draft"])
      .is("deleted_at", null)

    // Unpaid received (payables)
    const { data: unpaidReceived } = await (supabase.from("invoices") as any)
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .in("status", ["sent", "overdue", "draft"])
      .is("deleted_at", null)

    // Total invoice count this month
    const { count: pocetFaktur } = await (supabase.from("invoices") as any)
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .gte("issue_date", currentStart)
      .lte("issue_date", currentEnd)

    const sumArr = (arr: any[] | null) =>
      (arr || []).reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0)

    const obrat = sumArr(currentIssued)
    const obratPrev = sumArr(prevIssued)
    const obratChange = obratPrev > 0 ? ((obrat - obratPrev) / obratPrev) * 100 : 0

    const expCurrent = sumArr(currentReceived)
    const expPrev = sumArr(prevReceived)
    const zisk = obrat - expCurrent
    const ziskPrev = obratPrev - expPrev
    const ziskChange = ziskPrev !== 0 ? ((zisk - ziskPrev) / Math.abs(ziskPrev)) * 100 : 0

    const pohladavky = sumArr(unpaidIssued)
    const pohladavkyCount = (unpaidIssued || []).length

    const zavazky = sumArr(unpaidReceived)
    const zavazkyCount = (unpaidReceived || []).length

    return {
      obrat,
      obratChange,
      zisk,
      ziskChange,
      pohladavky,
      pohladavkyCount,
      zavazky,
      zavazkyCount,
      pocetFaktur: pocetFaktur || 0,
    }
  } catch {
    return {
      obrat: 0,
      obratChange: 0,
      zisk: 0,
      ziskChange: 0,
      pohladavky: 0,
      pohladavkyCount: 0,
      zavazky: 0,
      zavazkyCount: 0,
      pocetFaktur: 0,
    }
  }
}

// ---------- VAT Obligation ----------

export async function getVATObligation(
  companyId: string,
  supabase: SupabaseClient,
  month: number,
  year: number
): Promise<VATObligation> {
  try {
    const start = `${year}-${String(month).padStart(2, "0")}-01`
    const end = new Date(year, month, 0).toISOString().split("T")[0]

    // DPH on output (issued invoices)
    const { data: issuedData } = await (supabase.from("invoices") as any)
      .select("total_amount, total_without_vat")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .is("deleted_at", null)
      .gte("issue_date", start)
      .lte("issue_date", end)

    // DPH on input (received invoices)
    const { data: receivedData } = await (supabase.from("invoices") as any)
      .select("total_amount, total_without_vat")
      .eq("company_id", companyId)
      .eq("type", "prijata")
      .is("deleted_at", null)
      .gte("issue_date", start)
      .lte("issue_date", end)

    let vystup = 0
    let vstup = 0

    if (issuedData) {
      for (const inv of issuedData) {
        vystup += (Number(inv.total_amount) || 0) - (Number(inv.total_without_vat) || 0)
      }
    }

    if (receivedData) {
      for (const inv of receivedData) {
        vstup += (Number(inv.total_amount) || 0) - (Number(inv.total_without_vat) || 0)
      }
    }

    return {
      vystup: Math.max(0, vystup),
      vstup: Math.max(0, vstup),
      rozdiel: vystup - vstup,
      month,
      year,
    }
  } catch {
    return { vystup: 0, vstup: 0, rozdiel: 0, month, year }
  }
}

// ---------- Account Balances ----------

export async function getAccountBalances(
  companyId: string,
  supabase: SupabaseClient
): Promise<AccountBalancesData> {
  try {
    const accounts: AccountBalance[] = []

    // Bank accounts
    const { data: bankAccounts } = await (supabase.from("bank_accounts") as any)
      .select("id, name, balance, currency")
      .eq("company_id", companyId)
      .is("deleted_at", null)

    if (bankAccounts) {
      for (const acc of bankAccounts) {
        accounts.push({
          id: acc.id,
          name: acc.name,
          type: "bank",
          balance: Number(acc.balance) || 0,
          currency: acc.currency || "EUR",
        })
      }
    }

    // Cash registers
    const { data: cashRegisters } = await (supabase.from("cash_registers") as any)
      .select("id, name, balance, currency")
      .eq("company_id", companyId)
      .is("deleted_at", null)

    if (cashRegisters) {
      for (const cr of cashRegisters) {
        accounts.push({
          id: cr.id,
          name: cr.name,
          type: "cash",
          balance: Number(cr.balance) || 0,
          currency: cr.currency || "EUR",
        })
      }
    }

    const total = accounts.reduce((s, a) => s + a.balance, 0)

    return { accounts, total }
  } catch {
    return { accounts: [], total: 0 }
  }
}

// ---------- Upcoming Deadlines ----------

export async function getUpcomingDeadlines(
  companyId: string,
  supabase: SupabaseClient
): Promise<UpcomingDeadline[]> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split("T")[0]

    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + 14)
    const futureStr = futureDate.toISOString().split("T")[0]

    const pastDate = new Date(today)
    pastDate.setDate(pastDate.getDate() - 7)
    const pastStr = pastDate.toISOString().split("T")[0]

    // Upcoming due dates for unpaid invoices
    const { data: invoices } = await (supabase.from("invoices") as any)
      .select("id, number, due_date, total_amount, type")
      .eq("company_id", companyId)
      .in("status", ["sent", "overdue", "draft"])
      .is("deleted_at", null)
      .gte("due_date", pastStr)
      .lte("due_date", futureStr)
      .order("due_date", { ascending: true })
      .limit(20)

    const deadlines: UpcomingDeadline[] = []

    if (invoices) {
      for (const inv of invoices) {
        const typeLabel = inv.type === "vydana" ? "Vydaná" : "Prijatá"
        deadlines.push({
          id: inv.id,
          title: `${typeLabel} faktúra ${inv.number || ""}`,
          date: inv.due_date,
          type: "invoice",
          urgency: getUrgency(inv.due_date),
          amount: Number(inv.total_amount) || 0,
        })
      }
    }

    // Add standard tax deadlines
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    // DPH monthly - 25th of next month
    const dphDeadline = new Date(currentYear, currentMonth, 25)
    if (dphDeadline >= today && dphDeadline <= futureDate) {
      deadlines.push({
        id: `tax-dph-${currentMonth}`,
        title: `Podanie DPH za ${currentMonth}/${currentYear}`,
        date: dphDeadline.toISOString().split("T")[0],
        type: "tax",
        urgency: getUrgency(dphDeadline.toISOString().split("T")[0]),
      })
    }

    deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return deadlines
  } catch {
    return []
  }
}

// ---------- Unpaid Invoices Count ----------

export async function getUnpaidInvoicesCount(
  companyId: string,
  supabase: SupabaseClient
): Promise<UnpaidInvoicesSummary> {
  try {
    const { data } = await (supabase.from("invoices") as any)
      .select("id, total_amount, due_date")
      .eq("company_id", companyId)
      .eq("type", "vydana")
      .in("status", ["sent", "overdue", "draft"])
      .is("deleted_at", null)

    if (!data || data.length === 0) {
      return {
        count: 0,
        totalAmount: 0,
        aging: [
          { bucket: "0-30 dni", count: 0, amount: 0 },
          { bucket: "31-60 dni", count: 0, amount: 0 },
          { bucket: "61-90 dni", count: 0, amount: 0 },
          { bucket: "90+ dni", count: 0, amount: 0 },
        ],
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buckets = [
      { bucket: "0-30 dni", count: 0, amount: 0, min: 0, max: 30 },
      { bucket: "31-60 dni", count: 0, amount: 0, min: 31, max: 60 },
      { bucket: "61-90 dni", count: 0, amount: 0, min: 61, max: 90 },
      { bucket: "90+ dni", count: 0, amount: 0, min: 91, max: Infinity },
    ]

    let totalAmount = 0

    for (const inv of data) {
      const amount = Number(inv.total_amount) || 0
      totalAmount += amount

      const dueDate = new Date(inv.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

      for (const bucket of buckets) {
        if (daysOverdue >= bucket.min && daysOverdue <= bucket.max) {
          bucket.count++
          bucket.amount += amount
          break
        }
      }
    }

    return {
      count: data.length,
      totalAmount,
      aging: buckets.map((b) => ({
        bucket: b.bucket,
        count: b.count,
        amount: b.amount,
      })),
    }
  } catch {
    return {
      count: 0,
      totalAmount: 0,
      aging: [
        { bucket: "0-30 dni", count: 0, amount: 0 },
        { bucket: "31-60 dni", count: 0, amount: 0 },
        { bucket: "61-90 dni", count: 0, amount: 0 },
        { bucket: "90+ dni", count: 0, amount: 0 },
      ],
    }
  }
}

// ---------- Recent Activity ----------

export async function getRecentActivity(
  companyId: string,
  supabase: SupabaseClient
): Promise<RecentActivity[]> {
  try {
    // Get recent invoices
    const { data: recentInvoices } = await (supabase.from("invoices") as any)
      .select("id, number, type, status, created_at, updated_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(10)

    const activities: RecentActivity[] = []

    if (recentInvoices) {
      for (const inv of recentInvoices) {
        const typeLabels: Record<string, string> = {
          vydana: "vydaná",
          prijata: "prijatá",
          zalohova: "zálohová",
          dobropis: "dobropis",
          proforma: "proforma",
        }
        const statusLabels: Record<string, string> = {
          draft: "vytvorená",
          sent: "odoslaná",
          paid: "uhradená",
          overdue: "po splatnosti",
          cancelled: "zrušená",
        }
        const typeLabel = typeLabels[inv.type] || inv.type
        const statusLabel = statusLabels[inv.status] || inv.status

        activities.push({
          id: inv.id,
          action: inv.status === "draft" ? "Vytvorenie" : "Aktualizácia",
          description: `Faktúra ${typeLabel} ${inv.number || ""} - ${statusLabel}`,
          date: inv.updated_at || inv.created_at,
          type: "invoice",
        })
      }
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return activities.slice(0, 10)
  } catch {
    return []
  }
}
