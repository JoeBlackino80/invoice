"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Filter,
  CheckCircle2,
  XCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface TrialBalanceRow {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
  typ: string
  pociatocny_zostatok_md: number
  pociatocny_zostatok_d: number
  obraty_md: number
  obraty_d: number
  konecny_zostatok_md: number
  konecny_zostatok_d: number
}

interface TrialBalanceSummary {
  pociatocny_zostatok_md: number
  pociatocny_zostatok_d: number
  obraty_md: number
  obraty_d: number
  konecny_zostatok_md: number
  konecny_zostatok_d: number
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

const periodOptions = [
  { value: "monthly", label: "Mesačne" },
  { value: "quarterly", label: "Štvrťročne" },
  { value: "yearly", label: "Ročne" },
]

const accountClasses: Record<string, string> = {
  "0": "Dlhodobý majetok",
  "1": "Zásoby",
  "2": "Finančné účty",
  "3": "Zúčtovacie vzťahy",
  "4": "Kapitálové účty a dlhodobé záväzky",
  "5": "Náklady",
  "6": "Výnosy",
  "7": "Závierkové a podsúvahové účty",
}

export default function TrialBalancePage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [data, setData] = useState<TrialBalanceRow[]>([])
  const [summary, setSummary] = useState<TrialBalanceSummary | null>(null)
  const [isBalanced, setIsBalanced] = useState(true)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("yearly")
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set())

  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    switch (newPeriod) {
      case "monthly": {
        const monthStr = String(month + 1).padStart(2, "0")
        const lastDay = new Date(year, month + 1, 0).getDate()
        setDateFrom(`${year}-${monthStr}-01`)
        setDateTo(`${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`)
        break
      }
      case "quarterly": {
        const quarter = Math.floor(month / 3)
        const quarterStartMonth = quarter * 3
        const quarterEndMonth = quarterStartMonth + 2
        const startMonthStr = String(quarterStartMonth + 1).padStart(2, "0")
        const endMonthStr = String(quarterEndMonth + 1).padStart(2, "0")
        const lastDayOfQuarter = new Date(year, quarterEndMonth + 1, 0).getDate()
        setDateFrom(`${year}-${startMonthStr}-01`)
        setDateTo(`${year}-${endMonthStr}-${String(lastDayOfQuarter).padStart(2, "0")}`)
        break
      }
      case "yearly":
        setDateFrom(`${year}-01-01`)
        setDateTo(`${year}-12-31`)
        break
    }
  }

  const fetchTrialBalance = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        date_from: dateFrom,
        date_to: dateTo,
      })

      const res = await fetch(`/api/trial-balance?${params}`)
      const json = await res.json()

      if (res.ok) {
        setData(json.data || [])
        setSummary(json.summary || null)
        setIsBalanced(json.is_balanced ?? true)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa načítať obratovú predvahu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať obratovú predvahu" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, dateFrom, dateTo, toast])

  useEffect(() => {
    fetchTrialBalance()
  }, [fetchTrialBalance])

  // Group data by account class (first digit)
  const groupedData: Record<string, TrialBalanceRow[]> = {}
  for (const row of data) {
    const classKey = row.synteticky_ucet.charAt(0)
    if (!groupedData[classKey]) {
      groupedData[classKey] = []
    }
    groupedData[classKey].push(row)
  }

  const toggleClass = (classKey: string) => {
    setCollapsedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(classKey)) {
        next.delete(classKey)
      } else {
        next.add(classKey)
      }
      return next
    })
  }

  const calculateClassSubtotals = (rows: TrialBalanceRow[]) => {
    return rows.reduce(
      (acc, row) => ({
        pociatocny_zostatok_md: acc.pociatocny_zostatok_md + row.pociatocny_zostatok_md,
        pociatocny_zostatok_d: acc.pociatocny_zostatok_d + row.pociatocny_zostatok_d,
        obraty_md: acc.obraty_md + row.obraty_md,
        obraty_d: acc.obraty_d + row.obraty_d,
        konecny_zostatok_md: acc.konecny_zostatok_md + row.konecny_zostatok_md,
        konecny_zostatok_d: acc.konecny_zostatok_d + row.konecny_zostatok_d,
      }),
      {
        pociatocny_zostatok_md: 0,
        pociatocny_zostatok_d: 0,
        obraty_md: 0,
        obraty_d: 0,
        konecny_zostatok_md: 0,
        konecny_zostatok_d: 0,
      }
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Obratová predvaha</h1>
          <p className="text-muted-foreground">Prehľad obratov a zostatkov všetkých účtov</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2">
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                Vyvážená
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-destructive">
                <XCircle className="h-5 w-5" />
                Nevyvážená
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Obdobie</label>
              <div className="flex gap-1">
                {periodOptions.map((p) => (
                  <Button
                    key={p.value}
                    variant={period === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Od</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Do</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchTrialBalance} variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrovať
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium" rowSpan={2}>Účet</th>
                  <th className="h-10 px-4 text-left font-medium" rowSpan={2}>Názov</th>
                  <th className="h-10 px-2 text-center font-medium border-l" colSpan={2}>Počiatočný zostatok</th>
                  <th className="h-10 px-2 text-center font-medium border-l" colSpan={2}>Obraty</th>
                  <th className="h-10 px-2 text-center font-medium border-l" colSpan={2}>Konečný zostatok</th>
                </tr>
                <tr className="border-b bg-muted/50">
                  <th className="h-8 px-2 text-right font-medium text-xs border-l">MD</th>
                  <th className="h-8 px-2 text-right font-medium text-xs">D</th>
                  <th className="h-8 px-2 text-right font-medium text-xs border-l">MD</th>
                  <th className="h-8 px-2 text-right font-medium text-xs">D</th>
                  <th className="h-8 px-2 text-right font-medium text-xs border-l">MD</th>
                  <th className="h-8 px-2 text-right font-medium text-xs">D</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      Načítavam...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Žiadne údaje v zvolenom období.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.keys(groupedData).sort().map((classKey) => {
                    const classRows = groupedData[classKey]
                    const isCollapsed = collapsedClasses.has(classKey)
                    const subtotals = calculateClassSubtotals(classRows)
                    const className = accountClasses[classKey] || `Trieda ${classKey}`

                    return (
                      <tbody key={classKey}>
                        {/* Class header */}
                        <tr
                          className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleClass(classKey)}
                        >
                          <td className="px-4 py-2 font-medium" colSpan={2}>
                            <span className="inline-flex items-center gap-1">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              Trieda {classKey} - {className}
                              <span className="text-muted-foreground font-normal ml-1">
                                ({classRows.length} účtov)
                              </span>
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs border-l">
                            {formatMoney(subtotals.pociatocny_zostatok_md)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            {formatMoney(subtotals.pociatocny_zostatok_d)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs border-l">
                            {formatMoney(subtotals.obraty_md)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            {formatMoney(subtotals.obraty_d)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs border-l">
                            {formatMoney(subtotals.konecny_zostatok_md)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            {formatMoney(subtotals.konecny_zostatok_d)}
                          </td>
                        </tr>
                        {/* Account rows */}
                        {!isCollapsed &&
                          classRows.map((row) => (
                            <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2 font-mono pl-8">
                                {row.synteticky_ucet}
                                {row.analyticky_ucet ? `.${row.analyticky_ucet}` : ""}
                              </td>
                              <td className="px-4 py-2">{row.nazov}</td>
                              <td className="px-2 py-2 text-right font-mono text-xs border-l">
                                {row.pociatocny_zostatok_md > 0 ? formatMoney(row.pociatocny_zostatok_md) : ""}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-xs">
                                {row.pociatocny_zostatok_d > 0 ? formatMoney(row.pociatocny_zostatok_d) : ""}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-xs border-l">
                                {row.obraty_md > 0 ? formatMoney(row.obraty_md) : ""}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-xs">
                                {row.obraty_d > 0 ? formatMoney(row.obraty_d) : ""}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-xs border-l">
                                {row.konecny_zostatok_md > 0 ? formatMoney(row.konecny_zostatok_md) : ""}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-xs">
                                {row.konecny_zostatok_d > 0 ? formatMoney(row.konecny_zostatok_d) : ""}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    )
                  })
                )}
              </tbody>
              {summary && data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-medium">
                    <td className="px-4 py-3" colSpan={2}>
                      Spolu ({data.length} účtov)
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs border-l">
                      {formatMoney(summary.pociatocny_zostatok_md)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs">
                      {formatMoney(summary.pociatocny_zostatok_d)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs border-l">
                      {formatMoney(summary.obraty_md)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs">
                      {formatMoney(summary.obraty_d)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs border-l">
                      {formatMoney(summary.konecny_zostatok_md)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs">
                      {formatMoney(summary.konecny_zostatok_d)}
                    </td>
                  </tr>
                  {/* Balance check row */}
                  <tr className="bg-muted/30">
                    <td className="px-4 py-2" colSpan={2}>
                      Kontrola
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs border-l" colSpan={2}>
                      <span className={
                        Math.abs(summary.pociatocny_zostatok_md - summary.pociatocny_zostatok_d) < 0.01
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }>
                        Rozdiel: {formatMoney(summary.pociatocny_zostatok_md - summary.pociatocny_zostatok_d)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs border-l" colSpan={2}>
                      <span className={
                        Math.abs(summary.obraty_md - summary.obraty_d) < 0.01
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }>
                        Rozdiel: {formatMoney(summary.obraty_md - summary.obraty_d)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs border-l" colSpan={2}>
                      <span className={
                        Math.abs(summary.konecny_zostatok_md - summary.konecny_zostatok_d) < 0.01
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }>
                        Rozdiel: {formatMoney(summary.konecny_zostatok_md - summary.konecny_zostatok_d)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
