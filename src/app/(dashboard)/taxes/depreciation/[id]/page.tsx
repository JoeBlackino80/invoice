"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Building,
  Calendar,
  TrendingDown,
  Calculator,
  Trash2,
  Loader2,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react"

interface DepreciationYear {
  year: number
  tax_depreciation: number
  tax_accumulated: number
  tax_net_value: number
  accounting_depreciation: number
  accounting_accumulated: number
  accounting_net_value: number
  difference: number
}

interface AssetMovement {
  id: string
  type: string
  date: string
  amount: number
  description: string
}

interface AssetDetail {
  id: string
  name: string
  description: string | null
  acquisition_date: string
  acquisition_cost: number
  depreciation_group: number
  depreciation_method: string
  useful_life_years: number
  status: string
  disposed_at: string | null
  disposed_reason: string | null
  tax_residual_value: number
  accounting_residual_value: number
  asset_categories: { id: string; name: string } | null
  depreciations: any[]
  movements: AssetMovement[]
  schedule: {
    years: DepreciationYear[]
    total_tax_depreciation: number
    total_accounting_depreciation: number
    is_fully_depreciated: boolean
  }
}

const reasonLabels: Record<string, string> = {
  predaj: "Predaj",
  likvidacia: "Likvidacia",
  strata: "Strata",
  dar: "Darovanie",
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDisposeForm, setShowDisposeForm] = useState(false)
  const [disposing, setDisposing] = useState(false)
  const [disposeForm, setDisposeForm] = useState({
    disposed_reason: "likvidacia",
    disposed_date: new Date().toISOString().split("T")[0],
    sale_amount: 0,
  })

  const assetId = params.id as string

  const fetchAsset = useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}`)
      const json = await res.json()
      if (res.ok) {
        setAsset(json)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Majetok nenajdeny" })
        router.push("/taxes/depreciation")
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat majetok" })
    } finally {
      setLoading(false)
    }
  }, [assetId, toast, router])

  useEffect(() => {
    fetchAsset()
  }, [fetchAsset])

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisposing(true)

    try {
      const res = await fetch(`/api/assets/${assetId}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...disposeForm,
          sale_amount: disposeForm.disposed_reason === "predaj" ? Number(disposeForm.sale_amount) : undefined,
        }),
      })

      if (res.ok) {
        toast({ title: "Majetok vyradeny", description: "Majetok bol uspesne vyradeny z evidencie." })
        fetchAsset()
        setShowDisposeForm(false)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vyradit majetok" })
    } finally {
      setDisposing(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb />
        <div className="py-12 text-center text-muted-foreground">Nacitavam detail majetku...</div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div>
        <Breadcrumb />
        <div className="py-12 text-center text-muted-foreground">Majetok nenajdeny</div>
      </div>
    )
  }

  // Build a set of already-calculated years
  const calculatedYears = new Set(asset.depreciations.map((d: any) => d.year))

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/taxes/depreciation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{asset.name}</h1>
            <p className="text-muted-foreground">
              {asset.description || "Detail majetku a odpisovy plan"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {asset.status !== "disposed" && (
            <Button variant="destructive" onClick={() => setShowDisposeForm(!showDisposeForm)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Vyradit majetok
            </Button>
          )}
        </div>
      </div>

      {/* Asset info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              Obstaravacia cena
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(asset.acquisition_cost)}</div>
            {asset.asset_categories && (
              <p className="text-xs text-muted-foreground mt-1">{asset.asset_categories.name}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Datum obstarania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(asset.acquisition_date)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Skupina {asset.depreciation_group} | {asset.useful_life_years} rokov
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              Metoda odpisovania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {asset.depreciation_method === "zrychlene" ? "Zrychlene" : "Rovnomerne"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {asset.depreciation_method === "zrychlene" ? "SS28 ZDP" : "SS27 ZDP"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Stav
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {asset.status === "disposed" ? (
                <span className="text-red-600">Vyradeny</span>
              ) : asset.schedule.is_fully_depreciated ? (
                <span className="text-green-600">Plne odpisany</span>
              ) : (
                <span className="text-blue-600">Aktivny</span>
              )}
            </div>
            {asset.disposed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {reasonLabels[asset.disposed_reason || ""] || asset.disposed_reason} - {formatDate(asset.disposed_at)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispose form */}
      {showDisposeForm && asset.status !== "disposed" && (
        <Card className="mb-6 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Vyradenie majetku</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDispose} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Dovod vyradenia</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disposeForm.disposed_reason}
                    onChange={(e) => setDisposeForm((prev) => ({ ...prev, disposed_reason: e.target.value }))}
                  >
                    <option value="predaj">Predaj</option>
                    <option value="likvidacia">Likvidacia</option>
                    <option value="strata">Strata</option>
                    <option value="dar">Darovanie</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Datum vyradenia</Label>
                  <Input
                    type="date"
                    value={disposeForm.disposed_date}
                    onChange={(e) => setDisposeForm((prev) => ({ ...prev, disposed_date: e.target.value }))}
                    required
                  />
                </div>
                {disposeForm.disposed_reason === "predaj" && (
                  <div className="space-y-2">
                    <Label>Predajna cena (EUR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={disposeForm.sale_amount || ""}
                      onChange={(e) =>
                        setDisposeForm((prev) => ({ ...prev, sale_amount: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="destructive" disabled={disposing}>
                  {disposing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vyraduje sa...
                    </>
                  ) : (
                    "Potvrdit vyradenie"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowDisposeForm(false)}>
                  Zrusit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Full depreciation schedule table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Odpisovy plan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Rok</th>
                  <th className="h-10 px-4 text-right font-medium">Danovy odpis</th>
                  <th className="h-10 px-4 text-right font-medium">Kumulovany</th>
                  <th className="h-10 px-4 text-right font-medium">Danova ZH</th>
                  <th className="h-10 px-4 text-right font-medium">Uctovny odpis</th>
                  <th className="h-10 px-4 text-right font-medium">Kumulovany</th>
                  <th className="h-10 px-4 text-right font-medium">Uctovna ZH</th>
                  <th className="h-10 px-4 text-right font-medium">Rozdiel</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                </tr>
              </thead>
              <tbody>
                {asset.schedule.years.map((year) => {
                  const isCalculated = calculatedYears.has(year.year)
                  const hasDifference = Math.abs(year.difference) > 0.01
                  const depPercent = asset.acquisition_cost > 0
                    ? (year.tax_accumulated / asset.acquisition_cost) * 100
                    : 0

                  return (
                    <tr
                      key={year.year}
                      className={`border-b hover:bg-muted/30 transition-colors ${hasDifference ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium">{year.year}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-blue-600">
                        {formatMoney(year.tax_depreciation)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(year.tax_accumulated)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(year.tax_net_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">
                        {formatMoney(year.accounting_depreciation)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(year.accounting_accumulated)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(year.accounting_net_value)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${hasDifference ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                        {formatMoney(year.difference)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCalculated ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle className="h-3 w-3" />
                            Ulozene
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            <Clock className="h-3 w-3" />
                            Plan
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* Totals row */}
                <tr className="bg-muted/30 font-bold">
                  <td className="px-4 py-3">Celkom</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">
                    {formatMoney(asset.schedule.total_tax_depreciation)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    {formatMoney(asset.schedule.total_accounting_depreciation)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(0)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CSS bar visualization of declining value */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Priebeh odpisovania
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {asset.schedule.years.map((year) => {
              const depPercent = asset.acquisition_cost > 0
                ? (year.tax_depreciation / asset.acquisition_cost) * 100
                : 0
              const netPercent = asset.acquisition_cost > 0
                ? (year.tax_net_value / asset.acquisition_cost) * 100
                : 0
              const accPercent = asset.acquisition_cost > 0
                ? (year.tax_accumulated / asset.acquisition_cost) * 100
                : 0

              return (
                <div key={year.year} className="flex items-center gap-3">
                  <span className="w-12 text-sm font-mono text-muted-foreground shrink-0">{year.year}</span>
                  <div className="flex-1 flex h-6 rounded-full overflow-hidden bg-muted">
                    <div
                      className="bg-blue-200 dark:bg-blue-900 transition-all"
                      style={{ width: `${accPercent - depPercent}%` }}
                      title={`Predchadzajuce odpisy: ${formatMoney(year.tax_accumulated - year.tax_depreciation)}`}
                    />
                    <div
                      className="bg-blue-500 transition-all"
                      style={{ width: `${depPercent}%` }}
                      title={`Odpis za rok: ${formatMoney(year.tax_depreciation)}`}
                    />
                    <div
                      className="bg-green-100 dark:bg-green-900/30 transition-all"
                      style={{ width: `${netPercent}%` }}
                      title={`Zostatocova hodnota: ${formatMoney(year.tax_net_value)}`}
                    />
                  </div>
                  <span className="w-24 text-xs font-mono text-right text-muted-foreground shrink-0">
                    {formatMoney(year.tax_net_value)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
              Predchadzajuce odpisy
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              Odpis za rok
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/30" />
              Zostatocova hodnota
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movement history */}
      {asset.movements && asset.movements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Historia pohybov
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Datum</th>
                    <th className="h-10 px-4 text-left font-medium">Typ</th>
                    <th className="h-10 px-4 text-left font-medium">Popis</th>
                    <th className="h-10 px-4 text-right font-medium">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.movements.map((movement) => (
                    <tr key={movement.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(movement.date)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                          {reasonLabels[movement.type] || movement.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{movement.description}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {movement.amount > 0 ? formatMoney(movement.amount) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
