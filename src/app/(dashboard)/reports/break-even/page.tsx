"use client"

import { useCompany } from "@/hooks/use-company"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Target, Calculator } from "lucide-react"
import type { BreakEvenResult } from "@/lib/reports/financial-reports"

export default function BreakEvenPage() {
  const { isLoading: companyLoading } = useCompany()
  const [fixedCosts, setFixedCosts] = useState("")
  const [variableCost, setVariableCost] = useState("")
  const [price, setPrice] = useState("")
  const [currentUnits, setCurrentUnits] = useState("")
  const [result, setResult] = useState<BreakEvenResult | null>(null)

  const calculate = async () => {
    const fc = parseFloat(fixedCosts)
    const vc = parseFloat(variableCost)
    const p = parseFloat(price)
    const cu = parseFloat(currentUnits) || 0

    if (isNaN(fc) || isNaN(vc) || isNaN(p) || p <= 0) return

    const { calculateBreakEven } = await import(
      "@/lib/reports/financial-reports"
    )
    const r = calculateBreakEven(fc, vc, p, cu)
    setResult(r)
  }

  const formatEur = (v: number) =>
    v.toLocaleString("sk-SK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " EUR"

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
          Break-even analyza
        </h1>
        <p className="text-muted-foreground">
          Vypocet bodu zvratu - pri akom objeme sa trzby vyrovnaju nakladom
        </p>
      </div>

      {/* Input form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Vstupne parametre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Fixne naklady / mesiac (EUR)</Label>
              <Input
                type="number"
                placeholder="napr. 5000"
                value={fixedCosts}
                onChange={(e) => setFixedCosts(e.target.value)}
                min="0"
                step="100"
              />
            </div>
            <div>
              <Label>Variabilne naklady / jednotka (EUR)</Label>
              <Input
                type="number"
                placeholder="napr. 15"
                value={variableCost}
                onChange={(e) => setVariableCost(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label>Cena / jednotka (EUR)</Label>
              <Input
                type="number"
                placeholder="napr. 50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div>
              <Label>Aktualny pocet jednotiek (volitelne)</Label>
              <Input
                type="number"
                placeholder="napr. 200"
                value={currentUnits}
                onChange={(e) => setCurrentUnits(e.target.value)}
                min="0"
                step="1"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={calculate}>
              <Target className="h-4 w-4 mr-2" />
              Vypocitat
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Results cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Bod zvratu (ks)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {result.break_even_units.toLocaleString("sk-SK")} ks
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimalny pocet jednotiek
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Bod zvratu (EUR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatEur(result.break_even_revenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimalne trzby
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Prispevkova marza
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatEur(result.contribution_margin)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {result.contribution_margin_ratio.toFixed(1)} % z ceny
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Bezpecnostna marza
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    result.margin_of_safety >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatEur(result.margin_of_safety)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {result.margin_of_safety_pct.toFixed(1)} % nad bodom zvratu
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CSS chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Graficke znazornenie bodu zvratu
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.chart_data.length > 0 && (() => {
                const maxY = Math.max(
                  ...result.chart_data.map((d) =>
                    Math.max(d.revenue, d.total_costs)
                  ),
                  1
                )
                const chartHeight = 250

                return (
                  <div className="relative" style={{ height: chartHeight + 40 }}>
                    {/* Y axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-20 flex flex-col justify-between text-xs text-muted-foreground">
                      <span>{formatEur(maxY)}</span>
                      <span>{formatEur(maxY / 2)}</span>
                      <span>0 EUR</span>
                    </div>

                    {/* Chart area */}
                    <div className="ml-24 relative" style={{ height: chartHeight }}>
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between">
                        <div className="border-b border-dashed border-muted-foreground/20" />
                        <div className="border-b border-dashed border-muted-foreground/20" />
                        <div className="border-b border-muted-foreground/30" />
                      </div>

                      {/* Data points connected with lines */}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox={`0 0 ${result.chart_data.length * 60} ${chartHeight}`}
                        preserveAspectRatio="none"
                      >
                        {/* Revenue line (green) */}
                        <polyline
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2"
                          points={result.chart_data
                            .map(
                              (d, i) =>
                                `${i * 60 + 30},${chartHeight - (d.revenue / maxY) * chartHeight}`
                            )
                            .join(" ")}
                        />
                        {/* Total costs line (red) */}
                        <polyline
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          points={result.chart_data
                            .map(
                              (d, i) =>
                                `${i * 60 + 30},${chartHeight - (d.total_costs / maxY) * chartHeight}`
                            )
                            .join(" ")}
                        />
                        {/* Fixed costs line (orange dashed) */}
                        <polyline
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="1.5"
                          strokeDasharray="5,5"
                          points={result.chart_data
                            .map(
                              (d, i) =>
                                `${i * 60 + 30},${chartHeight - (d.fixed_costs / maxY) * chartHeight}`
                            )
                            .join(" ")}
                        />
                      </svg>

                      {/* X axis labels */}
                      <div
                        className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground"
                        style={{ transform: "translateY(20px)" }}
                      >
                        {result.chart_data
                          .filter((_, i) => i % 2 === 0)
                          .map((d) => (
                            <span key={d.units}>{d.units} ks</span>
                          ))}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="ml-24 flex gap-6 mt-8 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 bg-green-500" />
                        <span>Trzby</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 bg-red-500" />
                        <span>Celkove naklady</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 bg-orange-500 border-dashed" />
                        <span>Fixne naklady</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <Separator className="my-4" />

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixne naklady:</span>
                  <span className="font-medium">{formatEur(result.fixed_costs)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variabilne naklady/ks:</span>
                  <span className="font-medium">
                    {formatEur(result.variable_cost_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cena/ks:</span>
                  <span className="font-medium">
                    {formatEur(result.price_per_unit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
