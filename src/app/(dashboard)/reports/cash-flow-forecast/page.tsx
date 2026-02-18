"use client"

import { useCompany } from "@/hooks/use-company"
import { useEffect, useState, useCallback } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { TrendingUp, TrendingDown, Wallet, Info } from "lucide-react"
import type { CashFlowForecast, CashFlowMonth } from "@/lib/reports/financial-reports"

export default function CashFlowForecastPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany()
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [forecastDays, setForecastDays] = useState<string>("30")

  const fetchForecast = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    const params = new URLSearchParams({
      company_id: activeCompanyId,
      forecast_days: forecastDays,
    })
    const res = await fetch(`/api/reports/cash-flow-forecast?${params}`)
    if (res.ok) {
      const json = await res.json()
      setForecast(json)
    }

    setLoading(false)
  }, [activeCompanyId, forecastDays])

  useEffect(() => {
    if (!companyLoading && activeCompanyId) {
      fetchForecast()
    }
  }, [companyLoading, activeCompanyId, fetchForecast])

  const formatEur = (v: number) =>
    v.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR"

  const allMonths: CashFlowMonth[] = forecast
    ? [...forecast.historical, ...forecast.forecast]
    : []

  const maxValue = allMonths.length > 0
    ? Math.max(...allMonths.map((m) => Math.max(m.income, m.expenses)), 1)
    : 1

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Cash flow prognoza
        </h1>
        <p className="text-muted-foreground">
          AI predikovany vyvoj prijmov a vydavkov na zaklade historickych dat
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <Label>Obdobie prognozy</Label>
          <Select value={forecastDays} onValueChange={setForecastDays}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dni</SelectItem>
              <SelectItem value="60">60 dni</SelectItem>
              <SelectItem value="90">90 dni</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchForecast} disabled={loading}>
          {loading ? "Nacitavam..." : "Zobrazit"}
        </Button>
      </div>

      {forecast && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Predpokladane prijmy
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatEur(forecast.summary.projected_income)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Na {forecastDays} dni dopredu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Predpokladane vydavky
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatEur(forecast.summary.projected_expenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Na {forecastDays} dni dopredu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Predpokladany zostatok
                </CardTitle>
                <Wallet className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    forecast.summary.projected_balance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatEur(forecast.summary.projected_balance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Spolahlvost: {forecast.summary.confidence_level} %
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CSS Bar chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Historicke a predpokladane toky
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allMonths.map((m) => (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={m.is_forecast ? "text-muted-foreground italic" : ""}>
                        {m.label} {m.is_forecast ? "(prognoza)" : ""}
                      </span>
                      <span>
                        Zostatok: {formatEur(m.balance)}
                      </span>
                    </div>
                    <div className="flex gap-1 h-5">
                      <div
                        className={`${m.is_forecast ? "bg-green-300 border border-dashed border-green-600" : "bg-green-500"} rounded-sm`}
                        style={{
                          width: `${(m.income / maxValue) * 100}%`,
                          minWidth: m.income > 0 ? "2px" : "0",
                        }}
                        title={`Prijmy: ${formatEur(m.income)}`}
                      />
                      <div
                        className={`${m.is_forecast ? "bg-red-300 border border-dashed border-red-600" : "bg-red-500"} rounded-sm`}
                        style={{
                          width: `${(m.expenses / maxValue) * 100}%`,
                          minWidth: m.expenses > 0 ? "2px" : "0",
                        }}
                        title={`Vydavky: ${formatEur(m.expenses)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-6 mt-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span>Prijmy (skutocne)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-300 border border-dashed border-green-600 rounded-sm" />
                  <span>Prijmy (prognoza)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-sm" />
                  <span>Vydavky (skutocne)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-300 border border-dashed border-red-600 rounded-sm" />
                  <span>Vydavky (prognoza)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Mesacny prehlad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mesiac</TableHead>
                    <TableHead className="text-right">Prijmy</TableHead>
                    <TableHead className="text-right">Vydavky</TableHead>
                    <TableHead className="text-right">Zostatok</TableHead>
                    <TableHead>Typ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMonths.map((m) => (
                    <TableRow key={m.month} className={m.is_forecast ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatEur(m.income)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatEur(m.expenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          m.balance >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatEur(m.balance)}
                      </TableCell>
                      <TableCell>
                        {m.is_forecast ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Prognoza
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50">
                            Skutocnost
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Methodology note */}
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  Metodologia predikcie
                </p>
                <p>
                  {forecast.summary.methodology} Spolahlvost prognozy je
                  {" "}{forecast.summary.confidence_level} % a zalezi od mnozstva historickych
                  dat a zvolenej dlzky prognozy. Prognoza je len orientacna a
                  nenahradzuje detailne financne planovanie.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
