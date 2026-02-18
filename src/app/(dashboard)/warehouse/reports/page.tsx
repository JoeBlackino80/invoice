"use client"

import { useEffect, useState, useCallback } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Download,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Warehouse,
  Package,
  Loader2,
} from "lucide-react"

// Types
interface StockStatusProduct {
  product_id: string
  product_name: string
  sku: string
  current_stock: number
  min_stock: number | null
  max_stock: number | null
  unit_price: number
  status: string
  warehouse_id: string | null
  warehouse_name: string | null
}

interface StockStatusReport {
  products: StockStatusProduct[]
  below_min_count: number
  above_max_count: number
  zero_stock_count: number
  normal_count: number
  total_products: number
}

interface TurnoverProduct {
  product_id: string
  product_name: string
  sku: string
  unit_price: number
  opening_stock: number
  receipts: number
  issues: number
  closing_stock: number
}

interface TurnoverReport {
  products: TurnoverProduct[]
  totals: { opening: number; receipts: number; issues: number; closing: number }
}

interface ABCProduct {
  product_id: string
  product_name: string
  sku: string
  annual_consumption_value: number
  cumulative_percentage: number
  category: "A" | "B" | "C"
}

interface ABCCategory {
  category: string
  products: ABCProduct[]
  total_value: number
  percentage_of_total: number
  product_count: number
  recommendation: string
}

interface ABCResult {
  categories: ABCCategory[]
  total_value: number
  products: ABCProduct[]
}

interface StockValueReport {
  total_value: number
  by_category: Array<{ category: string; value: number; count: number }>
  by_warehouse: Array<{ warehouse_id: string; warehouse_name: string; value: number; count: number }>
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_value: number
    category: string | null
    warehouse_id: string | null
    warehouse_name: string | null
  }>
}

interface WarehouseOption {
  id: string
  name: string
}

