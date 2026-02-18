"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from "lucide-react"

interface WarehouseOption {
  id: string
  name: string
  code: string
}

interface ProductOption {
  id: string
  name: string
  sku: string
  unit: string
  warehouse_stock_levels: Array<{ warehouse_id: string; quantity: number }>
}

interface ContactOption {
  id: string
  name: string
}

interface IssueItem {
  product_id: string
  product_name: string
  product_unit: string
  quantity: string
  available_stock: number
}

const reasonOptions = [
  { value: "predaj", label: "Predaj" },
  { value: "spotreba", label: "Spotreba" },
  { value: "likvidacia", label: "Likvidacia" },
  { value: "prevod", label: "Prevod" },
]

export default function NewIssuePage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [customers, setCustomers] = useState<ContactOption[]>([])

  const [warehouseId, setWarehouseId] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [issueNumber, setIssueNumber] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [reason, setReason] = useState("predaj")
  const [note, setNote] = useState("")
  const [items, setItems] = useState<IssueItem[]>([{
    product_id: "",
    product_name: "",
    product_unit: "",
    quantity: "1",
    available_stock: 0,
  }])

  const [productSearch, setProductSearch] = useState("")
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null)

  const fetchWarehouses = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/warehouse/warehouses?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) setWarehouses(json.data || [])
    } catch { /* ignore */ }
  }, [activeCompanyId])

  const fetchProducts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/warehouse/products?company_id=${activeCompanyId}&limit=100`)
      const json = await res.json()
      if (res.ok) setProducts(json.data || [])
    } catch { /* ignore */ }
  }, [activeCompanyId])

  const fetchCustomers = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/contacts?company_id=${activeCompanyId}&type=odberatel&limit=100`)
      const json = await res.json()
      if (res.ok) setCustomers(json.data || [])
    } catch { /* ignore */ }
  }, [activeCompanyId])

  useEffect(() => {
    fetchWarehouses()
    fetchProducts()
    fetchCustomers()
  }, [fetchWarehouses, fetchProducts, fetchCustomers])

  // Auto-generate issue number
  useEffect(() => {
    const now = new Date()
    const num = `VY-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`
    setIssueNumber(num)
  }, [])

  const getProductStock = (product: ProductOption, wId: string) => {
    const level = (product.warehouse_stock_levels || []).find((sl) => sl.warehouse_id === wId)
    return level?.quantity || 0
  }

  const addItem = () => {
    setItems((prev) => [...prev, {
      product_id: "",
      product_name: "",
      product_unit: "",
      quantity: "1",
      available_stock: 0,
    }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof IssueItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const selectProduct = (index: number, product: ProductOption) => {
    const available = getProductStock(product, warehouseId)
    setItems((prev) => prev.map((item, i) =>
      i === index
        ? {
            ...item,
            product_id: product.id,
            product_name: `${product.sku} - ${product.name}`,
            product_unit: product.unit,
            available_stock: available,
          }
        : item
    ))
    setShowProductDropdown(null)
    setProductSearch("")
  }

  // Update available stock when warehouse changes
  useEffect(() => {
    if (!warehouseId) return
    setItems((prev) => prev.map((item) => {
      if (!item.product_id) return item
      const product = products.find((p) => p.id === item.product_id)
      if (!product) return item
      return { ...item, available_stock: getProductStock(product, warehouseId) }
    }))
  }, [warehouseId, products])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCompanyId) return

    if (!warehouseId) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyberte sklad" })
      return
    }

    const validItems = items.filter((item) => item.product_id)
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Pridajte aspon jednu polozku" })
      return
    }

    // Check stock levels
    const insufficientItems = validItems.filter(
      (item) => (parseFloat(item.quantity) || 0) > item.available_stock
    )
    if (insufficientItems.length > 0) {
      toast({
        variant: "destructive",
        title: "Nedostatocne zasoby",
        description: "Niektore polozky nemaju dostatocne zasoby na sklade",
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        company_id: activeCompanyId,
        warehouse_id: warehouseId,
        customer_id: customerId || undefined,
        issue_number: issueNumber,
        issue_date: issueDate,
        reason,
        note: note || undefined,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity) || 0,
        })),
      }

      const res = await fetch("/api/warehouse/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({ title: "Vydajka vytvorena" })
        router.push("/warehouse")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit vydajku" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit vydajku" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/warehouse">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova vydajka</h1>
          <p className="text-muted-foreground">Vydaj tovaru zo skladu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle>Hlavicka vydajky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sklad *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Vyberte sklad</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Zakaznik</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">-- Bez zakaznika --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Dovod vydaja *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  {reasonOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cislo vydajky *</Label>
                <Input
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Datum *</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poznamka</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Volitelna poznamka"
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Polozky</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" />
              Pridat polozku
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium w-2/5">Produkt</th>
                    <th className="h-10 px-4 text-right font-medium">Na sklade</th>
                    <th className="h-10 px-4 text-right font-medium">Mnozstvo</th>
                    <th className="h-10 px-4 text-left font-medium">Stav</th>
                    <th className="h-10 px-4 text-right font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const qty = parseFloat(item.quantity) || 0
                    const isInsufficient = item.product_id && qty > item.available_stock
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2">
                          <div className="relative">
                            <Input
                              value={item.product_name || productSearch}
                              onChange={(e) => {
                                if (!item.product_id) {
                                  setProductSearch(e.target.value)
                                } else {
                                  updateItem(index, "product_id", "")
                                  updateItem(index, "product_name", "")
                                  setProductSearch(e.target.value)
                                }
                                setShowProductDropdown(index)
                              }}
                              onFocus={() => setShowProductDropdown(index)}
                              placeholder="Hladat produkt..."
                            />
                            {showProductDropdown === index && !item.product_id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowProductDropdown(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                                  {filteredProducts.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">Ziadne produkty</div>
                                  ) : (
                                    filteredProducts.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                        onClick={() => selectProduct(index, p)}
                                      >
                                        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                                        <span>{p.name}</span>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                          {warehouseId ? getProductStock(p, warehouseId) : "?"} {p.unit}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {item.product_id ? `${item.available_stock} ${item.product_unit}` : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                            className={`text-right w-24 ${isInsufficient ? "border-red-500" : ""}`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {isInsufficient && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Nedostatok
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Ukladam..." : "Ulozit vydajku"}
          </Button>
          <Link href="/warehouse">
            <Button type="button" variant="outline">Zrusit</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
