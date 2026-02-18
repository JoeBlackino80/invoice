// =============================================================================
// Financial Reports Calculation Library
// =============================================================================

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface AgingInvoice {
  id: string
  contact_name: string
  invoice_number: string
  issue_date: string
  due_date: string
  amount: number
  paid_amount: number
  outstanding: number
  days_overdue: number
  bucket: string
}

export interface AgingBucket {
  label: string
  min_days: number
  max_days: number
  count: number
  total: number
  invoices: AgingInvoice[]
  color: string
}

export interface AgingReport {
  type: "receivables" | "payables"
  as_of_date: string
  buckets: AgingBucket[]
  total_outstanding: number
  total_count: number
}

export interface CashFlowMonth {
  month: string
  label: string
  income: number
  expenses: number
  balance: number
  is_forecast: boolean
}

export interface CashFlowForecast {
  historical: CashFlowMonth[]
  forecast: CashFlowMonth[]
  summary: {
    projected_income: number
    projected_expenses: number
    projected_balance: number
    confidence_level: number
    methodology: string
  }
}

export interface PeriodMetric {
  metric: string
  period1_value: number
  period2_value: number
  difference: number
  change_pct: number | null
}

export interface PeriodComparison {
  period1: { from: string; to: string }
  period2: { from: string; to: string }
  metrics: PeriodMetric[]
}

export interface FinancialIndicator {
  id: string
  name: string
  category: string
  value: number | null
  unit: string
  interpretation: "dobry" | "priemerny" | "zly" | "neutralny"
  interpretation_label: string
  benchmark_min: number | null
  benchmark_max: number | null
  benchmark_text: string
  description: string
}

export interface BreakEvenResult {
  break_even_units: number
  break_even_revenue: number
  contribution_margin: number
  contribution_margin_ratio: number
  margin_of_safety: number
  margin_of_safety_pct: number
  fixed_costs: number
  variable_cost_per_unit: number
  price_per_unit: number
  chart_data: Array<{
    units: number
    revenue: number
    total_costs: number
    fixed_costs: number
  }>
}

export interface TopContact {
  rank: number
  contact_id: string
  contact_name: string
  total_amount: number
  invoice_count: number
  average_invoice: number
  avg_days_to_pay: number | null
  payment_discipline: string
  payment_discipline_color: string
}

export interface ProductMarginItem {
  product_id: string | null
  product_name: string
  revenue: number
  cost: number
  margin: number
  margin_pct: number
  quantity_sold: number
}

// ---------------------------------------------------------------------------
// Aging Report
// ---------------------------------------------------------------------------

const AGING_BUCKETS_CONFIG = [
  { label: "0-30 dni", min_days: 0, max_days: 30, color: "green" },
  { label: "31-60 dni", min_days: 31, max_days: 60, color: "yellow" },
  { label: "61-90 dni", min_days: 61, max_days: 90, color: "orange" },
  { label: "91-180 dni", min_days: 91, max_days: 180, color: "red" },
  { label: "180+ dni", min_days: 181, max_days: 999999, color: "darkred" },
]

