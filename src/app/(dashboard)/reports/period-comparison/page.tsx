"use client"

import { useCompany } from "@/hooks/use-company"
import { useEffect, useState, useCallback } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import type { PeriodComparison } from "@/lib/reports/financial-reports"

function getPresetDates(preset: string) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case "month": {
      // Current month vs previous month
      const p2From = new Date(y, m, 1)
      const p2To = new Date(y, m + 1, 0)
      const p1From = new Date(y, m - 1, 1)
      const p1To = new Date(y, m, 0)
      return {
        period1_from: p1From.toISOString().slice(0, 10),
        period1_to: p1To.toISOString().slice(0, 10),
        period2_from: p2From.toISOString().slice(0, 10),
        period2_to: p2To.toISOString().slice(0, 10),
      }
    }
    case "quarter": {
      const currentQ = Math.floor(m / 3)
      const p2From = new Date(y, currentQ * 3, 1)
      const p2To = new Date(y, currentQ * 3 + 3, 0)
      const p1From = new Date(y, (currentQ - 1) * 3, 1)
      const p1To = new Date(y, currentQ * 3, 0)
      return {
        period1_from: p1From.toISOString().slice(0, 10),
        period1_to: p1To.toISOString().slice(0, 10),
        period2_from: p2From.toISOString().slice(0, 10),
        period2_to: p2To.toISOString().slice(0, 10),
      }
    }
    case "year": {
      return {
        period1_from: `${y - 1}-01-01`,
        period1_to: `${y - 1}-12-31`,
        period2_from: `${y}-01-01`,
        period2_to: `${y}-12-31`,
      }
    }
    default:
      return null
  }
}

export default function PeriodComparisonPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany()
  const [comparison, setComparison] = useState<PeriodComparison | null>(null)
  const [loading, setLoading] = useState(false)

  const [period1From, setPeriod1From] = useState("")
  const [period1To, setPeriod1To] = useState("")
  const [period2From, setPeriod2From] = useState("")
  const [period2To, setPeriod2To] = useState("")

  useEffect(() => {
    // Set default to month vs month
    const dates = getPresetDates("month")
    if (dates) {
      setPeriod1From(dates.period1_from)
      setPeriod1To(dates.period1_to)
      setPeriod2From(dates.period2_from)
      setPeriod2To(dates.period2_to)
    }
  }, [])

  const applyPreset = (preset: string) => {
    const dates = getPresetDates(preset)
    if (dates) {
      setPeriod1From(dates.period1_from)
      setPeriod1To(dates.period1_to)
      setPeriod2From(dates.period2_from)
      setPeriod2To(dates.period2_to)
    }
  }

  const fetchComparison = useCallback(async () => {
    if (!activeCompanyId || !period1From || !period1To || !period2From || !period2To)
      return
    setLoading(true)

    const params = new URLSearchParams({
      company_id: activeCompanyId,
      period1_from: period1From,
      period1_to: period1To,
      period2_from: period2From,
      period2_to: period2To,
    })
    const res = await fetch(`/api/reports/period-comparison?${params}`)
    if (res.ok) {
      const json = await res.json()
      setComparison(json)
    }
    setLoading(false)
  }, [activeCompanyId, period1From, period1To, period2From, period2To])

  useEffect(() => {
    if (!companyLoading && activeCompanyId && period1From) {
      fetchComparison()
    }
  }, [companyLoading, activeCompanyId, fetchComparison, period1From])

  const formatEur = (v: number) =>
    v.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR"

  // For the metric "Pocet faktur" we don't want EUR format
  const formatMetricValue = (metric: string, value: number) => {
    if (metric === "Pocet faktur") return value.toString()
    return formatEur(value)
  }

  const getChangeColor = (metric: string, changePct: number | null) => {
    if (changePct === null || changePct === 0) return ""
    // For revenue and profit, positive is good
    // For expenses, positive is bad
    if (metric === "Naklady") {
      return changePct > 0 ? "text-red-600" : "text-green-600"
    }
    return changePct > 0 ? "text-green-600" : "text-red-600"
  }

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
          Porovnanie obdobi
        </h1>
        <p className="text-muted-foreground">
          Porovnanie financnych metrik medzi dvoma obdobiami
        </p>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => applyPreset("month")}>
          Mesiac vs mesiac
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("quarter")}>
          Kvartal vs kvartal
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("year")}>
          Rok vs rok
        </Button>
      </div>

      {/* Period selectors */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Obdobie 1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">Od</Label>
                <Input
                  type="date"
                  value={period1From}
                  onChange={(e) => setPeriod1From(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Do</Label>
                <Input
                  type="date"
                  value={period1To}
                  onChange={(e) => setPeriod1To(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Obdobie 2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">Od</Label>
                <Input
                  type="date"
                  value={period2From}
                  onChange={(e) => setPeriod2From(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Do</Label>
                <Input
                  type="date"
                  value={period2To}
                  onChange={(e) => setPeriod2To(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <Button onClick={fetchComparison} disabled={loading}>
          {loading ? "Nacitavam..." : "Porovnat"}
        </Button>
      </div>

      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Vysledky porovnania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metrika</TableHead>
                  <TableHead className="text-right">
                    Obdobie 1
                    <div className="text-xs font-normal text-muted-foreground">
                      {comparison.period1.from} - {comparison.period1.to}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    Obdobie 2
                    <div className="text-xs font-normal text-muted-foreground">
                      {comparison.period2.from} - {comparison.period2.to}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Rozdiel</TableHead>
                  <TableHead className="text-right">Zmena %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.metrics.map((m) => (
                  <TableRow key={m.metric}>
                    <TableCell className="font-medium">{m.metric}</TableCell>
                    <TableCell className="text-right">
                      {formatMetricValue(m.metric, m.period1_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMetricValue(m.metric, m.period2_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={getChangeColor(m.metric, m.change_pct)}>
                        {m.difference > 0 ? "+" : ""}
                        {m.metric === "Pocet faktur"
                          ? m.difference
                          : formatEur(m.difference)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.change_pct !== null ? (
                        <span
                          className={`flex items-center justify-end gap-1 ${getChangeColor(
                            m.metric,
                            m.change_pct
                          )}`}
                        >
                          {m.change_pct > 0 ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : m.change_pct < 0 ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {Math.abs(m.change_pct).toFixed(1)} %
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
