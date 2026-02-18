"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Info, TrendingDown } from "lucide-react"
import {
  calculateStraightLine,
  calculateAccelerated,
  getUsefulLife,
  DEPRECIATION_GROUPS,
} from "@/lib/tax/depreciation-calculator"

interface AssetCategory {
  id: string
  name: string
  depreciation_group: number
  useful_life: number | null
  depreciation_method: string
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function NewAssetPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<AssetCategory[]>([])

  const [form, setForm] = useState({
    name: "",
    description: "",
    acquisition_date: new Date().toISOString().split("T")[0],
    acquisition_cost: 0,
    category_id: "",
    depreciation_group: 1,
    depreciation_method: "rovnomerne" as "rovnomerne" | "zrychlene",
    useful_life_years: 4,
  })

  const fetchCategories = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/asset-categories?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setCategories(json.data || [])
      }
    } catch {
      // Silent fail - categories are optional
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto-update useful_life when group changes
      if (field === "depreciation_group") {
        updated.useful_life_years = getUsefulLife(value as number)
      }

      return updated
    })
  }

  const handleCategorySelect = (categoryId: string) => {
    if (!categoryId) {
      handleChange("category_id", "")
      return
    }
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      setForm((prev) => ({
        ...prev,
        category_id: categoryId,
        depreciation_group: category.depreciation_group,
        depreciation_method: category.depreciation_method as "rovnomerne" | "zrychlene",
        useful_life_years: category.useful_life || getUsefulLife(category.depreciation_group),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov majetku je povinny" })
      return
    }

    if (form.acquisition_cost <= 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Obstaravacia cena musi byt kladna" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category_id: form.category_id || null,
          acquisition_cost: Number(form.acquisition_cost),
          company_id: activeCompanyId,
        }),
      })

      if (res.ok) {
        toast({ title: "Majetok vytvoreny", description: `Majetok "${form.name}" bol uspesne vytvoreny.` })
        router.push("/taxes/depreciation")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit majetok" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit majetok" })
    } finally {
      setSaving(false)
    }
  }

  // Preview first year depreciation
  const previewFirstYear = () => {
    if (form.acquisition_cost <= 0) return null
    const startYear = new Date(form.acquisition_date).getFullYear()

    if (form.depreciation_method === "zrychlene") {
      const results = calculateAccelerated(form.acquisition_cost, form.depreciation_group, startYear, startYear)
      return results[0] || null
    } else {
      const results = calculateStraightLine(form.acquisition_cost, form.depreciation_group, startYear, startYear)
      return results[0] || null
    }
  }

  const preview = previewFirstYear()

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Novy majetok</h1>
        <p className="text-muted-foreground">Zaradenie noveho majetku do evidence a odpisovania</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Udaje majetku</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nazov majetku *</Label>
                  <Input
                    id="name"
                    placeholder="napr. Notebook Lenovo ThinkPad"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Popis</Label>
                  <Input
                    id="description"
                    placeholder="Volitelny popis majetku"
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="acquisition_date">Datum obstarania *</Label>
                    <Input
                      id="acquisition_date"
                      type="date"
                      value={form.acquisition_date}
                      onChange={(e) => handleChange("acquisition_date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acquisition_cost">Obstaravacia cena (EUR) *</Label>
                    <Input
                      id="acquisition_cost"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.acquisition_cost || ""}
                      onChange={(e) => handleChange("acquisition_cost", parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                {/* Category selector */}
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="category_id">Kategoria (volitelne)</Label>
                    <select
                      id="category_id"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.category_id}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                    >
                      <option value="">-- Bez kategorie --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} (Sk. {cat.depreciation_group})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Depreciation group */}
                <div className="space-y-2">
                  <Label htmlFor="depreciation_group">Odpisova skupina *</Label>
                  <select
                    id="depreciation_group"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.depreciation_group}
                    onChange={(e) => handleChange("depreciation_group", parseInt(e.target.value))}
                  >
                    {Object.entries(DEPRECIATION_GROUPS).map(([group, info]) => (
                      <option key={group} value={group}>
                        Skupina {group} - {info.useful_life} rokov - {info.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Depreciation method */}
                <div className="space-y-2">
                  <Label>Metoda odpisovania *</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="depreciation_method"
                        value="rovnomerne"
                        checked={form.depreciation_method === "rovnomerne"}
                        onChange={() => handleChange("depreciation_method", "rovnomerne")}
                        className="h-4 w-4"
                      />
                      <div>
                        <span className="font-medium">Rovnomerne</span>
                        <p className="text-xs text-muted-foreground">Rovnaky odpis kazdy rok (SS27 ZDP)</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="depreciation_method"
                        value="zrychlene"
                        checked={form.depreciation_method === "zrychlene"}
                        onChange={() => handleChange("depreciation_method", "zrychlene")}
                        className="h-4 w-4"
                      />
                      <div>
                        <span className="font-medium">Zrychlene</span>
                        <p className="text-xs text-muted-foreground">Vyssi odpis v prvych rokoch (SS28 ZDP)</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Useful life */}
                <div className="space-y-2">
                  <Label htmlFor="useful_life_years">Doba odpisovania (roky)</Label>
                  <Input
                    id="useful_life_years"
                    type="number"
                    min="1"
                    value={form.useful_life_years}
                    onChange={(e) => handleChange("useful_life_years", parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Automaticky nastavene podla odpisovej skupiny. Upravte iba ak je to potrebne.
                  </p>
                </div>

                {/* Group descriptions */}
                <div className="rounded-md border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Odpisove skupiny podla ZDP</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Sk. 0 (2 r.):</strong> Osobne automobily s obstaravacou cenou nad 48 000 EUR</p>
                    <p><strong>Sk. 1 (4 r.):</strong> Stroje, pristroje, zariadenia, osobne automobily, naradie</p>
                    <p><strong>Sk. 2 (6 r.):</strong> Nakladne automobily, autobusy, nabytok, chladiace zariadenia</p>
                    <p><strong>Sk. 3 (8 r.):</strong> Technologicke zariadenia, lode, telekomunikacne zariadenia</p>
                    <p><strong>Sk. 4 (12 r.):</strong> Vyrobne budovy, polnohospodarske stavby, drobne stavby</p>
                    <p><strong>Sk. 5 (20 r.):</strong> Administrativne budovy, obchodne budovy, komunikacie</p>
                    <p><strong>Sk. 6 (40 r.):</strong> Bytove domy, hotely, skolske stavby, nemocnice</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uklada sa...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Vytvorit majetok
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/taxes/depreciation")}>
                    Zrusit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Preview sidebar */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Nahladprveho roku
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Obstaravacia cena</p>
                    <p className="text-lg font-bold">{formatMoney(form.acquisition_cost)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Danovy odpis (1. rok)</p>
                    <p className="text-lg font-bold text-blue-600">{formatMoney(preview.tax_depreciation)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Danova zostatocova hodnota</p>
                    <p className="text-lg font-bold">{formatMoney(preview.tax_net_value)}</p>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">Doba odpisovania</p>
                    <p className="font-medium">{form.useful_life_years} rokov</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Metoda</p>
                    <p className="font-medium">
                      {form.depreciation_method === "zrychlene" ? "Zrychlene" : "Rovnomerne"}
                    </p>
                  </div>

                  {/* Visual bar */}
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Odpis vs. zostatocova hodnota</p>
                    <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                      <div
                        className="bg-blue-500 transition-all"
                        style={{
                          width: `${form.acquisition_cost > 0 ? (preview.tax_depreciation / form.acquisition_cost) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Odpis: {form.acquisition_cost > 0 ? ((preview.tax_depreciation / form.acquisition_cost) * 100).toFixed(1) : 0}%</span>
                      <span>ZH: {form.acquisition_cost > 0 ? ((preview.tax_net_value / form.acquisition_cost) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Zadajte obstaravaciu cenu pre zobrazenie nahladu odpisovania.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
