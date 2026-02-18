"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Separator } from "@/components/ui/separator"
import {
  ClipboardCheck,
  Save,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Package,
  Loader2,
} from "lucide-react"

interface Warehouse {
  id: string
  name: string
}

interface InventoryProduct {
  product_id: string
  product_name: string
  sku: string
  expected_quantity: number
  unit_price: number
  category: string | null
  product_type: string
}

interface InventoryItemState extends InventoryProduct {
  actual_quantity: number | ""
  difference: number
  value_difference: number
}

interface PastInventory {
  id: string
  warehouse_id: string
  inventory_date: string
  status: string
  total_differences: number
  total_value_difference: number
  created_at: string
}

export default function WarehouseInventoryPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Inventory items
  const [items, setItems] = useState<InventoryItemState[]>([])
  const [isNewInventory, setIsNewInventory] = useState(false)

  // Past inventories
  const [pastInventories, setPastInventories] = useState<PastInventory[]>([])

  // Fetch warehouses
  const fetchWarehouses = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/warehouse/inventory?company_id=${activeCompanyId}&mode=list`)
      // Use a separate endpoint or fetch from warehouses table
      const whRes = await fetch(`/api/lookup?type=warehouses&company_id=${activeCompanyId}`)
      if (whRes.ok) {
        const json = await whRes.json()
        setWarehouses(json.data || [])
      }
    } catch {
      // Fallback if lookup endpoint doesn't exist
    }
  }, [activeCompanyId])

  // Fetch past inventories
  const fetchPastInventories = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        mode: "list",
      })
      if (selectedWarehouse) {
        params.set("warehouse_id", selectedWarehouse)
      }
      const res = await fetch(`/api/warehouse/inventory?${params}`)
      if (res.ok) {
        const json = await res.json()
        setPastInventories(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId, selectedWarehouse])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  useEffect(() => {
    fetchPastInventories()
  }, [fetchPastInventories])

  // Start new inventory
  const startNewInventory = async () => {
    if (!activeCompanyId || !selectedWarehouse) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyberte sklad" })
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        warehouse_id: selectedWarehouse,
      })
      const res = await fetch(`/api/warehouse/inventory?${params}`)
      if (res.ok) {
        const json = await res.json()
        const products: InventoryProduct[] = json.data || []
        setItems(
          products.map((p) => ({
            ...p,
            actual_quantity: "",
            difference: 0,
            value_difference: 0,
          }))
        )
        setIsNewInventory(true)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa načítať produkty" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Chyba pri načítaní" })
    } finally {
      setLoading(false)
    }
  }

  // Update actual quantity
  const updateActualQuantity = (productId: string, value: string) => {
    const numValue = value === "" ? "" : parseFloat(value)
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        const actualQty = numValue === "" ? 0 : numValue
        const diff = actualQty - item.expected_quantity
        return {
          ...item,
          actual_quantity: numValue,
          difference: Math.round(diff * 100) / 100,
          value_difference: Math.round(diff * item.unit_price * 100) / 100,
        }
      })
    )
  }

  // Save draft
  const saveDraft = async () => {
    if (!activeCompanyId || !selectedWarehouse) return

    setSaving(true)
    try {
      const inventoryItems = items.map((item) => ({
        product_id: item.product_id,
        actual_quantity: item.actual_quantity === "" ? item.expected_quantity : item.actual_quantity,
      }))

      const res = await fetch("/api/warehouse/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          warehouse_id: selectedWarehouse,
          items: inventoryItems,
          inventory_date: new Date().toISOString().split("T")[0],
          confirm: false,
        }),
      })

      if (res.ok) {
        toast({ title: "Uložené", description: "Inventúra bola uložená ako koncept" })
        fetchPastInventories()
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

  // Confirm inventory
  const confirmInventory = async () => {
    if (!activeCompanyId || !selectedWarehouse) return

    setConfirming(true)
    try {
      const inventoryItems = items.map((item) => ({
        product_id: item.product_id,
        actual_quantity: item.actual_quantity === "" ? item.expected_quantity : item.actual_quantity,
      }))

      const res = await fetch("/api/warehouse/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          warehouse_id: selectedWarehouse,
          items: inventoryItems,
          inventory_date: new Date().toISOString().split("T")[0],
          confirm: true,
          product_type: "material",
        }),
      })

      if (res.ok) {
        toast({ title: "Potvrdené", description: "Inventúra bola potvrdená a stavy upravené" })
        setIsNewInventory(false)
        setItems([])
        fetchPastInventories()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa potvrdiť" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Chyba pri potvrdzovaní" })
    } finally {
      setConfirming(false)
    }
  }

  // Summary calculations
  const summary = {
    total: items.length,
    matches: items.filter((i) => i.difference === 0 && i.actual_quantity !== "").length,
    shortages: items.filter((i) => i.difference < 0).length,
    surpluses: items.filter((i) => i.difference > 0).length,
    totalValueDifference: items.reduce((s, i) => s + i.value_difference, 0),
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value)

  const getDifferenceColor = (diff: number, actualQty: number | "") => {
    if (actualQty === "") return ""
    if (diff < 0) return "text-red-600 bg-red-50"
    if (diff > 0) return "text-blue-600 bg-blue-50"
    return "text-green-600 bg-green-50"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventúra</h1>
          <p className="text-muted-foreground">Fyzická inventúra skladu</p>
        </div>
      </div>

      {/* Warehouse selection and action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium mb-2 block">Sklad</label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte sklad" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                  {warehouses.length === 0 && (
                    <SelectItem value="__empty" disabled>
                      Žiadne sklady
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startNewInventory} disabled={!selectedWarehouse || loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="mr-2 h-4 w-4" />
              )}
              Nová inventúra
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active inventory */}
      {isNewInventory && items.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Celkom produktov
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{summary.total}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Zhody
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-green-600">{summary.matches}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Manká
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-600">{summary.shortages}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Prebytky
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-blue-600">{summary.surpluses}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hodnota rozdielov
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-2xl font-bold">
                    {formatCurrency(summary.totalValueDifference)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Inventory table */}
          <Card>
            <CardHeader>
              <CardTitle>Inventúrny zoznam</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Názov</TableHead>
                    <TableHead className="text-right w-[120px]">Evidovaný stav</TableHead>
                    <TableHead className="text-right w-[140px]">Skutočný stav</TableHead>
                    <TableHead className="text-right w-[100px]">Rozdiel</TableHead>
                    <TableHead className="text-right w-[140px]">Hodnota rozdielu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.product_id}
                      className={getDifferenceColor(item.difference, item.actual_quantity)}
                    >
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.expected_quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={item.actual_quantity}
                          onChange={(e) =>
                            updateActualQuantity(item.product_id, e.target.value)
                          }
                          className="w-[120px] ml-auto text-right"
                          placeholder="--"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.actual_quantity !== "" ? (
                          <span className="flex items-center justify-end gap-1">
                            {item.difference > 0 && <ArrowUp className="h-3 w-3" />}
                            {item.difference < 0 && <ArrowDown className="h-3 w-3" />}
                            {item.difference === 0 && <Minus className="h-3 w-3" />}
                            {item.difference}
                          </span>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.actual_quantity !== ""
                          ? formatCurrency(item.value_difference)
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={saveDraft} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Uložiť
            </Button>
            <Button onClick={confirmInventory} disabled={confirming}>
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Potvrdiť inventúru
            </Button>
          </div>
        </>
      )}

      <Separator />

      {/* Past inventories */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Predchádzajúce inventúry</h2>
        {pastInventories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Žiadne inventúry
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Počet rozdielov</TableHead>
                    <TableHead className="text-right">Hodnota rozdielov</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastInventories.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {new Date(inv.inventory_date || inv.created_at).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={inv.status === "confirmed" ? "default" : "secondary"}
                        >
                          {inv.status === "confirmed" ? "Potvrdená" : "Koncept"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{inv.total_differences}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.total_value_difference || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
