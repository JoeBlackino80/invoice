"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Download,
  MapPin,
  Users,
  TrendingUp,
  Plane,
  Home,
  BarChart3,
} from "lucide-react"

// ---- Typy ----

interface ReportSummary {
  total_orders: number
  settled_orders: number
  total_expenses: number
  average_expenses: number
  domestic_count: number
  foreign_count: number
  domestic_expenses: number
  foreign_expenses: number
}

interface CategoryBreakdown {
  meal_allowance: number
  transport: number
  accommodation: number
  other: number
}

interface EmployeeRow {
  employee_id: string
  employee_name: string
  travel_count: number
  total_expenses: number
}

interface DestinationRow {
  destination: string
  travel_count: number
  total_expenses: number
}

interface MonthlyRow {
  month: string
  travel_count: number
  total_expenses: number
}

interface ReportData {
  summary: ReportSummary
  by_category: CategoryBreakdown
  by_employee: EmployeeRow[]
  by_destination: DestinationRow[]
  monthly_summary: MonthlyRow[]
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function getMonthName(monthKey: string): string {
  const monthNames: Record<string, string> = {
    "01": "Januar",
    "02": "Februar",
    "03": "Marec",
    "04": "April",
    "05": "Maj",
    "06": "Jun",
    "07": "Jul",
    "08": "August",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "December",
  }
  const parts = monthKey.split("-")
  if (parts.length === 2) {
    return `${monthNames[parts[1]] || parts[1]} ${parts[0]}`
  }
  return monthKey
}

// ---- Hlavna stranka ----

export default function TravelReportsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)

  // Filtre
  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)
  const [employeeFilter, setEmployeeFilter] = useState("")

  // Nacitanie dat
  const fetchReport = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        date_from: dateFrom,
        date_to: dateTo,
      })

      if (employeeFilter) {
        params.set("employee_id", employeeFilter)
      }

      const res = await fetch(`/api/travel-orders/reports?${params}`)
      const json = await res.json()

      if (res.ok) {
        setData(json)
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa nacitat report",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat report",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, dateFrom, dateTo, employeeFilter, toast])

  useEffect(() => {
    if (activeCompanyId) {
      fetchReport()
    }
  }, [activeCompanyId, fetchReport])

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (!data) return

    const lines: string[] = []

    // Suhrn
    lines.push("SUHRN CESTOVNYCH PRIKAZOV")
    lines.push(`Obdobie;${dateFrom};${dateTo}`)
    lines.push("")
    lines.push(`Celkovy pocet CP;${data.summary.total_orders}`)
    lines.push(`Vyuctovanych;${data.summary.settled_orders}`)
    lines.push(`Celkove naklady;${data.summary.total_expenses}`)
    lines.push(`Priemerne naklady;${data.summary.average_expenses}`)
    lines.push(`Tuzemske;${data.summary.domestic_count};${data.summary.domestic_expenses}`)
    lines.push(`Zahranicne;${data.summary.foreign_count};${data.summary.foreign_expenses}`)
    lines.push("")

    // Kategorie
    lines.push("NAKLADY PODLA KATEGORII")
    lines.push(`Stravne;${data.by_category.meal_allowance}`)
    lines.push(`Cestovne;${data.by_category.transport}`)
    lines.push(`Ubytovanie;${data.by_category.accommodation}`)
    lines.push(`Ostatne;${data.by_category.other}`)
    lines.push("")

    // Zamestnanci
    lines.push("NAKLADY PODLA ZAMESTNANCOV")
    lines.push("Zamestnanec;Pocet CP;Celkove naklady")
    for (const emp of data.by_employee) {
      lines.push(`${emp.employee_name};${emp.travel_count};${emp.total_expenses}`)
    }
    lines.push("")

    // Destinacie
    lines.push("NAKLADY PODLA DESTINACII")
    lines.push("Destinacia;Pocet CP;Celkove naklady")
    for (const dest of data.by_destination) {
      lines.push(`${dest.destination};${dest.travel_count};${dest.total_expenses}`)
    }
    lines.push("")

    // Mesacny prehlad
    lines.push("MESACNY PREHLAD")
    lines.push("Mesiac;Pocet CP;Celkove naklady")
    for (const m of data.monthly_summary) {
      lines.push(`${m.month};${m.travel_count};${m.total_expenses}`)
    }

    const csv = lines.join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `cestovne-prikazy-report-${dateFrom}-${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [data, dateFrom, dateTo])

  // Vypocet percentualneho podielu kategorii
  const categoryTotal = data
    ? data.by_category.meal_allowance +
      data.by_category.transport +
      data.by_category.accommodation +
      data.by_category.other
    : 0

  const categoryPercent = (value: number) =>
    categoryTotal > 0 ? Math.round((value / categoryTotal) * 100) : 0

  return (
    <div>
      {/* Hlavicka */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporty cestovnych prikazov
          </h1>
          <p className="text-muted-foreground">
            Prehlad nakladov a statistik sluzobnych ciest
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={!data || loading}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filtre */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Datum od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div>
              <Label>Datum do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div>
              <Label>ID zamestnanca (volitelne)</Label>
              <Input
                type="text"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                placeholder="UUID zamestnanca"
                className="w-[280px]"
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              Zobrazit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Data */}
      {!loading && data && (
        <>
          {/* Suhrne karty */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pocet CP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.summary.total_orders}</p>
                <p className="text-xs text-muted-foreground">
                  z toho vyuctovanych: {data.summary.settled_orders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Celkove naklady
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {formatMoney(data.summary.total_expenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Priemerne naklady
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {formatMoney(data.summary.average_expenses)}
                </p>
                <p className="text-xs text-muted-foreground">na jednu cestu</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Home className="h-4 w-4" /> Tuzemske / <Plane className="h-4 w-4" /> Zahranicne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">
                  {data.summary.domestic_count} / {data.summary.foreign_count}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(data.summary.domestic_expenses)} /{" "}
                  {formatMoney(data.summary.foreign_expenses)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Naklady podla kategorii */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Naklady podla kategorii
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Stravne */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Stravne</span>
                    <span className="font-mono">
                      {formatMoney(data.by_category.meal_allowance)} (
                      {categoryPercent(data.by_category.meal_allowance)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${categoryPercent(data.by_category.meal_allowance)}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Cestovne */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Cestovne</span>
                    <span className="font-mono">
                      {formatMoney(data.by_category.transport)} (
                      {categoryPercent(data.by_category.transport)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${categoryPercent(data.by_category.transport)}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Ubytovanie */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Ubytovanie</span>
                    <span className="font-mono">
                      {formatMoney(data.by_category.accommodation)} (
                      {categoryPercent(data.by_category.accommodation)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-orange-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${categoryPercent(data.by_category.accommodation)}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Ostatne */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Ostatne</span>
                    <span className="font-mono">
                      {formatMoney(data.by_category.other)} (
                      {categoryPercent(data.by_category.other)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${categoryPercent(data.by_category.other)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between font-medium">
                <span>Celkove naklady</span>
                <span className="font-mono">{formatMoney(categoryTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top destinacie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Top destinacie
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-4 text-left font-medium">Destinacia</th>
                        <th className="h-10 px-4 text-center font-medium">Pocet</th>
                        <th className="h-10 px-4 text-right font-medium">Naklady</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_destination.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            Ziadne data
                          </td>
                        </tr>
                      ) : (
                        data.by_destination.slice(0, 10).map((dest) => (
                          <tr
                            key={dest.destination}
                            className="border-b hover:bg-muted/30"
                          >
                            <td className="px-4 py-2 font-medium">
                              {dest.destination}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {dest.travel_count}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(dest.total_expenses)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Podla zamestnancov */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Naklady podla zamestnancov
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-4 text-left font-medium">
                          Zamestnanec
                        </th>
                        <th className="h-10 px-4 text-center font-medium">Pocet</th>
                        <th className="h-10 px-4 text-right font-medium">Naklady</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_employee.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            Ziadne data
                          </td>
                        </tr>
                      ) : (
                        data.by_employee.map((emp) => (
                          <tr
                            key={emp.employee_id}
                            className="border-b hover:bg-muted/30"
                          >
                            <td className="px-4 py-2 font-medium">
                              {emp.employee_name}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {emp.travel_count}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(emp.total_expenses)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mesacny prehlad */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Mesacny prehlad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthly_summary.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Ziadne data pre zvolene obdobie
                </p>
              ) : (
                <>
                  {/* Jednoduchy bar chart cez CSS */}
                  <div className="space-y-3 mb-6">
                    {data.monthly_summary.map((m) => {
                      const maxExpenses = Math.max(
                        ...data.monthly_summary.map((s) => s.total_expenses)
                      )
                      const widthPct =
                        maxExpenses > 0
                          ? Math.round(
                              (m.total_expenses / maxExpenses) * 100
                            )
                          : 0

                      return (
                        <div key={m.month} className="flex items-center gap-3">
                          <span className="text-sm w-32 text-right text-muted-foreground">
                            {getMonthName(m.month)}
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-6 relative">
                            <div
                              className="bg-primary h-6 rounded-full transition-all flex items-center justify-end pr-2"
                              style={{
                                width: `${Math.max(widthPct, 2)}%`,
                              }}
                            >
                              {widthPct > 20 && (
                                <span className="text-xs text-primary-foreground font-mono">
                                  {formatMoney(m.total_expenses)}
                                </span>
                              )}
                            </div>
                          </div>
                          {widthPct <= 20 && (
                            <span className="text-xs font-mono text-muted-foreground w-24 text-right">
                              {formatMoney(m.total_expenses)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {m.travel_count}x
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tabulka */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium">Mesiac</th>
                          <th className="h-10 px-4 text-center font-medium">
                            Pocet CP
                          </th>
                          <th className="h-10 px-4 text-right font-medium">
                            Celkove naklady
                          </th>
                          <th className="h-10 px-4 text-right font-medium">
                            Priemer na CP
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.monthly_summary.map((m) => (
                          <tr key={m.month} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">
                              {getMonthName(m.month)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {m.travel_count}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(m.total_expenses)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                              {m.travel_count > 0
                                ? formatMoney(m.total_expenses / m.travel_count)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/30 font-medium">
                          <td className="px-4 py-2">Spolu</td>
                          <td className="px-4 py-2 text-center">
                            {data.monthly_summary.reduce(
                              (s, m) => s + m.travel_count,
                              0
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {formatMoney(
                              data.monthly_summary.reduce(
                                (s, m) => s + m.total_expenses,
                                0
                              )
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                            {data.summary.average_expenses > 0
                              ? formatMoney(data.summary.average_expenses)
                              : "-"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Prazdny stav */}
      {!loading && !data && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">Ziadne data</p>
              <p className="text-sm">
                Nastavte filtre a kliknite na &quot;Zobrazit&quot; pre
                generovanie reportu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
