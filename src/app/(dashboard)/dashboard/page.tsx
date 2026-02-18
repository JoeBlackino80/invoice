"use client"

import { useCompany } from "@/hooks/use-company"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Settings,
  Building2,
  Banknote,
  Clock,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Activity,
  Plus,
  Users,
} from "lucide-react"
import Link from "next/link"
import { calculateNextDPHDeadline } from "@/lib/tax/dph-deadlines"

import type {
  RevenueData,
  ExpenseData,
  CashFlowData,
  QuickMetrics,
  VATObligation,
  AccountBalancesData,
  UpcomingDeadline,
  UnpaidInvoicesSummary,
  RecentActivity,
} from "@/lib/reports/dashboard-data"

// ---------- Types ----------

interface DashboardData {
  revenue: RevenueData | null
  expenses: ExpenseData | null
  cashFlow: CashFlowData | null
  metrics: QuickMetrics | null
  vat: VATObligation | null
  accounts: AccountBalancesData | null
  deadlines: UpcomingDeadline[] | null
  unpaid: UnpaidInvoicesSummary | null
  activity: RecentActivity[] | null
}

interface WidgetConfig {
  id: string
  label: string
  visible: boolean
  order: number
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "quick-metrics", label: "Rychle metriky", visible: true, order: 0 },
  { id: "revenue-chart", label: "Trzby", visible: true, order: 1 },
  { id: "expense-chart", label: "Naklady", visible: true, order: 2 },
  { id: "cash-flow", label: "Cash flow", visible: true, order: 3 },
  { id: "vat-obligation", label: "DPH", visible: true, order: 4 },
  { id: "account-balances", label: "Stav uctov", visible: true, order: 5 },
  { id: "upcoming-deadlines", label: "Terminy", visible: true, order: 6 },
  { id: "unpaid-invoices", label: "Neuhradene", visible: true, order: 7 },
  { id: "recent-activity", label: "Aktivita", visible: true, order: 8 },
]

// ---------- Helpers ----------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr))
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Máj", "Jún",
  "Júl", "Aug", "Sep", "Okt", "Nov", "Dec",
]

const CATEGORY_LABELS: Record<string, string> = {
  material: "Materiál",
  sluzby: "Služby",
  mzdy: "Mzdy",
  ostatne: "Ostatné",
  energie: "Energie",
  najom: "Nájom",
  doprava: "Doprava",
}

const CATEGORY_COLORS: Record<string, string> = {
  material: "bg-blue-500",
  sluzby: "bg-emerald-500",
  mzdy: "bg-amber-500",
  ostatne: "bg-gray-400",
  energie: "bg-purple-500",
  najom: "bg-pink-500",
  doprava: "bg-cyan-500",
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "overdue": return "text-red-600 bg-red-50 border-red-200"
    case "today": return "text-orange-600 bg-orange-50 border-orange-200"
    case "tomorrow": return "text-orange-500 bg-orange-50 border-orange-200"
    case "this_week": return "text-yellow-600 bg-yellow-50 border-yellow-200"
    default: return "text-green-600 bg-green-50 border-green-200"
  }
}

function getUrgencyLabel(urgency: string): string {
  switch (urgency) {
    case "overdue": return "Po splatnosti"
    case "today": return "Dnes"
    case "tomorrow": return "Zajtra"
    case "this_week": return "Tento tyden"
    default: return "Neskor"
  }
}

// ---------- Skeleton ----------

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-8 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-2/3" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-end gap-1 h-40">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-t"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// ---------- Quick Metrics Widget ----------

