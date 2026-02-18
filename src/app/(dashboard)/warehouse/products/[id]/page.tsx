"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Save,
  Trash2,
  Package,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Pencil,
} from "lucide-react"

interface ProductDetail {
  id: string
  name: string
  sku: string
  description: string | null
  unit: string
  category_id: string | null
  min_stock: number | null
  max_stock: number | null
  ean_code: string | null
  purchase_price: number | null
  sale_price: number | null
  vat_rate: number
  warehouse_stock_levels: Array<{
    id: string
    warehouse_id: string
    quantity: number
    warehouse: { id: string; name: string; code: string } | null
  }>
  recent_movements: Array<{
    id: string
    type: string
    quantity: number
    unit_price: number
    date: string
    reference_type: string
    warehouse: { id: string; name: string; code: string } | null
  }>
}

const unitOptions = [
  { value: "ks", label: "ks - kusy" },
  { value: "kg", label: "kg - kilogramy" },
  { value: "l", label: "l - litre" },
  { value: "m", label: "m - metre" },
  { value: "m2", label: "m2 - metre stvorcove" },
  { value: "m3", label: "m3 - metre kubicke" },
  { value: "t", label: "t - tony" },
  { value: "bal", label: "bal - balenia" },
  { value: "kart", label: "kart - kartony" },
]

const movementTypeLabels: Record<string, string> = {
  prijem: "Prijem",
  vydaj: "Vydaj",
  prevod: "Prevod",
}

const movementTypeIcons: Record<string, typeof ArrowDownToLine> = {
  prijem: ArrowDownToLine,
  vydaj: ArrowUpFromLine,
  prevod: ArrowLeftRight,
}

function formatMoney(amount: number | null) {
  if (amount === null || amount === undefined) return "-"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK")
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    unit: "ks",
    category_id: "",
    purchase_price: "",
    sale_price: "",
    vat_rate: "23",
    min_stock: "",
    max_stock: "",
    ean_code: "",
  })

  const fetchProduct = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/warehouse/products/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setProduct(data)
        setForm({
          name: data.name || "",
          sku: data.sku || "",
          description: data.description || "",
          unit: data.unit || "ks",
          category_id: data.category_id || "",
          purchase_price: data.purchase_price?.toString() || "",
          sale_price: data.sale_price?.toString() || "",
          vat_rate: data.vat_rate?.toString() || "23",
          min_stock: data.min_stock?.toString() || "",
          max_stock: data.max_stock?.toString() || "",
          ean_code: data.ean_code || "",
        })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Produkt nenajdeny" })
        router.push("/warehouse")
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat produkt" })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast, router])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description || undefined,
        unit: form.unit,
        category_id: form.category_id || undefined,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : undefined,
        vat_rate: parseInt(form.vat_rate),
        min_stock: form.min_stock ? parseInt(form.min_stock) : undefined,
        max_stock: form.max_stock ? parseInt(form.max_stock) : undefined,
        ean_code: form.ean_code || undefined,
      }

      const res = await fetch(`/api/warehouse/products/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({ title: "Produkt aktualizovany" })
        setEditing(false)
        fetchProduct()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa aktualizovat produkt" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa aktualizovat produkt" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Naozaj chcete odstranit tento produkt?")) return
    try {
      const res = await fetch(`/api/warehouse/products/${params.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Produkt odstraneny" })
        router.push("/warehouse")
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit produkt" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit produkt" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nacitavam produkt...</p>
      </div>
    )
  }

  if (!product) return null

  const totalStock = (product.warehouse_stock_levels || []).reduce(
    (sum, sl) => sum + (sl.quantity || 0),
    0
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/warehouse">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground font-mono">{product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Upravit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Odstranit
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Ukladam..." : "Ulozit"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Zrusit</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacie o produkte</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nazov</Label>
                      <Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <Input value={form.sku} onChange={(e) => handleChange("sku", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Popis</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Jednotka</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.unit}
                        onChange={(e) => handleChange("unit", e.target.value)}
                      >
                        {unitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>EAN kod</Label>
                      <Input value={form.ean_code} onChange={(e) => handleChange("ean_code", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>DPH (%)</Label>
                      <Input value={form.vat_rate} onChange={(e) => handleChange("vat_rate", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nakupna cena</Label>
                      <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => handleChange("purchase_price", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Predajna cena</Label>
                      <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => handleChange("sale_price", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min. zasoba</Label>
                      <Input type="number" value={form.min_stock} onChange={(e) => handleChange("min_stock", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max. zasoba</Label>
                      <Input type="number" value={form.max_stock} onChange={(e) => handleChange("max_stock", e.target.value)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nazov</p>
                      <p className="font-medium">{product.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SKU</p>
                      <p className="font-medium font-mono">{product.sku}</p>
                    </div>
                  </div>
                  {product.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Popis</p>
                      <p>{product.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Jednotka</p>
                      <p>{product.unit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">EAN</p>
                      <p>{product.ean_code || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">DPH</p>
                      <p>{product.vat_rate}%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nakupna cena</p>
                      <p className="font-medium">{formatMoney(product.purchase_price)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Predajna cena</p>
                      <p className="font-medium">{formatMoney(product.sale_price)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Min. zasoba</p>
                      <p>{product.min_stock ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max. zasoba</p>
                      <p>{product.max_stock ?? "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent movements */}
          <Card>
            <CardHeader>
              <CardTitle>Posledne pohyby</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Datum</th>
                      <th className="h-10 px-4 text-left font-medium">Typ</th>
                      <th className="h-10 px-4 text-left font-medium">Sklad</th>
                      <th className="h-10 px-4 text-right font-medium">Mnozstvo</th>
                      <th className="h-10 px-4 text-right font-medium">Jedn. cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(product.recent_movements || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-16 text-center text-muted-foreground">
                          Ziadne pohyby
                        </td>
                      </tr>
                    ) : (
                      product.recent_movements.map((mov) => {
                        const Icon = movementTypeIcons[mov.type] || Package
                        return (
                          <tr key={mov.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-3">{formatDate(mov.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                mov.type === "prijem"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : mov.type === "vydaj"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              }`}>
                                <Icon className="h-3 w-3" />
                                {movementTypeLabels[mov.type] || mov.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">{mov.warehouse?.name || "-"}</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {mov.type === "vydaj" ? "-" : "+"}{mov.quantity}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {mov.unit_price > 0 ? formatMoney(mov.unit_price) : "-"}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Celkova zasoba</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalStock} {product.unit}
              </div>
              {product.min_stock && totalStock < product.min_stock && (
                <p className="text-sm text-yellow-600 mt-1">Pod minimalnou zasobou ({product.min_stock})</p>
              )}
            </CardContent>
          </Card>

          {/* Stock per warehouse */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zasoby podla skladov</CardTitle>
            </CardHeader>
            <CardContent>
              {(product.warehouse_stock_levels || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ziadne zasoby</p>
              ) : (
                <div className="space-y-3">
                  {product.warehouse_stock_levels.map((sl) => (
                    <div key={sl.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{sl.warehouse?.name || "Neznamy sklad"}</span>
                      </div>
                      <span className="font-medium">{sl.quantity} {product.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cenove informacie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nakupna cena</span>
                <span className="font-medium">{formatMoney(product.purchase_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Predajna cena</span>
                <span className="font-medium">{formatMoney(product.sale_price)}</span>
              </div>
              {product.purchase_price && product.sale_price && product.purchase_price > 0 && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Marza</span>
                  <span className="font-medium text-green-600">
                    {((product.sale_price - product.purchase_price) / product.purchase_price * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">DPH</span>
                <span>{product.vat_rate}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
