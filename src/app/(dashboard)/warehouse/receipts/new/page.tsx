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
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"

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
  purchase_price: number | null
}

interface ContactOption {
  id: string
  name: string
}

interface ReceiptItem {
  product_id: string
  product_name: string
  product_unit: string
  quantity: string
  unit_price: string
  batch_number: string
  serial_number: string
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function NewReceiptPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [suppliers, setSuppliers] = useState<ContactOption[]>([])

  const [warehouseId, setWarehouseId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [receiptNumber, setReceiptNumber] = useState("")
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0])
  const [note, setNote] = useState("")
  const [items, setItems] = useState<ReceiptItem[]>([{
    product_id: "",
    product_name: "",
    product_unit: "",
    quantity: "1",
    unit_price: "0",
    batch_number: "",
    serial_number: "",
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

  const fetchSuppliers = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/contacts?company_id=${activeCompanyId}&type=dodavatel&limit=100`)
      const json = await res.json()
      if (res.ok) setSuppliers(json.data || [])
    } catch { /* ignore */ }
  }, [activeCompanyId])

  useEffect(() => {
    fetchWarehouses()
    fetchProducts()
    fetchSuppliers()
  }, [fetchWarehouses, fetchProducts, fetchSuppliers])

  // Auto-generate receipt number
  useEffect(() => {
    const now = new Date()
    const num = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`
    setReceiptNumber(num)
  }, [])

  const addItem = () => {
    setItems((prev) => [...prev, {
      product_id: "",
      product_name: "",
      product_unit: "",
      quantity: "1",
      unit_price: "0",
      batch_number: "",
      serial_number: "",
    }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ReceiptItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const selectProduct = (index: number, product: ProductOption) => {
    setItems((prev) => prev.map((item, i) =>
      i === index
        ? {
            ...item,
            product_id: product.id,
            product_name: `${product.sku} - ${product.name}`,
            product_unit: product.unit,
            unit_price: product.purchase_price?.toString() || "0",
          }
        : item
    ))
    setShowProductDropdown(null)
    setProductSearch("")
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  const totalAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return sum + qty * price
  }, 0)

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

    setSaving(true)
    try {
      const payload = {
        company_id: activeCompanyId,
        warehouse_id: warehouseId,
        supplier_id: supplierId || undefined,
        receipt_number: receiptNumber,
        receipt_date: receiptDate,
        note: note || undefined,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          batch_number: item.batch_number || undefined,
          serial_number: item.serial_number || undefined,
        })),
      }

      const res = await fetch("/api/warehouse/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({ title: "Prijemka vytvorena" })
        router.push("/warehouse")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit prijemku" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit prijemku" })
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
          <h1 className="text-3xl font-bold tracking-tight">Nova prijemka</h1>
          <p className="text-muted-foreground">Prijem tovaru na sklad</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle>Hlavicka prijemky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label>Dodavatel</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">-- Bez dodavatela --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cislo prijemky *</Label>
                <Input
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Datum *</Label>
                <Input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
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
                    <th className="h-10 px-4 text-left font-medium w-1/3">Produkt</th>
                    <th className="h-10 px-4 text-right font-medium">Mnozstvo</th>
                    <th className="h-10 px-4 text-right font-medium">Jedn. cena</th>
                    <th className="h-10 px-4 text-left font-medium">Saria</th>
                    <th className="h-10 px-4 text-left font-medium">Ser. cislo</th>
                    <th className="h-10 px-4 text-right font-medium">Spolu</th>
                    <th className="h-10 px-4 text-right font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
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
                                      <span className="text-xs text-muted-foreground ml-auto">{p.unit}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          className="text-right w-24"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                          className="text-right w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={item.batch_number}
                          onChange={(e) => updateItem(index, "batch_number", e.target.value)}
                          placeholder="Saria"
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={item.serial_number}
                          onChange={(e) => updateItem(index, "serial_number", e.target.value)}
                          placeholder="S/N"
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
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
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={5} className="px-4 py-3 text-right font-medium">Celkova suma:</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">{formatMoney(totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Ukladam..." : "Ulozit prijemku"}
          </Button>
          <Link href="/warehouse">
            <Button type="button" variant="outline">Zrusit</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