function QuickMetricsWidget({
  metrics,
  loading,
}: {
  metrics: QuickMetrics | null
  loading: boolean
}) {
  if (loading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent><WidgetSkeleton /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: "Obrat tento mesiac",
      value: formatCurrency(metrics.obrat),
      change: metrics.obratChange,
      icon: TrendingUp,
      sub: `${metrics.pocetFaktur} faktur tento mesiac`,
    },
    {
      title: "Zisk",
      value: formatCurrency(metrics.zisk),
      change: metrics.ziskChange,
      icon: metrics.zisk >= 0 ? TrendingUp : TrendingDown,
      sub: "Trzby minus naklady",
    },
    {
      title: "Pohladavky",
      value: formatCurrency(metrics.pohladavky),
      change: null,
      icon: FileText,
      sub: `${metrics.pohladavkyCount} neuhradených faktur`,
    },
    {
      title: "Zavazky",
      value: formatCurrency(metrics.zavazky),
      change: null,
      icon: Wallet,
      sub: `${metrics.zavazkyCount} neuhradených faktur`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {card.change !== null ? (
                <>
                  {card.change >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={card.change >= 0 ? "text-green-600" : "text-red-600"}>
                    {card.change >= 0 ? "+" : ""}
                    {card.change.toFixed(1)}%
                  </span>
                  <span className="ml-1">oproti minulemu mesiacu</span>
                </>
              ) : (
                <span>{card.sub}</span>
              )}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------- Revenue Chart Widget ----------

function RevenueChartWidget({
  revenue,
  loading,
}: {
  revenue: RevenueData | null
  loading: boolean
}) {
  if (loading || !revenue) {
    return (
      <Card className="col-span-1 md:col-span-1 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Trzby</CardTitle>
          <CardDescription>Mesacne porovnanie</CardDescription>
        </CardHeader>
        <CardContent><ChartSkeleton /></CardContent>
      </Card>
    )
  }

  const maxVal = Math.max(
    1,
    ...revenue.currentYear.map((m) => m.amount),
    ...revenue.previousYear.map((m) => m.amount)
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Trzby</CardTitle>
          <CardDescription>
            Mesacny prehad - {revenue.year} vs {revenue.year - 1}
          </CardDescription>
        </div>
        <Link href="/invoices?type=vydana" className="text-sm text-primary hover:underline flex items-center gap-1">
          Zobrazit viac <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>{revenue.year}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span>{revenue.year - 1}</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-44">
          {revenue.currentYear.map((m, i) => {
            const currentH = maxVal > 0 ? (m.amount / maxVal) * 100 : 0
            const prevH = maxVal > 0 ? (revenue.previousYear[i].amount / maxVal) * 100 : 0

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5" style={{ height: "160px" }}>
                  <div
                    className="flex-1 bg-muted-foreground/20 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(prevH, 1)}%` }}
                    title={`${MONTH_LABELS[i]} ${revenue.year - 1}: ${formatCurrency(revenue.previousYear[i].amount)}`}
                  />
                  <div
                    className="flex-1 bg-primary rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(currentH, 1)}%` }}
                    title={`${MONTH_LABELS[i]} ${revenue.year}: ${formatCurrency(m.amount)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{MONTH_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Expense Chart Widget ----------

function ExpenseChartWidget({
  expenses,
  loading,
}: {
  expenses: ExpenseData | null
  loading: boolean
}) {
  if (loading || !expenses) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Naklady podla kategorie</CardTitle>
          <CardDescription>Rozdelenie nakladov</CardDescription>
        </CardHeader>
        <CardContent><ChartSkeleton /></CardContent>
      </Card>
    )
  }

  const totalExpenses = expenses.byCategory.reduce((s, c) => s + c.amount, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Naklady podla kategorie</CardTitle>
          <CardDescription>
            Celkom: {formatCurrency(totalExpenses)}
          </CardDescription>
        </div>
        <Link href="/invoices?type=prijata" className="text-sm text-primary hover:underline flex items-center gap-1">
          Zobrazit viac <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {expenses.byCategory.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">Ziadne naklady v tomto obdobi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.byCategory
              .sort((a, b) => b.amount - a.amount)
              .map((cat) => {
                const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
                const colorClass = CATEGORY_COLORS[cat.category] || "bg-gray-400"
                const label = CATEGORY_LABELS[cat.category] || cat.category

                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(cat.amount)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorClass} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 0.5)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Cash Flow Widget ----------

function CashFlowWidget({
  cashFlow,
  loading,
}: {
  cashFlow: CashFlowData | null
  loading: boolean
}) {
  if (loading || !cashFlow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash flow</CardTitle>
          <CardDescription>Prijmy vs vydavky</CardDescription>
        </CardHeader>
        <CardContent><ChartSkeleton /></CardContent>
      </Card>
    )
  }

  const maxVal = Math.max(
    1,
    ...cashFlow.monthly.map((m) => Math.max(m.income, m.expense))
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Cash flow</CardTitle>
          <CardDescription>Mesacne prijmy vs vydavky - {cashFlow.year}</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>Prijmy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-400" />
            <span>Vydavky</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {cashFlow.monthly.map((m, i) => {
            const incH = maxVal > 0 ? (m.income / maxVal) * 100 : 0
            const expH = maxVal > 0 ? (m.expense / maxVal) * 100 : 0

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5" style={{ height: "120px" }}>
                  <div
                    className="flex-1 bg-emerald-500/80 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(incH, 1)}%` }}
                    title={`${MONTH_LABELS[i]} prijmy: ${formatCurrency(m.income)}`}
                  />
                  <div
                    className="flex-1 bg-red-400/80 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(expH, 1)}%` }}
                    title={`${MONTH_LABELS[i]} vydavky: ${formatCurrency(m.expense)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{MONTH_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
        {/* Net line summary */}
        <Separator className="my-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Cisty cash flow (rok):</span>
          <span className={`font-semibold ${cashFlow.monthly.reduce((s, m) => s + m.net, 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(cashFlow.monthly.reduce((s, m) => s + m.net, 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- VAT Obligation Widget ----------

function VATWidget({
  vat,
  loading,
  vatPeriod,
}: {
  vat: VATObligation | null
  loading: boolean
  vatPeriod?: "mesacne" | "stvrtrocne" | null
}) {
  if (loading || !vat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DPH povinnost</CardTitle>
        </CardHeader>
        <CardContent><WidgetSkeleton /></CardContent>
      </Card>
    )
  }

  const dphDeadline = calculateNextDPHDeadline(vatPeriod || "mesacne")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">DPH povinnost</CardTitle>
          <CardDescription>
            {vat.month}/{vat.year}
          </CardDescription>
        </div>
        <Link href="/taxes/dph" className="text-sm text-primary hover:underline flex items-center gap-1">
          Zobrazit viac <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">DPH na vystupe</span>
            <span className="font-medium">{formatCurrency(vat.vystup)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">DPH na vstupe</span>
            <span className="font-medium">{formatCurrency(vat.vstup)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {vat.rozdiel >= 0 ? "Na odvod" : "Nadmerny odpocet"}
            </span>
            <span className={`text-lg font-bold ${vat.rozdiel >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(Math.abs(vat.rozdiel))}
            </span>
          </div>
          {vat.rozdiel > 0 && (
            <p className="text-xs text-muted-foreground">
              Povinnost odviest DPH do 25. dna nasledujuceho mesiaca
            </p>
          )}
          <div className={`mt-3 p-2 rounded text-xs ${
            dphDeadline.warningLevel === "ok" ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" :
            dphDeadline.warningLevel === "warning" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400" :
            "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
          }`}>
            {dphDeadline.isOverdue
              ? `⚠ DPH po termíne! (${dphDeadline.periodLabel})`
              : `Termín DPH za ${dphDeadline.periodLabel}: ${dphDeadline.daysRemaining} dní`
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Account Balances Widget ----------

function AccountBalancesWidget({
  accounts,
  loading,
}: {
  accounts: AccountBalancesData | null
  loading: boolean
}) {
  if (loading || !accounts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stav uctov</CardTitle>
        </CardHeader>
        <CardContent><WidgetSkeleton /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Stav uctov</CardTitle>
          <CardDescription>Bankove ucty a pokladne</CardDescription>
        </div>
        <Link href="/bank" className="text-sm text-primary hover:underline flex items-center gap-1">
          Zobrazit viac <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {accounts.accounts.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <p className="text-sm">Ziadne ucty ani pokladne</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  {acc.type === "bank" ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">{acc.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {acc.type === "bank" ? "Banka" : "Pokladna"}
                  </Badge>
                </div>
                <span className={`font-medium text-sm ${acc.balance >= 0 ? "" : "text-red-600"}`}>
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-medium">Celkom</span>
              <span className={`font-bold ${accounts.total >= 0 ? "" : "text-red-600"}`}>
                {formatCurrency(accounts.total)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Upcoming Deadlines Widget ----------

function UpcomingDeadlinesWidget({
  deadlines,
  loading,
}: {
  deadlines: UpcomingDeadline[] | null
  loading: boolean
}) {
  if (loading || !deadlines) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bliziace sa terminy</CardTitle>
        </CardHeader>
        <CardContent><WidgetSkeleton /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Bliziace sa terminy</CardTitle>
          <CardDescription>Splatnosti faktur a danove podania</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ziadne bliziace sa terminy</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deadlines.map((d) => (
              <div
                key={d.id}
                className={`flex items-center justify-between p-2 rounded-md border ${getUrgencyColor(d.urgency)}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {d.type === "invoice" ? (
                    <FileText className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs opacity-75">{formatDate(d.date)} - {getUrgencyLabel(d.urgency)}</p>
                  </div>
                </div>
                {d.amount !== undefined && (
                  <span className="text-sm font-medium shrink-0 ml-2">
                    {formatCurrency(d.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Unpaid Invoices Widget ----------

function UnpaidInvoicesWidget({
  unpaid,
  loading,
}: {
  unpaid: UnpaidInvoicesSummary | null
  loading: boolean
}) {
  if (loading || !unpaid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Neuhradene faktury</CardTitle>
        </CardHeader>
        <CardContent><WidgetSkeleton /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Neuhradene faktury</CardTitle>
          <CardDescription>Vydane faktury cakajuce na uhradu</CardDescription>
        </div>
        <Link href="/invoices?status=unpaid" className="text-sm text-primary hover:underline flex items-center gap-1">
          Zobrazit viac <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {unpaid.count === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <p className="text-sm">Vsetky faktury su uhradene</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{unpaid.count}</p>
                <p className="text-xs text-muted-foreground">neuhradených faktur</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-600">{formatCurrency(unpaid.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">celkova suma</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Aging analyza</p>
              {unpaid.aging.map((bucket) => {
                const agingColor =
                  bucket.bucket === "90+" ? "text-red-600 font-bold" :
                  bucket.bucket === "61-90" ? "text-orange-600" :
                  bucket.bucket === "31-60" ? "text-yellow-600" :
                  ""
                return (
                  <div key={bucket.bucket} className={`flex items-center justify-between text-sm ${agingColor}`}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{bucket.bucket}</span>
                      <Badge variant="secondary" className="text-[10px]">{bucket.count}</Badge>
                    </div>
                    <span className="font-medium">{formatCurrency(bucket.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Recent Activity Widget ----------

function RecentActivityWidget({
  activity,
  loading,
}: {
  activity: RecentActivity[] | null
  loading: boolean
}) {
  if (loading || !activity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Posledna aktivita</CardTitle>
        </CardHeader>
        <CardContent><WidgetSkeleton /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Posledna aktivita</CardTitle>
        <CardDescription>Posledne akcie v systeme</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ziadna aktivita</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Main Dashboard Page ----------

export default function DashboardPage() {
  const { activeCompany, activeCompanyId, hasCompanies, isLoading: companyLoading } = useCompany()
  const router = useRouter()

  const [data, setData] = useState<DashboardData>({
    revenue: null,
    expenses: null,
    cashFlow: null,
    metrics: null,
    vat: null,
    accounts: null,
    deadlines: null,
    unpaid: null,
    activity: null,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [year] = useState(new Date().getFullYear())

  const fetchDashboardData = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/dashboard?company_id=${activeCompanyId}&year=${year}`
      )
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // Keep existing data on error
    }
  }, [activeCompanyId, year])

  const fetchWidgetConfig = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/dashboard/widgets?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const json = await res.json()
        if (json.widgets) {
          setWidgetConfig(json.widgets)
        }
      }
    } catch {
      // Use defaults from localStorage fallback
      try {
        const stored = localStorage.getItem(`dashboard_widgets_${activeCompanyId}`)
        if (stored) {
          setWidgetConfig(JSON.parse(stored))
        }
      } catch {
        // Use defaults
      }
    }
  }, [activeCompanyId])

  useEffect(() => {
    if (!companyLoading && !hasCompanies) {
      router.push("/onboarding")
    }
  }, [companyLoading, hasCompanies, router])

  useEffect(() => {
    if (!activeCompanyId) return
    setLoading(true)
    Promise.all([fetchDashboardData(), fetchWidgetConfig()]).finally(() => {
      setLoading(false)
    })
  }, [activeCompanyId, fetchDashboardData, fetchWidgetConfig])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  if (companyLoading || !activeCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Nacitavam...</p>
        </div>
      </div>
    )
  }

  const isWidgetVisible = (id: string) => {
    const w = widgetConfig.find((w) => w.id === id)
    return w ? w.visible : true
  }

  const sortedWidgets = [...widgetConfig].sort((a, b) => a.order - b.order)

  // Build widget map
  const widgetMap: Record<string, React.ReactNode> = {
    "quick-metrics": (
      <div key="quick-metrics" className="col-span-full">
        <QuickMetricsWidget metrics={data.metrics} loading={loading} />
      </div>
    ),
    "revenue-chart": (
      <RevenueChartWidget key="revenue-chart" revenue={data.revenue} loading={loading} />
    ),
    "expense-chart": (
      <ExpenseChartWidget key="expense-chart" expenses={data.expenses} loading={loading} />
    ),
    "cash-flow": (
      <CashFlowWidget key="cash-flow" cashFlow={data.cashFlow} loading={loading} />
    ),
    "vat-obligation": (
      <VATWidget key="vat-obligation" vat={data.vat} loading={loading} vatPeriod={activeCompany?.vat_period} />
    ),
    "account-balances": (
      <AccountBalancesWidget key="account-balances" accounts={data.accounts} loading={loading} />
    ),
    "upcoming-deadlines": (
      <UpcomingDeadlinesWidget key="upcoming-deadlines" deadlines={data.deadlines} loading={loading} />
    ),
    "unpaid-invoices": (
      <UnpaidInvoicesWidget key="unpaid-invoices" unpaid={data.unpaid} loading={loading} />
    ),
    "recent-activity": (
      <RecentActivityWidget key="recent-activity" activity={data.activity} loading={loading} />
    ),
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Prehlad firmy {activeCompany.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Obnovit
          </Button>
          <Link href="/dashboard/widgets">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Widgety
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/invoices/new">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nová faktúra
          </Button>
        </Link>
        <Link href="/contacts/new">
          <Button variant="outline" className="gap-2">
            <Users className="h-4 w-4" />
            Nový kontakt
          </Button>
        </Link>
        <Link href="/bank/transactions">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            Bankové transakcie
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sortedWidgets
          .filter((w) => isWidgetVisible(w.id))
          .map((w) => widgetMap[w.id] || null)}
      </div>
    </div>
  )
}