export default function WarehouseReportsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeTab, setActiveTab] = useState("stock-status")
  const [loading, setLoading] = useState(false)

  // Report data
  const [stockStatus, setStockStatus] = useState<StockStatusReport | null>(null)
  const [turnover, setTurnover] = useState<TurnoverReport | null>(null)
  const [abcAnalysis, setAbcAnalysis] = useState<ABCResult | null>(null)
  const [stockValue, setStockValue] = useState<StockValueReport | null>(null)

  // Fetch warehouses
  const fetchWarehouses = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/lookup?type=warehouses&company_id=${activeCompanyId}`)
      if (res.ok) {
        const json = await res.json()
        setWarehouses(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  // Fetch report
  const fetchReport = useCallback(async (reportType: string) => {
    if (!activeCompanyId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        report_type: reportType,
      })
      if (selectedWarehouse && selectedWarehouse !== "all") {
        params.set("warehouse_id", selectedWarehouse)
      }
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/warehouse/reports?${params}`)
      if (res.ok) {
        const json = await res.json()
        switch (reportType) {
          case "stock-status":
            setStockStatus(json.data)
            break
          case "turnover":
            setTurnover(json.data)
            break
          case "abc-analysis":
            setAbcAnalysis(json.data)
            break
          case "stock-value":
            setStockValue(json.data)
            break
        }
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa načítať report" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Chyba pri načítaní" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedWarehouse, dateFrom, dateTo, toast])

  // Fetch on tab change
  useEffect(() => {
    if (activeCompanyId) {
      fetchReport(activeTab)
    }
  }, [activeTab, activeCompanyId, fetchReport])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pod_minimum":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Pod minimum</Badge>
      case "nad_maximum":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Nad maximum</Badge>
      case "nulovy_stav":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Nulový stav</Badge>
      default:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">V norme</Badge>
    }
  }

  const getABCBadge = (category: string) => {
    switch (category) {
      case "A":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">A</Badge>
      case "B":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">B</Badge>
      case "C":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">C</Badge>
      default:
        return <Badge variant="secondary">{category}</Badge>
    }
  }

  // CSV export
  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data || data.length === 0) return
    const headers = Object.keys(data[0])
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h]
        return typeof val === "string" && val.includes(",") ? `"${val}"` : String(val ?? "")
      }).join(",")
    )
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skladové reporty</h1>
        <p className="text-muted-foreground">Prehľady a analýzy skladu</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="mb-2 block">Sklad</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Všetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky sklady</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div>
              <Label className="mb-2 block">Do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Button onClick={() => fetchReport(activeTab)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Načítať
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock-status">Stav zásob</TabsTrigger>
          <TabsTrigger value="turnover">Obratovka</TabsTrigger>
          <TabsTrigger value="abc-analysis">ABC analýza</TabsTrigger>
          <TabsTrigger value="stock-value">Hodnota skladu</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Stav zásob */}
        {/* ================================================================ */}
        <TabsContent value="stock-status">
          {stockStatus && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Celkom</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">{stockStatus.total_products}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Pod minimum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-red-600">{stockStatus.below_min_count}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Nulový stav</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-gray-600">{stockStatus.zero_stock_count}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">V norme</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-green-600">{stockStatus.normal_count}</span>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      stockStatus.products.map((p) => ({
                        SKU: p.sku,
                        Nazov: p.product_name,
                        Stav: p.current_stock,
                        Minimum: p.min_stock ?? "",
                        Maximum: p.max_stock ?? "",
                        "Jedn. cena": p.unit_price,
                        Status: p.status,
                      })),
                      "stav-zasob"
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead className="text-right">Stav</TableHead>
                        <TableHead className="text-right">Minimum</TableHead>
                        <TableHead className="text-right">Maximum</TableHead>
                        <TableHead className="text-right">Hodnota</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockStatus.products.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                          <TableCell>{p.product_name}</TableCell>
                          <TableCell className="text-right font-medium">{p.current_stock}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.min_stock ?? "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.max_stock ?? "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(p.current_stock * p.unit_price)}
                          </TableCell>
                          <TableCell>{getStatusBadge(p.status)}</TableCell>
                        </TableRow>
                      ))}
                      {stockStatus.products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Žiadne produkty
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          {!stockStatus && !loading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Kliknite na tlačidlo Načítať
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Obratovka */}
        {/* ================================================================ */}
        <TabsContent value="turnover">
          {turnover && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Počiatočný stav</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">{turnover.totals.opening}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Príjmy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-green-600">+{turnover.totals.receipts}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Výdaje</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-red-600">-{turnover.totals.issues}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Konečný stav</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">{turnover.totals.closing}</span>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      turnover.products.map((p) => ({
                        SKU: p.sku,
                        Nazov: p.product_name,
                        "Pociatocny stav": p.opening_stock,
                        Prijmy: p.receipts,
                        Vydaje: p.issues,
                        "Konecny stav": p.closing_stock,
                      })),
                      "obratovka"
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead className="text-right">Počiatočný stav</TableHead>
                        <TableHead className="text-right">Príjmy</TableHead>
                        <TableHead className="text-right">Výdaje</TableHead>
                        <TableHead className="text-right">Konečný stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnover.products.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                          <TableCell>{p.product_name}</TableCell>
                          <TableCell className="text-right">{p.opening_stock}</TableCell>
                          <TableCell className="text-right text-green-600">+{p.receipts}</TableCell>
                          <TableCell className="text-right text-red-600">-{p.issues}</TableCell>
                          <TableCell className="text-right font-bold">{p.closing_stock}</TableCell>
                        </TableRow>
                      ))}
                      {turnover.products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Žiadne pohyby v zvolenom období
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          {!turnover && !loading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Kliknite na tlačidlo Načítať
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* ABC Analýza */}
        {/* ================================================================ */}
        <TabsContent value="abc-analysis">
          {abcAnalysis && (
            <div className="space-y-4">
              {/* Category summary */}
              <div className="grid gap-4 md:grid-cols-3">
                {abcAnalysis.categories.map((cat) => (
                  <Card key={cat.category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        {getABCBadge(cat.category)}
                        <span className="text-sm font-medium">
                          Kategória {cat.category}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Produktov</span>
                          <span className="font-bold">{cat.product_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Podiel hodnoty</span>
                          <span className="font-bold">{cat.percentage_of_total}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Celková hodnota</span>
                          <span className="font-bold">{formatCurrency(cat.total_value)}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cat.category === "A"
                                ? "bg-red-500"
                                : cat.category === "B"
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(cat.percentage_of_total, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{cat.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Celková ročná spotreba: <strong>{formatCurrency(abcAnalysis.total_value)}</strong>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      abcAnalysis.products.map((p) => ({
                        SKU: p.sku,
                        Nazov: p.product_name,
                        "Rocna spotreba": p.annual_consumption_value,
                        "Kumulativne %": p.cumulative_percentage,
                        Kategoria: p.category,
                      })),
                      "abc-analyza"
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              {/* ABC Chart - visual representation */}
              {abcAnalysis.products.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Kumulatívna krivka
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative h-48 border-b border-l">
                      {/* Y axis labels */}
                      <div className="absolute -left-8 top-0 text-xs text-muted-foreground">100%</div>
                      <div className="absolute -left-6 top-[20%] text-xs text-muted-foreground">80%</div>
                      <div className="absolute -left-6 top-[50%] text-xs text-muted-foreground">50%</div>
                      {/* Horizontal line at 80% */}
                      <div className="absolute top-[20%] left-0 right-0 border-t border-dashed border-red-300" />
                      <div className="absolute top-[5%] left-0 right-0 border-t border-dashed border-yellow-300" />
                      {/* Bars */}
                      <div className="flex items-end h-full gap-px px-8">
                        {abcAnalysis.products.slice(0, 50).map((p, idx) => {
                          const height = p.cumulative_percentage
                          return (
                            <div
                              key={p.product_id || idx}
                              className="flex-1 min-w-[2px]"
                              title={`${p.product_name}: ${p.cumulative_percentage}%`}
                            >
                              <div
                                className={`w-full rounded-t-sm ${
                                  p.category === "A"
                                    ? "bg-red-400"
                                    : p.category === "B"
                                    ? "bg-yellow-400"
                                    : "bg-blue-400"
                                }`}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Products table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead className="text-right">Ročná spotreba</TableHead>
                        <TableHead className="text-right">Kumulatívne %</TableHead>
                        <TableHead>Kategória</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abcAnalysis.products.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                          <TableCell>{p.product_name}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(p.annual_consumption_value)}
                          </TableCell>
                          <TableCell className="text-right">{p.cumulative_percentage}%</TableCell>
                          <TableCell>{getABCBadge(p.category)}</TableCell>
                        </TableRow>
                      ))}
                      {abcAnalysis.products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Žiadne produkty
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          {!abcAnalysis && !loading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Kliknite na tlačidlo Načítať
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Hodnota skladu */}
        {/* ================================================================ */}
        <TabsContent value="stock-value">
          {stockValue && (
            <div className="space-y-4">
              {/* Total value */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Celková hodnota skladu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{formatCurrency(stockValue.total_value)}</span>
                </CardContent>
              </Card>

              {/* By warehouse */}
              {stockValue.by_warehouse.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5" />
                      Podľa skladu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sklad</TableHead>
                          <TableHead className="text-right">Produktov</TableHead>
                          <TableHead className="text-right">Hodnota</TableHead>
                          <TableHead className="text-right">Podiel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockValue.by_warehouse.map((wh) => (
                          <TableRow key={wh.warehouse_id}>
                            <TableCell className="font-medium">{wh.warehouse_name}</TableCell>
                            <TableCell className="text-right">{wh.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(wh.value)}</TableCell>
                            <TableCell className="text-right">
                              {stockValue.total_value > 0
                                ? Math.round((wh.value / stockValue.total_value) * 10000) / 100
                                : 0}
                              %
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* By category */}
              {stockValue.by_category.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Podľa kategórie
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kategória</TableHead>
                          <TableHead className="text-right">Produktov</TableHead>
                          <TableHead className="text-right">Hodnota</TableHead>
                          <TableHead className="text-right">Podiel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockValue.by_category.map((cat) => (
                          <TableRow key={cat.category}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell className="text-right">{cat.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cat.value)}</TableCell>
                            <TableCell className="text-right">
                              {stockValue.total_value > 0
                                ? Math.round((cat.value / stockValue.total_value) * 10000) / 100
                                : 0}
                              %
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      stockValue.items.map((i) => ({
                        Produkt: i.product_name,
                        Mnozstvo: i.quantity,
                        "Jedn. cena": i.unit_price,
                        "Celkova hodnota": i.total_value,
                        Kategoria: i.category || "",
                        Sklad: i.warehouse_name || "",
                      })),
                      "hodnota-skladu"
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          )}
          {!stockValue && !loading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Kliknite na tlačidlo Načítať
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
