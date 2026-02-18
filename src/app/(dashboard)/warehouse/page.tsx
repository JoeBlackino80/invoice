"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Warehouse,
  MoreHorizontal,
  Trash2,
  Eye,
  Pencil,
  AlertTriangle,
} from "lucide-react"

type TabKey = "produkty" | "prijemky" | "vydajky" | "prevodky" | "sklady"

interface Product {
  id: string
  name: string
  sku: string
  unit: string
  min_stock: number | null
  purchase_price: number | null
  sale_price: number | null
  warehouse_stock_levels: Array<{ quantity: number }>
}

interface Receipt {
  id: string
  receipt_number: string
  receipt_date: string
  total_amount: number
  warehouse: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
}

interface Issue {
  id: string
  issue_number: string
  issue_date: string
  reason: string
  warehouse: { id: string; name: string } | null
  customer: { id: string; name: string } | null
}

interface Transfer {
  id: string
  transfer_number: string
  transfer_date: string
  from_warehouse: { id: string; name: string } | null
  to_warehouse: { id: string; name: string } | null
}

interface WarehouseItem {
  id: string
  name: string
  code: string
  address: string | null
  is_default: boolean
  stock_items_count: number
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "produkty", label: "Produkty" },
  { key: "prijemky", label: "Prijemky" },
  { key: "vydajky", label: "Vydajky" },
  { key: "prevodky", label: "Prevodky" },
  { key: "sklady", label: "Sklady" },
]

const reasonLabels: Record<string, string> = {
  predaj: "Predaj",
  spotreba: "Spotreba",
  likvidacia: "Likvidacia",
  prevod: "Prevod",
}

function formatMoney(amount: number | null) {
  if (amount === null || amount === undefined) return "-"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK")
}

