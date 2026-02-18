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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import type { FinancialIndicator } from "@/lib/reports/financial-reports"

const interpretationColors: Record<string, string> = {
  dobry: "bg-green-100 text-green-800",
  priemerny: "bg-yellow-100 text-yellow-800",
  zly: "bg-red-100 text-red-800",
  neutralny: "bg-gray-100 text-gray-600",
}

const categoryIcons: Record<string, string> = {
  Likvidita: "Likvidita",
  Zadlzenost: "Zadlzenost",
  Rentabilita: "Rentabilita",
  Aktivita: "Aktivita (doba obratu)",
}

export default function FinancialIndicatorsPage() {
  const { activeCompanyId, isLoading: companyLoading } = useCompany()
  const [indicators, setIndicators] = useState<FinancialIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  const fetchIndicators = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    const params = new URLSearchParams({
      company_id: activeCompanyId,
      year,
    })
    const res = await fetch(`/api/reports/financial-indicators?${params}`)
    if (res.ok) {
      const json = await res.json()
      setIndicators(json.indicators || [])
    }

    setLoading(false)
  }, [activeCompanyId, year])

  useEffect(() => {
    if (!companyLoading && activeCompanyId) {
      fetchIndicators()
    }
  }, [companyLoading, activeCompanyId, fetchIndicators])

  const formatValue = (ind: FinancialIndicator) => {
    if (ind.value === null) return "N/A"
    if (ind.unit === "%") return `${ind.value.toLocaleString("sk-SK")} %`
    if (ind.unit === "dni") return `${ind.value.toLocaleString("sk-SK")} dni`
    return ind.value.toLocaleString("sk-SK")
  }

  // Group by category
  const categories = Array.from(
    new Set(indicators.map((i) => i.category))
  )

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
          Financne ukazovatele
        </h1>
        <p className="text-muted-foreground">
          Klucove financne metriky a ich hodnotenie
        </p>
      </div>

      {/* Year selector */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <Label>Rok</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchIndicators} disabled={loading}>
          {loading ? "Nacitavam..." : "Zobrazit"}
        </Button>
      </div>

      {categories.map((category) => {
        const catIndicators = indicators.filter((i) => i.category === category)

        return (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {categoryIcons[category] || category}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {catIndicators.map((ind) => (
                <Card key={ind.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium">
                        {ind.name}
                      </CardTitle>
                      <Badge
                        className={interpretationColors[ind.interpretation]}
                        variant="outline"
                      >
                        {ind.interpretation_label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {formatValue(ind)}
                    </div>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground mb-1">
                      {ind.benchmark_text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ind.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}

      {indicators.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              Ziadne data pre zvoleny rok. Najprv vystavte alebo prijmite faktury.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