export function calculateAgingReport(
  invoices: any[],
  asOfDate: string,
  type: "receivables" | "payables"
): AgingReport {
  const refDate = new Date(asOfDate)

  const buckets: AgingBucket[] = AGING_BUCKETS_CONFIG.map((b) => ({
    ...b,
    count: 0,
    total: 0,
    invoices: [],
  }))

  for (const inv of invoices) {
    const dueDate = new Date(inv.due_date)
    const daysOverdue = Math.max(
      0,
      Math.floor((refDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    )

    const totalAmount = Number(inv.total_amount || 0)
    const paidAmount = Number(inv.paid_amount || 0)
    const outstanding = totalAmount - paidAmount

    if (outstanding <= 0) continue

    const agingInvoice: AgingInvoice = {
      id: inv.id,
      contact_name:
        inv.contact?.name || inv.customer_name || inv.supplier_name || "Neznamy",
      invoice_number: inv.number || inv.invoice_number || "",
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      amount: totalAmount,
      paid_amount: paidAmount,
      outstanding,
      days_overdue: daysOverdue,
      bucket: "",
    }

    for (const bucket of buckets) {
      if (daysOverdue >= bucket.min_days && daysOverdue <= bucket.max_days) {
        agingInvoice.bucket = bucket.label
        bucket.invoices.push(agingInvoice)
        bucket.count += 1
        bucket.total += outstanding
        break
      }
    }
  }

  const total_outstanding = buckets.reduce((s, b) => s + b.total, 0)
  const total_count = buckets.reduce((s, b) => s + b.count, 0)

  return { type, as_of_date: asOfDate, buckets, total_outstanding, total_count }
}

// ---------------------------------------------------------------------------
// Cash Flow Forecast (simple linear regression / moving average)
// ---------------------------------------------------------------------------

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length
  if (n === 0) return { slope: 0, intercept: 0 }
  if (n === 1) return { slope: 0, intercept: values[0] }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

export function calculateCashFlowForecast(
  historicalData: Array<{ month: string; income: number; expenses: number }>,
  forecastDays: 30 | 60 | 90
): CashFlowForecast {
  const historical: CashFlowMonth[] = historicalData.map((m) => ({
    month: m.month,
    label: formatMonthLabel(m.month),
    income: m.income,
    expenses: m.expenses,
    balance: m.income - m.expenses,
    is_forecast: false,
  }))

  const forecastMonths = Math.ceil(forecastDays / 30)

  const incomeValues = historicalData.map((m) => m.income)
  const expenseValues = historicalData.map((m) => m.expenses)

  const incomeReg = linearRegression(incomeValues)
  const expenseReg = linearRegression(expenseValues)

  const n = historicalData.length

  const forecast: CashFlowMonth[] = []
  for (let i = 0; i < forecastMonths; i++) {
    const idx = n + i
    const projectedIncome = Math.max(0, incomeReg.intercept + incomeReg.slope * idx)
    const projectedExpenses = Math.max(
      0,
      expenseReg.intercept + expenseReg.slope * idx
    )

    const lastMonth =
      historicalData.length > 0
        ? historicalData[historicalData.length - 1].month
        : new Date().toISOString().slice(0, 7)
    const forecastDate = addMonths(lastMonth, i + 1)

    forecast.push({
      month: forecastDate,
      label: formatMonthLabel(forecastDate),
      income: Math.round(projectedIncome * 100) / 100,
      expenses: Math.round(projectedExpenses * 100) / 100,
      balance:
        Math.round((projectedIncome - projectedExpenses) * 100) / 100,
      is_forecast: true,
    })
  }

  const totalProjectedIncome = forecast.reduce((s, m) => s + m.income, 0)
  const totalProjectedExpenses = forecast.reduce((s, m) => s + m.expenses, 0)

  // Confidence decreases with less historical data and longer forecast
  const dataPoints = historicalData.length
  const confidence = Math.min(
    95,
    Math.max(30, Math.round(60 + dataPoints * 3 - forecastMonths * 5))
  )

  return {
    historical,
    forecast,
    summary: {
      projected_income: Math.round(totalProjectedIncome * 100) / 100,
      projected_expenses: Math.round(totalProjectedExpenses * 100) / 100,
      projected_balance:
        Math.round((totalProjectedIncome - totalProjectedExpenses) * 100) / 100,
      confidence_level: confidence,
      methodology:
        "Linearna regresia na zaklade historickych mesacnych dat s jednoduchou extrapolaciou trendu.",
    },
  }
}

function addMonths(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split("-").map(Number)
  const d = new Date(y, m - 1 + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(yearMonth: string): string {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Maj",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dec",
  ]
  const parts = yearMonth.split("-")
  const monthIdx = parseInt(parts[1], 10) - 1
  return `${monthNames[monthIdx]} ${parts[0]}`
}

// ---------------------------------------------------------------------------
// Period Comparison
// ---------------------------------------------------------------------------

export function comparePeriods(
  period1Data: {
    revenue: number
    expenses: number
    profit: number
    invoice_count: number
    average_invoice: number
  },
  period2Data: {
    revenue: number
    expenses: number
    profit: number
    invoice_count: number
    average_invoice: number
  },
  period1Range: { from: string; to: string },
  period2Range: { from: string; to: string }
): PeriodComparison {
  const metricsConfig = [
    { key: "revenue" as const, label: "Trzby" },
    { key: "expenses" as const, label: "Naklady" },
    { key: "profit" as const, label: "Zisk" },
    { key: "invoice_count" as const, label: "Pocet faktur" },
    { key: "average_invoice" as const, label: "Priemerna faktura" },
  ]

  const metrics: PeriodMetric[] = metricsConfig.map(({ key, label }) => {
    const v1 = period1Data[key]
    const v2 = period2Data[key]
    const diff = v2 - v1
    const changePct = v1 !== 0 ? ((v2 - v1) / Math.abs(v1)) * 100 : null

    return {
      metric: label,
      period1_value: Math.round(v1 * 100) / 100,
      period2_value: Math.round(v2 * 100) / 100,
      difference: Math.round(diff * 100) / 100,
      change_pct: changePct !== null ? Math.round(changePct * 100) / 100 : null,
    }
  })

  return {
    period1: period1Range,
    period2: period2Range,
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Financial Indicators
// ---------------------------------------------------------------------------

export function calculateFinancialIndicators(
  data: {
    obezne_aktiva: number
    zasoby: number
    kratkodobe_zavazky: number
    cudzie_zdroje: number
    celkove_aktiva: number
    vlastne_imanie: number
    cisty_zisk: number
    trzby: number
    naklady: number
    pohladavky: number
    zavazky: number
    naklady_na_predany_tovar: number
  }
): FinancialIndicator[] {
  const indicators: FinancialIndicator[] = []

  // Bezna likvidita
  const beznaLikvidita =
    data.kratkodobe_zavazky !== 0
      ? data.obezne_aktiva / data.kratkodobe_zavazky
      : null
  indicators.push({
    id: "bezna_likvidita",
    name: "Bezna likvidita",
    category: "Likvidita",
    value: beznaLikvidita !== null ? Math.round(beznaLikvidita * 100) / 100 : null,
    unit: "pomer",
    interpretation: interpretRatio(beznaLikvidita, 1.5, 2.5),
    interpretation_label: interpretLabel(interpretRatio(beznaLikvidita, 1.5, 2.5)),
    benchmark_min: 1.5,
    benchmark_max: 2.5,
    benchmark_text: "Odporucany rozsah: 1,5 - 2,5",
    description:
      "Schopnost podniku uhradit kratkodobe zavazky z obeznych aktiv.",
  })

  // Pohotova likvidita
  const pohotLikvidita =
    data.kratkodobe_zavazky !== 0
      ? (data.obezne_aktiva - data.zasoby) / data.kratkodobe_zavazky
      : null
  indicators.push({
    id: "pohotova_likvidita",
    name: "Pohotova likvidita",
    category: "Likvidita",
    value: pohotLikvidita !== null ? Math.round(pohotLikvidita * 100) / 100 : null,
    unit: "pomer",
    interpretation: interpretRatio(pohotLikvidita, 1.0, 1.5),
    interpretation_label: interpretLabel(interpretRatio(pohotLikvidita, 1.0, 1.5)),
    benchmark_min: 1.0,
    benchmark_max: 1.5,
    benchmark_text: "Odporucany rozsah: 1,0 - 1,5",
    description:
      "Schopnost uhradit zavazky bez nutnosti predaja zasob.",
  })

  // Celkova zadlzenost
  const zadlzenost =
    data.celkove_aktiva !== 0
      ? (data.cudzie_zdroje / data.celkove_aktiva) * 100
      : null
  indicators.push({
    id: "celkova_zadlzenost",
    name: "Celkova zadlzenost",
    category: "Zadlzenost",
    value: zadlzenost !== null ? Math.round(zadlzenost * 100) / 100 : null,
    unit: "%",
    interpretation: interpretDebt(zadlzenost),
    interpretation_label: interpretLabel(interpretDebt(zadlzenost)),
    benchmark_min: 30,
    benchmark_max: 60,
    benchmark_text: "Odporucany rozsah: 30 % - 60 %",
    description:
      "Podiel cudzich zdrojov na celkovom majetku podniku.",
  })

  // ROA
  const roa =
    data.celkove_aktiva !== 0
      ? (data.cisty_zisk / data.celkove_aktiva) * 100
      : null
  indicators.push({
    id: "roa",
    name: "ROA (rentabilita aktiv)",
    category: "Rentabilita",
    value: roa !== null ? Math.round(roa * 100) / 100 : null,
    unit: "%",
    interpretation: interpretProfitability(roa, 5, 10),
    interpretation_label: interpretLabel(interpretProfitability(roa, 5, 10)),
    benchmark_min: 5,
    benchmark_max: 10,
    benchmark_text: "Dobry vysledok: > 5 %, vynikajuci: > 10 %",
    description: "Efektivnost vyuzivania celkoveho majetku na tvorbu zisku.",
  })

  // ROE
  const roe =
    data.vlastne_imanie !== 0
      ? (data.cisty_zisk / data.vlastne_imanie) * 100
      : null
  indicators.push({
    id: "roe",
    name: "ROE (rentabilita vlastneho imania)",
    category: "Rentabilita",
    value: roe !== null ? Math.round(roe * 100) / 100 : null,
    unit: "%",
    interpretation: interpretProfitability(roe, 8, 15),
    interpretation_label: interpretLabel(interpretProfitability(roe, 8, 15)),
    benchmark_min: 8,
    benchmark_max: 15,
    benchmark_text: "Dobry vysledok: > 8 %, vynikajuci: > 15 %",
    description: "Vynosnost vlastneho kapitalu vlozeneho do podniku.",
  })

  // ROS
  const ros =
    data.trzby !== 0 ? (data.cisty_zisk / data.trzby) * 100 : null
  indicators.push({
    id: "ros",
    name: "ROS (rentabilita trzby)",
    category: "Rentabilita",
    value: ros !== null ? Math.round(ros * 100) / 100 : null,
    unit: "%",
    interpretation: interpretProfitability(ros, 5, 10),
    interpretation_label: interpretLabel(interpretProfitability(ros, 5, 10)),
    benchmark_min: 5,
    benchmark_max: 10,
    benchmark_text: "Dobry vysledok: > 5 %, vynikajuci: > 10 %",
    description: "Kolko percent z trzby zostava ako cisty zisk.",
  })

  // Doba obratu pohladavok
  const dobaObratPohl =
    data.trzby !== 0 ? (data.pohladavky / data.trzby) * 365 : null
  indicators.push({
    id: "doba_obratu_pohladavok",
    name: "Doba obratu pohladavok",
    category: "Aktivita",
    value: dobaObratPohl !== null ? Math.round(dobaObratPohl * 10) / 10 : null,
    unit: "dni",
    interpretation: interpretTurnoverDays(dobaObratPohl, 30, 60),
    interpretation_label: interpretLabel(
      interpretTurnoverDays(dobaObratPohl, 30, 60)
    ),
    benchmark_min: null,
    benchmark_max: 30,
    benchmark_text: "Idealny stav: do 30 dni, akceptovatelny: do 60 dni",
    description:
      "Priemerny pocet dni od vystavenia faktury po jej uhradenie odberatelom.",
  })

  // Doba obratu zavazkov
  const dobaObratZav =
    data.naklady !== 0 ? (data.zavazky / data.naklady) * 365 : null
  indicators.push({
    id: "doba_obratu_zavazkov",
    name: "Doba obratu zavazkov",
    category: "Aktivita",
    value: dobaObratZav !== null ? Math.round(dobaObratZav * 10) / 10 : null,
    unit: "dni",
    interpretation: interpretTurnoverDays(dobaObratZav, 30, 60),
    interpretation_label: interpretLabel(
      interpretTurnoverDays(dobaObratZav, 30, 60)
    ),
    benchmark_min: null,
    benchmark_max: 30,
    benchmark_text: "Idealny stav: do 30 dni, akceptovatelny: do 60 dni",
    description:
      "Priemerny pocet dni od prijatia faktury po jej uhradenie dodavatelovi.",
  })

  // Doba obratu zasob
  const dobaObratZas =
    data.naklady_na_predany_tovar !== 0
      ? (data.zasoby / data.naklady_na_predany_tovar) * 365
      : null
  indicators.push({
    id: "doba_obratu_zasob",
    name: "Doba obratu zasob",
    category: "Aktivita",
    value: dobaObratZas !== null ? Math.round(dobaObratZas * 10) / 10 : null,
    unit: "dni",
    interpretation: interpretTurnoverDays(dobaObratZas, 30, 90),
    interpretation_label: interpretLabel(
      interpretTurnoverDays(dobaObratZas, 30, 90)
    ),
    benchmark_min: null,
    benchmark_max: 30,
    benchmark_text: "Idealny stav: do 30 dni, akceptovatelny: do 90 dni",
    description:
      "Priemerny pocet dni, za ktory sa zasoby premenia na trzby.",
  })

  return indicators
}

function interpretRatio(
  value: number | null,
  goodMin: number,
  goodMax: number
): "dobry" | "priemerny" | "zly" | "neutralny" {
  if (value === null) return "neutralny"
  if (value >= goodMin && value <= goodMax) return "dobry"
  if (value >= goodMin * 0.7 && value < goodMin) return "priemerny"
  if (value > goodMax && value <= goodMax * 1.5) return "priemerny"
  return "zly"
}

function interpretDebt(
  value: number | null
): "dobry" | "priemerny" | "zly" | "neutralny" {
  if (value === null) return "neutralny"
  if (value <= 60) return "dobry"
  if (value <= 80) return "priemerny"
  return "zly"
}

function interpretProfitability(
  value: number | null,
  good: number,
  excellent: number
): "dobry" | "priemerny" | "zly" | "neutralny" {
  if (value === null) return "neutralny"
  if (value >= excellent) return "dobry"
  if (value >= good) return "priemerny"
  if (value >= 0) return "priemerny"
  return "zly"
}

function interpretTurnoverDays(
  value: number | null,
  good: number,
  acceptable: number
): "dobry" | "priemerny" | "zly" | "neutralny" {
  if (value === null) return "neutralny"
  if (value <= good) return "dobry"
  if (value <= acceptable) return "priemerny"
  return "zly"
}

function interpretLabel(
  i: "dobry" | "priemerny" | "zly" | "neutralny"
): string {
  const map: Record<string, string> = {
    dobry: "Dobry",
    priemerny: "Priemerny",
    zly: "Zly",
    neutralny: "Nedostatok dat",
  }
  return map[i] || i
}

// ---------------------------------------------------------------------------
// Break-even Analysis
// ---------------------------------------------------------------------------

export function calculateBreakEven(
  fixedCosts: number,
  variableCostPerUnit: number,
  pricePerUnit: number,
  currentUnits?: number
): BreakEvenResult {
  const contributionMargin = pricePerUnit - variableCostPerUnit
  const contributionMarginRatio =
    pricePerUnit !== 0 ? contributionMargin / pricePerUnit : 0

  const breakEvenUnits =
    contributionMargin > 0 ? fixedCosts / contributionMargin : 0
  const breakEvenRevenue =
    contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : 0

  const currentRevenue = (currentUnits || 0) * pricePerUnit
  const marginOfSafety = currentRevenue - breakEvenRevenue
  const marginOfSafetyPct =
    currentRevenue > 0 ? (marginOfSafety / currentRevenue) * 100 : 0

  // Generate chart data points
  const maxUnits = Math.max(Math.ceil(breakEvenUnits * 2), 10)
  const step = Math.max(1, Math.floor(maxUnits / 10))
  const chart_data: BreakEvenResult["chart_data"] = []

  for (let u = 0; u <= maxUnits; u += step) {
    chart_data.push({
      units: u,
      revenue: u * pricePerUnit,
      total_costs: fixedCosts + u * variableCostPerUnit,
      fixed_costs: fixedCosts,
    })
  }

  return {
    break_even_units: Math.round(breakEvenUnits * 100) / 100,
    break_even_revenue: Math.round(breakEvenRevenue * 100) / 100,
    contribution_margin: Math.round(contributionMargin * 100) / 100,
    contribution_margin_ratio:
      Math.round(contributionMarginRatio * 10000) / 100,
    margin_of_safety: Math.round(marginOfSafety * 100) / 100,
    margin_of_safety_pct: Math.round(marginOfSafetyPct * 100) / 100,
    fixed_costs: fixedCosts,
    variable_cost_per_unit: variableCostPerUnit,
    price_per_unit: pricePerUnit,
    chart_data,
  }
}

// ---------------------------------------------------------------------------
// Top Customers / Suppliers
// ---------------------------------------------------------------------------

export function getTopCustomers(
  invoices: any[],
  limit: number = 10
): TopContact[] {
  const contactMap = new Map<
    string,
    {
      contact_id: string
      contact_name: string
      total: number
      count: number
      days_to_pay: number[]
    }
  >()

  for (const inv of invoices) {
    const contactId = inv.contact_id || "unknown"
    const contactName =
      inv.contact?.name || inv.customer_name || "Neznamy"

    if (!contactMap.has(contactId)) {
      contactMap.set(contactId, {
        contact_id: contactId,
        contact_name: contactName,
        total: 0,
        count: 0,
        days_to_pay: [],
      })
    }

    const entry = contactMap.get(contactId)!
    entry.total += Number(inv.total_amount || 0)
    entry.count += 1

    if (inv.paid_at && inv.issue_date) {
      const issuedDate = new Date(inv.issue_date)
      const paidDate = new Date(inv.paid_at)
      const daysToPay = Math.max(
        0,
        Math.floor(
          (paidDate.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
      entry.days_to_pay.push(daysToPay)
    }
  }

  const sorted = Array.from(contactMap.values()).sort(
    (a, b) => b.total - a.total
  )

  return sorted.slice(0, limit).map((c, idx) => {
    const avgDays =
      c.days_to_pay.length > 0
        ? Math.round(
            c.days_to_pay.reduce((s, d) => s + d, 0) / c.days_to_pay.length
          )
        : null

    let discipline = "Bez dat"
    let disciplineColor = "gray"

    if (avgDays !== null) {
      if (avgDays <= 14) {
        discipline = "Vyborna"
        disciplineColor = "green"
      } else if (avgDays <= 30) {
        discipline = "Dobra"
        disciplineColor = "blue"
      } else if (avgDays <= 60) {
        discipline = "Priemerna"
        disciplineColor = "yellow"
      } else {
        discipline = "Zla"
        disciplineColor = "red"
      }
    }

    return {
      rank: idx + 1,
      contact_id: c.contact_id,
      contact_name: c.contact_name,
      total_amount: Math.round(c.total * 100) / 100,
      invoice_count: c.count,
      average_invoice:
        c.count > 0 ? Math.round((c.total / c.count) * 100) / 100 : 0,
      avg_days_to_pay: avgDays,
      payment_discipline: discipline,
      payment_discipline_color: disciplineColor,
    }
  })
}

export function getTopSuppliers(
  invoices: any[],
  limit: number = 10
): TopContact[] {
  return getTopCustomers(invoices, limit)
}

// ---------------------------------------------------------------------------
// Product Margin
// ---------------------------------------------------------------------------

export function calculateProductMargin(
  invoiceItems: any[],
  costMap: Map<string, number>
): ProductMarginItem[] {
  const productMap = new Map<
    string,
    {
      product_id: string | null
      product_name: string
      revenue: number
      cost: number
      quantity: number
    }
  >()

  for (const item of invoiceItems) {
    const key = item.product_id || item.description || "Ostatne"
    const productName = item.product_name || item.description || "Ostatne"

    if (!productMap.has(key)) {
      productMap.set(key, {
        product_id: item.product_id || null,
        product_name: productName,
        revenue: 0,
        cost: 0,
        quantity: 0,
      })
    }

    const entry = productMap.get(key)!
    const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0)
    entry.revenue += lineTotal
    entry.quantity += Number(item.quantity || 0)

    const unitCost = costMap.get(key) || 0
    entry.cost += unitCost * Number(item.quantity || 0)
  }

  return Array.from(productMap.values())
    .map((p) => {
      const margin = p.revenue - p.cost
      const marginPct = p.revenue > 0 ? (margin / p.revenue) * 100 : 0

      return {
        product_id: p.product_id,
        product_name: p.product_name,
        revenue: Math.round(p.revenue * 100) / 100,
        cost: Math.round(p.cost * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        margin_pct: Math.round(marginPct * 100) / 100,
        quantity_sold: p.quantity,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}