export default function WarehousePage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>("produkty")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [stockFilter, setStockFilter] = useState("")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Data states
  const [products, setProducts] = useState<Product[]>([])
  const [productsPagination, setProductsPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [receiptsPagination, setReceiptsPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [issues, setIssues] = useState<Issue[]>([])
  const [issuesPagination, setIssuesPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersPagination, setTransfersPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])

  const fetchProducts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: productsPagination.page.toString(),
        limit: "25",
      })
      if (search) params.set("search", search)
      if (stockFilter) params.set("stock_status", stockFilter)

      const res = await fetch(`/api/warehouse/products?${params}`)
      const json = await res.json()
      if (res.ok) {
        setProducts(json.data || [])
        setProductsPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat produkty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, stockFilter, productsPagination.page, toast])

  const fetchReceipts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: receiptsPagination.page.toString(),
        limit: "25",
      })
      const res = await fetch(`/api/warehouse/receipts?${params}`)
      const json = await res.json()
      if (res.ok) {
        setReceipts(json.data || [])
        setReceiptsPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat prijemky" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, receiptsPagination.page, toast])

  const fetchIssues = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: issuesPagination.page.toString(),
        limit: "25",
      })
      const res = await fetch(`/api/warehouse/issues?${params}`)
      const json = await res.json()
      if (res.ok) {
        setIssues(json.data || [])
        setIssuesPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat vydajky" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, issuesPagination.page, toast])

  const fetchTransfers = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: transfersPagination.page.toString(),
        limit: "25",
      })
      const res = await fetch(`/api/warehouse/transfers?${params}`)
      const json = await res.json()
      if (res.ok) {
        setTransfers(json.data || [])
        setTransfersPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat prevodky" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, transfersPagination.page, toast])

  const fetchWarehouses = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/warehouse/warehouses?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setWarehouses(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat sklady" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    switch (activeTab) {
      case "produkty":
        fetchProducts()
        break
      case "prijemky":
        fetchReceipts()
        break
      case "vydajky":
        fetchIssues()
        break
      case "prevodky":
        fetchTransfers()
        break
      case "sklady":
        fetchWarehouses()
        break
    }
  }, [activeTab, fetchProducts, fetchReceipts, fetchIssues, fetchTransfers, fetchWarehouses])

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento produkt?")) return
    try {
      const res = await fetch(`/api/warehouse/products/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Produkt odstraneny" })
        fetchProducts()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit produkt" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit produkt" })
    }
    setMenuOpen(null)
  }

  const handleDeleteReceipt = async (id: string) => {
    if (!confirm("Naozaj chcete stornovat tuto prijemku? Zasoby budu znizene.")) return
    try {
      const res = await fetch(`/api/warehouse/receipts/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Prijemka stornovana" })
        fetchReceipts()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stornovat prijemku" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stornovat prijemku" })
    }
    setMenuOpen(null)
  }

  const handleDeleteIssue = async (id: string) => {
    if (!confirm("Naozaj chcete stornovat tuto vydajku? Zasoby budu zvysene.")) return
    try {
      const res = await fetch(`/api/warehouse/issues/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Vydajka stornovana" })
        fetchIssues()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stornovat vydajku" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stornovat vydajku" })
    }
    setMenuOpen(null)
  }

  const getProductStock = (product: Product) => {
    return (product.warehouse_stock_levels || []).reduce(
      (sum, sl) => sum + (sl.quantity || 0),
      0
    )
  }

  const getStockBadge = (product: Product) => {
    const stock = getProductStock(product)
    if (stock <= 0) {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          Vypredane
        </span>
      )
    }
    if (product.min_stock && stock < product.min_stock) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          <AlertTriangle className="h-3 w-3" />
          Nizke zasoby
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        Na sklade
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sklad</h1>
          <p className="text-muted-foreground">Sprava produktov, prijemiek, vydajok a prevodiek</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/warehouse/products/new">
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" />
            Novy produkt
          </Button>
        </Link>
        <Link href="/warehouse/receipts/new">
          <Button variant="outline" className="gap-2">
            <ArrowDownToLine className="h-4 w-4 text-green-600" />
            Nova prijemka
          </Button>
        </Link>
        <Link href="/warehouse/issues/new">
          <Button variant="outline" className="gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-red-600" />
            Nova vydajka
          </Button>
        </Link>
        <Link href="/warehouse/transfers/new">
          <Button variant="outline" className="gap-2">
            <ArrowLeftRight className="h-4 w-4 text-blue-600" />
            Novy prevod
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === "produkty" && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Hladat podla nazvu, SKU, EAN..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {[
                { value: "", label: "Vsetky" },
                { value: "in_stock", label: "Na sklade" },
                { value: "low_stock", label: "Nizke zasoby" },
                { value: "out_of_stock", label: "Vypredane" },
              ].map((f) => (
                <Button
                  key={f.value}
                  variant={stockFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStockFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Link href="/warehouse/products/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novy produkt
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">SKU</th>
                      <th className="h-10 px-4 text-left font-medium">Nazov</th>
                      <th className="h-10 px-4 text-left font-medium">Jednotka</th>
                      <th className="h-10 px-4 text-right font-medium">Na sklade</th>
                      <th className="h-10 px-4 text-right font-medium">Min. zasoba</th>
                      <th className="h-10 px-4 text-right font-medium">Nakupna cena</th>
                      <th className="h-10 px-4 text-right font-medium">Predajna cena</th>
                      <th className="h-10 px-4 text-left font-medium">Stav</th>
                      <th className="h-10 px-4 text-right font-medium">Akcie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="h-24 text-center text-muted-foreground">
                          Nacitavam...
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="h-24 text-center text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Ziadne produkty.</p>
                          <Link href="/warehouse/products/new" className="text-primary hover:underline text-sm">
                            Vytvorit prvy produkt
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                          <td className="px-4 py-3">
                            <Link href={`/warehouse/products/${product.id}`} className="font-medium hover:text-primary">
                              {product.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{product.unit}</td>
                          <td className="px-4 py-3 text-right font-medium">{getProductStock(product)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{product.min_stock ?? "-"}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatMoney(product.purchase_price)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatMoney(product.sale_price)}</td>
                          <td className="px-4 py-3">{getStockBadge(product)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-block">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setMenuOpen(menuOpen === product.id ? null : product.id)}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              {menuOpen === product.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                    <Link
                                      href={`/warehouse/products/${product.id}`}
                                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => setMenuOpen(null)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </Link>
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                      onClick={() => handleDeleteProduct(product.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Odstranit
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {productsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">{productsPagination.total} produktov celkovo</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={productsPagination.page <= 1} onClick={() => setProductsPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                      Predchadzajuca
                    </Button>
                    <Button variant="outline" size="sm" disabled={productsPagination.page >= productsPagination.totalPages} onClick={() => setProductsPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipts Tab */}
      {activeTab === "prijemky" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{receiptsPagination.total} prijemiek celkovo</p>
            <Link href="/warehouse/receipts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova prijemka
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Cislo</th>
                      <th className="h-10 px-4 text-left font-medium">Datum</th>
                      <th className="h-10 px-4 text-left font-medium">Sklad</th>
                      <th className="h-10 px-4 text-left font-medium">Dodavatel</th>
                      <th className="h-10 px-4 text-right font-medium">Suma</th>
                      <th className="h-10 px-4 text-right font-medium">Akcie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">Nacitavam...</td></tr>
                    ) : receipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Ziadne prijemky.</p>
                        </td>
                      </tr>
                    ) : (
                      receipts.map((receipt) => (
                        <tr key={receipt.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{receipt.receipt_number}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(receipt.receipt_date)}</td>
                          <td className="px-4 py-3">{receipt.warehouse?.name || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{receipt.supplier?.name || "-"}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatMoney(receipt.total_amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteReceipt(receipt.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {receiptsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">{receiptsPagination.total} prijemiek</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={receiptsPagination.page <= 1} onClick={() => setReceiptsPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                      Predchadzajuca
                    </Button>
                    <Button variant="outline" size="sm" disabled={receiptsPagination.page >= receiptsPagination.totalPages} onClick={() => setReceiptsPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === "vydajky" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{issuesPagination.total} vydajok celkovo</p>
            <Link href="/warehouse/issues/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova vydajka
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Cislo</th>
                      <th className="h-10 px-4 text-left font-medium">Datum</th>
                      <th className="h-10 px-4 text-left font-medium">Sklad</th>
                      <th className="h-10 px-4 text-left font-medium">Dovod</th>
                      <th className="h-10 px-4 text-left font-medium">Zakaznik</th>
                      <th className="h-10 px-4 text-right font-medium">Akcie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">Nacitavam...</td></tr>
                    ) : issues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          <ArrowUpFromLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Ziadne vydajky.</p>
                        </td>
                      </tr>
                    ) : (
                      issues.map((issue) => (
                        <tr key={issue.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{issue.issue_number}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(issue.issue_date)}</td>
                          <td className="px-4 py-3">{issue.warehouse?.name || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {reasonLabels[issue.reason] || issue.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{issue.customer?.name || "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteIssue(issue.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {issuesPagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">{issuesPagination.total} vydajok</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={issuesPagination.page <= 1} onClick={() => setIssuesPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                      Predchadzajuca
                    </Button>
                    <Button variant="outline" size="sm" disabled={issuesPagination.page >= issuesPagination.totalPages} onClick={() => setIssuesPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === "prevodky" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{transfersPagination.total} prevodiek celkovo</p>
            <Link href="/warehouse/transfers/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novy prevod
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Cislo</th>
                      <th className="h-10 px-4 text-left font-medium">Datum</th>
                      <th className="h-10 px-4 text-left font-medium">Zo skladu</th>
                      <th className="h-10 px-4 text-left font-medium">Do skladu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="h-24 text-center text-muted-foreground">Nacitavam...</td></tr>
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                          <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Ziadne prevodky.</p>
                        </td>
                      </tr>
                    ) : (
                      transfers.map((transfer) => (
                        <tr key={transfer.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{transfer.transfer_number}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(transfer.transfer_date)}</td>
                          <td className="px-4 py-3">{transfer.from_warehouse?.name || "-"}</td>
                          <td className="px-4 py-3">{transfer.to_warehouse?.name || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {transfersPagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">{transfersPagination.total} prevodiek</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={transfersPagination.page <= 1} onClick={() => setTransfersPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                      Predchadzajuca
                    </Button>
                    <Button variant="outline" size="sm" disabled={transfersPagination.page >= transfersPagination.totalPages} onClick={() => setTransfersPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warehouses Tab */}
      {activeTab === "sklady" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{warehouses.length} skladov</p>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader><div className="h-5 bg-muted rounded w-1/2" /></CardHeader>
                  <CardContent><div className="h-8 bg-muted rounded w-2/3" /></CardContent>
                </Card>
              ))}
            </div>
          ) : warehouses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Warehouse className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">Zatial nemate ziadny sklad.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((wh) => (
                <Card key={wh.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{wh.name}</CardTitle>
                      {wh.is_default && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          Predvoleny
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground font-mono">{wh.code}</p>
                    {wh.address && <p className="text-sm text-muted-foreground mt-1">{wh.address}</p>}
                    <p className="text-sm mt-2">
                      <span className="font-medium">{wh.stock_items_count}</span>{" "}
                      <span className="text-muted-foreground">poloziek na sklade</span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
