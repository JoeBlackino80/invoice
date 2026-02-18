"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Wand2 } from "lucide-react"
import Link from "next/link"

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

function generateSKU() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let sku = "PRD-"
  for (let i = 0; i < 6; i++) {
    sku += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return sku
}

export default function NewProductPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
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

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleGenerateSKU = () => {
    setForm((prev) => ({ ...prev, sku: generateSKU() }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCompanyId) return

    setSaving(true)
    try {
      const payload = {
        company_id: activeCompanyId,
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

      const res = await fetch("/api/warehouse/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({ title: "Produkt vytvoreny" })
        router.push("/warehouse")
      } else {
        const err = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: err.error || "Nepodarilo sa vytvorit produkt",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit produkt" })
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
          <h1 className="text-3xl font-bold tracking-tight">Novy produkt</h1>
          <p className="text-muted-foreground">Pridajte novy produkt do skladu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Zakladne udaje */}
        <Card>
          <CardHeader>
            <CardTitle>Zakladne udaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nazov *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Nazov produktu"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU kod *</Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    placeholder="PRD-XXXXXX"
                    required
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleGenerateSKU} title="Generovat SKU">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Popis produktu"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Jednotka *</Label>
                <select
                  id="unit"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                >
                  {unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ean_code">EAN kod</Label>
                <Input
                  id="ean_code"
                  value={form.ean_code}
                  onChange={(e) => handleChange("ean_code", e.target.value)}
                  placeholder="8590000000000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ceny */}
        <Card>
          <CardHeader>
            <CardTitle>Ceny</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Nakupna cena (EUR)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchase_price}
                  onChange={(e) => handleChange("purchase_price", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price">Predajna cena (EUR)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sale_price}
                  onChange={(e) => handleChange("sale_price", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_rate">Sadzba DPH (%)</Label>
                <select
                  id="vat_rate"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.vat_rate}
                  onChange={(e) => handleChange("vat_rate", e.target.value)}
                >
                  <option value="23">23%</option>
                  <option value="10">10%</option>
                  <option value="5">5%</option>
                  <option value="0">0% (oslobodene)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zasoby */}
        <Card>
          <CardHeader>
            <CardTitle>Zasoby</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_stock">Minimalna zasoba</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={form.min_stock}
                  onChange={(e) => handleChange("min_stock", e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Upozornenie pri poklese pod tuto hodnotu</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_stock">Maximalna zasoba</Label>
                <Input
                  id="max_stock"
                  type="number"
                  min="0"
                  value={form.max_stock}
                  onChange={(e) => handleChange("max_stock", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Ukladam..." : "Ulozit produkt"}
          </Button>
          <Link href="/warehouse">
            <Button type="button" variant="outline">Zrusit</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
