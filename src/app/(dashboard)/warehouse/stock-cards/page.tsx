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
import {
  Search,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  Loader2,
} from "lucide-react"

interface Product {
  id: string
  name: string
  sku: string
  unit: string | null
}

interface Warehouse {
  id: string
  name: string
}

interface Movement {
  id: string
  date: string
  movement_type: string
  direction: "prijem" | "vydaj" | "prevod" | "inventura"
  document_number: string | null
  quantity: number
  unit_price: number
  total_price: number
  running_balance: number
  note: string | null
  warehouse_id: string
}

interface StockCardData {
  product: Product
  opening_stock: number
  closing_stock: number
  total_receipts: number
  total_issues: number
  movements: Movement[]
}

export default function StockCardsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [stockCard, setStockCard] = useState<StockCardData | null>(null)
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Fetch products for search
  const fetchProducts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/lookup?type=products&company_id=${activeCompanyId}`)
      if (res.ok) {
        const json = await res.json()
        setProducts(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

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
    fetchProducts()
    fetchWarehouses()
  }, [fetchProducts, fetchWarehouses])

  // Filter products by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts([])
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredProducts(
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      ).slice(0, 10)
    )
  }, [searchQuery, products])

  // Select product
  const selectProduct = (product: Product) => {
    setSelectedProduct(product.id)
    setSearchQuery(product.name)
    setShowProductDropdown(false)
  }

  // Fetch stock card
  const fetchStockCard = async () => {
    if (!activeCompanyId || !selectedProduct) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyberte produkt" })
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        product_id: selectedProduct,
        company_id: activeCompanyId,
      })
      if (selectedWarehouse && selectedWarehouse !== "all") {
        params.set("warehouse_id", selectedWarehouse)
      }
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/warehouse/stock-cards?${params}`)
      if (res.ok) {
        const json = await res.json()
        setStockCard(json.data)
      } else {
        const err = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: err.error || "Nepodarilo sa načítať skladovú kartu",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Chyba pri načítaní" })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value)

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case "prijem":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Príjem</Badge>
      case "vydaj":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Výdaj</Badge>
      case "prevod":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Prevod</Badge>
      case "inventura":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Inventúra</Badge>
      default:
        return <Badge variant="secondary">{direction}</Badge>
    }
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "prijem":
        return <ArrowDownToLine className="h-4 w-4 text-green-500" />
      case "vydaj":
        return <ArrowUpFromLine className="h-4 w-4 text-red-500" />
      case "prevod":
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />
      default:
        return <ClipboardList className="h-4 w-4 text-orange-500" />
    }
  }

  // Simple bar chart for stock level
  const maxBalance = stockCard
    ? Math.max(...stockCard.movements.map((m) => Math.abs(m.running_balance)), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skladové karty</h1>
        <p className="text-muted-foreground">Prehľad pohybov a zostatkov produktov</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Product search */}
            <div className="md:col-span-2 relative">
              <Label className="mb-2 block">Produkt</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hľadať podľa názvu alebo SKU..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowProductDropdown(true)
                    if (!e.target.value) setSelectedProduct("")
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="pl-10"
                />
              </div>
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-accent text-sm flex justify-between"
                      onClick={() => selectProduct(p)}
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground font-mono">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Warehouse filter */}
            <div>
              <Label className="mb-2 block">Sklad</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
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

            {/* Date range */}
            <div>
              <Label className="mb-2 block">Od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-2 block">Do</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                <Button onClick={fetchStockCard} disabled={!selectedProduct || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock card data */}
      {stockCard && (
        <>
          {/* Product info and balances */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Produkt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{stockCard.product.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{stockCard.product.sku}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Počiatočný stav
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stockCard.opening_stock}</span>
                <span className="text-sm text-muted-foreground ml-1">
                  {stockCard.product.unit || "ks"}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Príjmy / Výdaje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <span className="text-green-600 font-bold">+{stockCard.total_receipts}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-red-600 font-bold">-{stockCard.total_issues}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Konečný zostatok
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stockCard.closing_stock}</span>
                <span className="text-sm text-muted-foreground ml-1">
                  {stockCard.product.unit || "ks"}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Movements table */}
          <Card>
            <CardHeader>
              <CardTitle>Pohyby</CardTitle>
            </CardHeader>
            <CardContent>
              {stockCard.movements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Žiadne pohyby v zvolenom období
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Dátum</TableHead>
                      <TableHead className="w-[100px]">Typ</TableHead>
                      <TableHead>Doklad</TableHead>
                      <TableHead className="text-right w-[100px]">Množstvo</TableHead>
                      <TableHead className="text-right w-[120px]">Jedn. cena</TableHead>
                      <TableHead className="text-right w-[100px]">Zostatok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockCard.movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">
                          {new Date(m.date).toLocaleDateString("sk-SK")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDirectionIcon(m.direction)}
                            {getDirectionBadge(m.direction)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.document_number || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span
                            className={
                              m.quantity > 0 ? "text-green-600" : m.quantity < 0 ? "text-red-600" : ""
                            }
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(m.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-bold">{m.running_balance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Simple stock level chart */}
          {stockCard.movements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Vývoj stavu zásob
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-48">
                  {stockCard.movements.map((m, idx) => {
                    const height = Math.max((Math.abs(m.running_balance) / maxBalance) * 100, 2)
                    return (
                      <div
                        key={m.id || idx}
                        className="flex-1 flex flex-col items-center justify-end"
                        title={`${new Date(m.date).toLocaleDateString("sk-SK")}: ${m.running_balance}`}
                      >
                        <div
                          className="w-full bg-primary/80 rounded-t-sm min-w-[4px] transition-all"
                          style={{ height: `${height}%` }}
                        />
                        {stockCard.movements.length <= 20 && (
                          <span className="text-[10px] text-muted-foreground mt-1 rotate-[-45deg] whitespace-nowrap">
                            {new Date(m.date).toLocaleDateString("sk-SK", {
                              day: "numeric",
                              month: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
