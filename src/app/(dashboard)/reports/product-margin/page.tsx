"use client"

import { useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Download,
  Loader2,
  TrendingUp,
  ArrowUpDown,
  BarChart3,
} from "lucide-react"
import { generateCSV } from "@/lib/reports/export-generator"

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface ProductMargin {
  product_id: string
  product_name: string
  revenue: number
  cost: number
  margin_eur: number
  margin_pct: number
  quantity_sold: number
}

type SortField = "margin_pct" | "revenue" | "margin_eur" | "quantity_sold"
type SortDirection = "asc" | "desc"

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPct(value: number): string {
  return `${value.toFixed(1)} %`
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export default function ProductMarginPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<ProductMargin[]>([])
  const [sortField, setSortField] = useState<SortField>("margin_pct")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")

  // -----------------------------------------------------------------------
  // Fetch data
  // -----------------------------------------------------------------------

  const fetchMarginData = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      // Fetch issued invoices with items
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        type: "vydana",
        limit: "1000",
      })
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const invRes = await fetch(`/api/invoices?${params}`)
      if (!invRes.ok) throw new Error("Nepodarilo sa nacitat faktury")
      const invJson = await invRes.json()
      const invoiceIds = (invJson.data || [])
        .filter((inv: any) => inv.status !== "cancelled")
        .map((inv: any) => inv.id)

      if (invoiceIds.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }

      // For each invoice, fetch items (we batch via individual calls if needed)
      // Simplified: fetch all invoice_items matching company's invoices
      const productMap = new Map<
        string,
        {
          name: string
          revenue: number
          cost: number
          quantity: number
        }
      >()

      // Fetch items for all invoices by fetching each invoice detail
      for (const invoiceId of invoiceIds) {
        const detailRes = await fetch(
          `/api/invoices/${invoiceId}?company_id=${activeCompanyId}`
        )
        if (!detailRes.ok) continue
        const detail = await detailRes.json()
        const items = detail.items || []

        for (const item of items) {
          const productKey = item.product_id || item.description || "Ostatne"
          const productName =
            item.product?.name || item.description || "Bez nazvu"
          const lineRevenue =
            (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
          const lineCost =
            (Number(item.quantity) || 0) *
            (Number(item.product?.cost_price) || 0)

          const existing = productMap.get(productKey)
          if (existing) {
            existing.revenue += lineRevenue
            existing.cost += lineCost
            existing.quantity += Number(item.quantity) || 0
          } else {
            productMap.set(productKey, {
              name: productName,
              revenue: lineRevenue,
              cost: lineCost,
              quantity: Number(item.quantity) || 0,
            })
          }
        }
      }

      const result: ProductMargin[] = Array.from(productMap.entries()).map(
        ([id, data]) => {
          const marginEur = data.revenue - data.cost
          const marginPct =
            data.revenue > 0 ? (marginEur / data.revenue) * 100 : 0
          return {
            product_id: id,
            product_name: data.name,
            revenue: data.revenue,
            cost: data.cost,
            margin_eur: marginEur,
            margin_pct: marginPct,
            quantity_sold: data.quantity,
          }
        }
      )

      setProducts(result)
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, dateFrom, dateTo, toast])

  // -----------------------------------------------------------------------
  // Sort
  // -----------------------------------------------------------------------

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case "margin_pct":
        cmp = a.margin_pct - b.margin_pct
        break
      case "revenue":
        cmp = a.revenue - b.revenue
        break
      case "margin_eur":
        cmp = a.margin_eur - b.margin_eur
        break
      case "quantity_sold":
        cmp = a.quantity_sold - b.quantity_sold
        break
    }
    return sortDir === "desc" ? -cmp : cmp
  })

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
  const totalCost = products.reduce((s, p) => s + p.cost, 0)
  const totalMargin = totalRevenue - totalCost
  const avgMarginPct =
    totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  // Top 10 by margin
  const top10 = [...products]
    .sort((a, b) => b.margin_eur - a.margin_eur)
    .slice(0, 10)
  const maxMarginValue = top10.length > 0 ? top10[0].margin_eur : 0

  // -----------------------------------------------------------------------
  // CSV export
  // -----------------------------------------------------------------------

  const exportCSV = () => {
    const headers = [
      "Produkt/Sluzba",
      "Trzby (EUR)",
      "Naklady (EUR)",
      "Marza (EUR)",
      "Marza (%)",
      "Pocet predanych",
    ]
    const rows = sortedProducts.map((p) => [
      p.product_name,
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.margin_eur.toFixed(2),
      p.margin_pct.toFixed(1),
      String(p.quantity_sold),
    ])
    const csv = generateCSV(headers, rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `marza_produktov_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!activeCompanyId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Najprv vyberte firmu.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marza produktov</h1>
          <p className="text-muted-foreground">
            Analyza marze podla produktov a sluzieb
          </p>
        </div>
        {products.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Date filter and generate */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Datum od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Datum do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchMarginData} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-2" />
                )}
                Generovat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {products.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Celkove trzby</p>
                <p className="text-xl font-bold">{formatEur(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Celkove naklady
                </p>
                <p className="text-xl font-bold">{formatEur(totalCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Celkova marza</p>
                <p
                  className={`text-xl font-bold ${totalMargin >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatEur(totalMargin)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Priemerna marza %
                </p>
                <p
                  className={`text-xl font-bold ${avgMarginPct >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatPct(avgMarginPct)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 bar chart */}
          {top10.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top 10 najziskovejsich produktov
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {top10.map((p, i) => {
                    const barWidth =
                      maxMarginValue > 0
                        ? Math.max(
                            (Math.abs(p.margin_eur) / maxMarginValue) * 100,
                            2
                          )
                        : 0
                    return (
                      <div key={p.product_id} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-6 text-right">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">
                              {p.product_name}
                            </span>
                            <span className="text-sm font-semibold ml-2 whitespace-nowrap">
                              {formatEur(p.margin_eur)} ({formatPct(p.margin_pct)})
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${p.margin_eur >= 0 ? "bg-green-500" : "bg-red-500"}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailna tabulka</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt / Sluzba</TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                        onClick={() => toggleSort("revenue")}
                      >
                        Trzby
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Naklady</TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                        onClick={() => toggleSort("margin_eur")}
                      >
                        Marza (EUR)
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                        onClick={() => toggleSort("margin_pct")}
                      >
                        Marza (%)
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 hover:text-foreground ml-auto"
                        onClick={() => toggleSort("quantity_sold")}
                      >
                        Pocet predanych
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((p, idx) => {
                    const isTop10 =
                      top10.findIndex(
                        (t) => t.product_id === p.product_id
                      ) !== -1
                    return (
                      <TableRow
                        key={p.product_id}
                        className={isTop10 ? "bg-green-50/50 dark:bg-green-950/10" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {p.product_name}
                            </span>
                            {isTop10 && (
                              <Badge variant="outline" className="text-xs">
                                Top 10
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatEur(p.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatEur(p.cost)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${p.margin_eur >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatEur(p.margin_eur)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${p.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatPct(p.margin_pct)}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.quantity_sold}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!loading && products.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              Vyberte casove obdobie a kliknite na &quot;Generovat&quot; pre zobrazenie analyzy marze.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
