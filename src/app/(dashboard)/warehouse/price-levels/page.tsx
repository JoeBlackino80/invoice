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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Pencil,
  Star,
  Tag,
  Calculator,
  Search,
  Loader2,
} from "lucide-react"
import {
  calculateSalePrice,
  calculateMargin,
  calculateAllPriceLevels,
} from "@/lib/warehouse/pricing"
import type { PriceLevel, ProductPricing } from "@/lib/warehouse/pricing"

interface PriceLevelRow {
  id: string
  company_id: string
  name: string
  type: "margin" | "markup"
  percentage: number
  is_default: boolean
}

interface Product {
  id: string
  name: string
  sku: string
  unit_price: number
}

export default function PriceLevelsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [priceLevels, setPriceLevels] = useState<PriceLevelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<PriceLevelRow | null>(null)
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<"margin" | "markup">("markup")
  const [formPercentage, setFormPercentage] = useState("")
  const [formIsDefault, setFormIsDefault] = useState(false)

  // Product pricing preview
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productPricing, setProductPricing] = useState<ProductPricing | null>(null)
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Fetch price levels
  const fetchPriceLevels = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/warehouse/price-levels?company_id=${activeCompanyId}`)
      if (res.ok) {
        const json = await res.json()
        setPriceLevels(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať cenové hladiny" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  // Fetch products for preview
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

  useEffect(() => {
    fetchPriceLevels()
    fetchProducts()
  }, [fetchPriceLevels, fetchProducts])

  // Filter products
  useEffect(() => {
    if (!productSearch.trim()) {
      setFilteredProducts([])
      return
    }
    const q = productSearch.toLowerCase()
    setFilteredProducts(
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        )
        .slice(0, 10)
    )
  }, [productSearch, products])

  // Calculate pricing when product or levels change
  useEffect(() => {
    if (!selectedProduct || priceLevels.length === 0) {
      setProductPricing(null)
      return
    }

    const levels: PriceLevel[] = priceLevels.map((pl) => ({
      id: pl.id,
      company_id: pl.company_id,
      name: pl.name,
      type: pl.type,
      percentage: pl.percentage,
      is_default: pl.is_default,
    }))

    const pricing = calculateAllPriceLevels(
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        sku: selectedProduct.sku || "",
        purchase_price: selectedProduct.unit_price || 0,
      },
      levels
    )
    setProductPricing(pricing)
  }, [selectedProduct, priceLevels])

  // Open dialog for new/edit
  const openCreateDialog = () => {
    setEditingLevel(null)
    setFormName("")
    setFormType("markup")
    setFormPercentage("")
    setFormIsDefault(false)
    setDialogOpen(true)
  }

  const openEditDialog = (level: PriceLevelRow) => {
    setEditingLevel(level)
    setFormName(level.name)
    setFormType(level.type)
    setFormPercentage(level.percentage.toString())
    setFormIsDefault(level.is_default)
    setDialogOpen(true)
  }

  // Save price level
  const savePriceLevel = async () => {
    if (!activeCompanyId || !formName.trim() || !formPercentage) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyplňte všetky povinné polia" })
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        company_id: activeCompanyId,
        name: formName.trim(),
        type: formType,
        percentage: parseFloat(formPercentage),
        is_default: formIsDefault,
      }
      if (editingLevel) {
        payload.id = editingLevel.id
      }

      const res = await fetch("/api/warehouse/price-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({
          title: "Uložené",
          description: editingLevel ? "Cenová hladina bola aktualizovaná" : "Cenová hladina bola vytvorená",
        })
        setDialogOpen(false)
        fetchPriceLevels()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa uložiť" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Chyba pri ukladaní" })
    } finally {
      setSaving(false)
    }
  }

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)
    setProductSearch(product.name)
    setShowProductDropdown(false)
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cenové hladiny</h1>
          <p className="text-muted-foreground">Správa cenových hladín a cenotvorba</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nová cenová hladina
        </Button>
      </div>

      {/* Price levels table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Cenové hladiny
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : priceLevels.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Zatiaľ nemáte žiadne cenové hladiny
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Percento</TableHead>
                  <TableHead>Predvolená</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceLevels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {level.type === "margin" ? "Marža" : "Prirážka"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{level.percentage}%</TableCell>
                    <TableCell>
                      {level.is_default && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(level)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Product pricing preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Náhľad cenotvorby
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Product search */}
            <div className="relative max-w-md">
              <Label className="mb-2 block">Vyberte produkt</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hľadať podľa názvu alebo SKU..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setShowProductDropdown(true)
                    if (!e.target.value) {
                      setSelectedProduct(null)
                      setProductPricing(null)
                    }
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

            {/* Pricing preview table */}
            {productPricing && (
              <div className="mt-4">
                <div className="mb-3 p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    <strong>{productPricing.product_name}</strong>
                    <span className="text-muted-foreground ml-2 font-mono">{productPricing.sku}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nákupná cena: <strong>{formatCurrency(productPricing.purchase_price)}</strong>
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cenová hladina</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Percento</TableHead>
                      <TableHead className="text-right">Predajná cena</TableHead>
                      <TableHead className="text-right">Zisk</TableHead>
                      <TableHead className="text-right">Marža %</TableHead>
                      <TableHead className="text-right">Prirážka %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productPricing.prices.map((price, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{price.level_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {price.level_type === "margin" ? "Marža" : "Prirážka"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{price.percentage}%</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(price.sale_price)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(price.profit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{price.margin_pct}%</TableCell>
                        <TableCell className="text-right font-mono">{price.markup_pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!productPricing && priceLevels.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Vyberte produkt pre zobrazenie cien na rôznych cenových hladinách
              </p>
            )}
            {priceLevels.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Najprv vytvorte cenové hladiny
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLevel ? "Upraviť cenovú hladinu" : "Nová cenová hladina"}
            </DialogTitle>
            <DialogDescription>
              {editingLevel
                ? "Upravte parametre cenovej hladiny"
                : "Vytvorte novú cenovú hladinu pre vaše produkty"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="level-name">Názov</Label>
              <Input
                id="level-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="napr. Maloobchod, Veľkoobchod, VIP"
              />
            </div>

            <div>
              <Label>Typ výpočtu</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as "margin" | "markup")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="markup">Prirážka (markup)</SelectItem>
                  <SelectItem value="margin">Marža (margin)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formType === "markup"
                  ? "Prirážka: predajná = nákupná * (1 + %/100)"
                  : "Marža: predajná = nákupná / (1 - %/100)"}
              </p>
            </div>

            <div>
              <Label htmlFor="level-percentage">Percento (%)</Label>
              <Input
                id="level-percentage"
                type="number"
                min={0}
                max={999}
                step={0.1}
                value={formPercentage}
                onChange={(e) => setFormPercentage(e.target.value)}
                placeholder="napr. 25"
              />
            </div>

            {/* Preview calculation */}
            {formPercentage && parseFloat(formPercentage) > 0 && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-1">Príklad (nákupná cena 100 EUR):</p>
                <p>
                  Predajná cena:{" "}
                  <strong>
                    {formatCurrency(
                      calculateSalePrice(100, parseFloat(formPercentage), formType)
                    )}
                  </strong>
                </p>
                <p>
                  Zisk:{" "}
                  <strong>
                    {formatCurrency(
                      calculateMargin(
                        100,
                        calculateSalePrice(100, parseFloat(formPercentage), formType)
                      ).profit
                    )}
                  </strong>
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="level-default"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="level-default">Predvolená cenová hladina</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={savePriceLevel} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingLevel ? "Uložiť zmeny" : "Vytvoriť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
