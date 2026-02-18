"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Calculator,
  Search,
  MoreHorizontal,
  Eye,
  PlayCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building,
  TrendingDown,
  BarChart3,
  FolderOpen,
} from "lucide-react"
import { Input } from "@/components/ui/input"

interface AssetSummary {
  asset_id: string
  asset_name: string
  acquisition_cost: number
  depreciation_group: number
  depreciation_method: string
  status: string
  category_name: string | null
  year: number
  is_calculated: boolean
  tax_depreciation: number
  accounting_depreciation: number
  tax_accumulated: number
  accounting_accumulated: number
  tax_net_value: number
  accounting_net_value: number
  difference: number
}

interface GroupSubtotals {
  [group: number]: {
    count: number
    tax_depreciation: number
    accounting_depreciation: number
    difference: number
  }
}

interface SummaryData {
  year: number
  assets: AssetSummary[]
  group_subtotals: GroupSubtotals
  totals: {
    tax_depreciation_total: number
    accounting_depreciation_total: number
    difference_total: number
    asset_count: number
  }
}

const groupDescriptions: Record<number, string> = {
  0: "Sk. 0 - Osobne automobily > 48 000 EUR (2 roky)",
  1: "Sk. 1 - Stroje, pristroje, zariadenia (4 roky)",
  2: "Sk. 2 - Nakladne automobily, nabytok (6 rokov)",
  3: "Sk. 3 - Technologie, lode (8 rokov)",
  4: "Sk. 4 - Vyrobne budovy (12 rokov)",
  5: "Sk. 5 - Administrativne budovy (20 rokov)",
  6: "Sk. 6 - Bytove domy, hotely (40 rokov)",
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function DepreciationPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i)

  const fetchSummary = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/assets/depreciation-summary?company_id=${activeCompanyId}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setSummary(json)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat prehlad" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat prehlad odpisov" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedYear, toast])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleCalculateAll = async () => {
    if (!summary || summary.assets.length === 0) return
    setCalculating(true)

    let successCount = 0
    let errorCount = 0

    for (const asset of summary.assets) {
      if (asset.is_calculated) continue

      try {
        const res = await fetch(`/api/assets/${asset.asset_id}/depreciate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: selectedYear }),
        })
        if (res.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast({
        title: "Odpisy vypocitane",
        description: `Uspesne vypocitane: ${successCount} majetkov${errorCount > 0 ? `, chyby: ${errorCount}` : ""}`,
      })
    } else if (errorCount > 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat odpisy" })
    } else {
      toast({ title: "Vsetky odpisy uz boli vypocitane" })
    }

    setCalculating(false)
    fetchSummary()
  }

  const handleDepreciateSingle = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/depreciate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear }),
      })
      if (res.ok) {
        toast({ title: "Odpis vypocitany" })
        fetchSummary()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat odpis" })
    }
    setMenuOpen(null)
  }

  const handleDispose = async (assetId: string) => {
    // Navigate to asset detail for disposal
    window.location.href = `/taxes/depreciation/${assetId}`
    setMenuOpen(null)
  }

  // Group assets by depreciation group
  const assetsByGroup: Record<number, AssetSummary[]> = {}
  if (summary) {
    for (const asset of summary.assets) {
      if (!assetsByGroup[asset.depreciation_group]) {
        assetsByGroup[asset.depreciation_group] = []
      }
      assetsByGroup[asset.depreciation_group].push(asset)
    }
  }

  const uncalculatedCount = summary?.assets.filter((a) => !a.is_calculated).length || 0

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Danove odpisy</h1>
          <p className="text-muted-foreground">Prehlad danovych a uctovnych odpisov majetku</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/taxes/depreciation/categories">
            <Button variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              Kategorie
            </Button>
          </Link>
          <Link href="/taxes/depreciation/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novy majetok
            </Button>
          </Link>
        </div>
      </div>

      {/* Year selector + Calculate button */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSelectedYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleCalculateAll}
          disabled={calculating || uncalculatedCount === 0}
        >
          <Calculator className="mr-2 h-4 w-4" />
          {calculating
            ? "Pocita sa..."
            : uncalculatedCount > 0
              ? `Vypocitat odpisy za rok ${selectedYear} (${uncalculatedCount})`
              : `Vsetky odpisy za ${selectedYear} su vypocitane`}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Celkove danove odpisy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatMoney(summary?.totals.tax_depreciation_total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              za rok {selectedYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Celkove uctovne odpisy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoney(summary?.totals.accounting_depreciation_total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              za rok {selectedYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rozdiel (dan. - uct.)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.totals.difference_total || 0) !== 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
              {formatMoney(summary?.totals.difference_total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              pre upravu zakladu dane
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pocet majetkov</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totals.asset_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              odpisovanych v roku {selectedYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assets table grouped by depreciation group */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nacitavam prehlad odpisov...
          </CardContent>
        </Card>
      ) : !summary || summary.assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">Zatial nemate ziadny majetok na odpisovanie v roku {selectedYear}.</p>
            <Link href="/taxes/depreciation/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Pridat prvy majetok
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        Object.entries(assetsByGroup)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([group, assets]) => {
            const groupNum = parseInt(group)
            const subtotal = summary.group_subtotals[groupNum]

            return (
              <Card key={group} className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {groupDescriptions[groupNum] || `Skupina ${group}`}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({assets.length} {assets.length === 1 ? "majetok" : assets.length < 5 ? "majetky" : "majetkov"})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium">Nazov</th>
                          <th className="h-10 px-4 text-right font-medium">Obstar. cena</th>
                          <th className="h-10 px-4 text-center font-medium">Metoda</th>
                          <th className="h-10 px-4 text-right font-medium">Danovy odpis</th>
                          <th className="h-10 px-4 text-right font-medium">Uctovny odpis</th>
                          <th className="h-10 px-4 text-right font-medium">Danova ZH</th>
                          <th className="h-10 px-4 text-right font-medium">Uctovna ZH</th>
                          <th className="h-10 px-4 text-right font-medium">Rozdiel</th>
                          <th className="h-10 px-4 text-center font-medium">Stav</th>
                          <th className="h-10 px-4 text-right font-medium">Akcie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map((asset) => {
                          const hasDifference = Math.abs(asset.difference) > 0.01

                          return (
                            <tr
                              key={asset.asset_id}
                              className={`border-b hover:bg-muted/30 transition-colors ${hasDifference ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/taxes/depreciation/${asset.asset_id}`}
                                  className="font-medium hover:text-primary"
                                >
                                  {asset.asset_name}
                                </Link>
                                {asset.category_name && (
                                  <p className="text-xs text-muted-foreground">{asset.category_name}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatMoney(asset.acquisition_cost)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  asset.depreciation_method === "zrychlene"
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                }`}>
                                  {asset.depreciation_method === "zrychlene" ? "Zrychlene" : "Rovnomerne"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">
                                {formatMoney(asset.tax_depreciation)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatMoney(asset.accounting_depreciation)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatMoney(asset.tax_net_value)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatMoney(asset.accounting_net_value)}
                              </td>
                              <td className={`px-4 py-3 text-right font-mono ${hasDifference ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                                {formatMoney(asset.difference)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {asset.is_calculated ? (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    Vypocitane
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    Nevypocitane
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="relative inline-block">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setMenuOpen(menuOpen === asset.asset_id ? null : asset.asset_id)}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                  {menuOpen === asset.asset_id && (
                                    <>
                                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                                        <Link
                                          href={`/taxes/depreciation/${asset.asset_id}`}
                                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                          onClick={() => setMenuOpen(null)}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          Detail
                                        </Link>
                                        {!asset.is_calculated && (
                                          <button
                                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                            onClick={() => handleDepreciateSingle(asset.asset_id)}
                                          >
                                            <PlayCircle className="h-3.5 w-3.5" />
                                            Odpisat
                                          </button>
                                        )}
                                        {asset.status !== "disposed" && (
                                          <>
                                            <div className="border-t my-1" />
                                            <button
                                              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                              onClick={() => handleDispose(asset.asset_id)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                              Vyradit
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Group subtotal row */}
                        {subtotal && (
                          <tr className="bg-muted/30 font-medium">
                            <td className="px-4 py-2 text-muted-foreground" colSpan={3}>
                              Medzisucet skupiny {group}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(subtotal.tax_depreciation)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(subtotal.accounting_depreciation)}
                            </td>
                            <td className="px-4 py-2" colSpan={2} />
                            <td className={`px-4 py-2 text-right font-mono ${Math.abs(subtotal.difference) > 0.01 ? "text-yellow-600" : ""}`}>
                              {formatMoney(subtotal.difference)}
                            </td>
                            <td className="px-4 py-2" colSpan={2} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })
      )}

      {/* Grand total row */}
      {summary && summary.assets.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">Celkom za rok {selectedYear}</span>
              <div className="flex items-center gap-8 text-sm">
                <div className="text-right">
                  <span className="text-muted-foreground mr-2">Danove odpisy:</span>
                  <span className="font-bold font-mono text-blue-600">
                    {formatMoney(summary.totals.tax_depreciation_total)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground mr-2">Uctovne odpisy:</span>
                  <span className="font-bold font-mono text-green-600">
                    {formatMoney(summary.totals.accounting_depreciation_total)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground mr-2">Rozdiel:</span>
                  <span className={`font-bold font-mono ${Math.abs(summary.totals.difference_total) > 0.01 ? "text-yellow-600" : ""}`}>
                    {formatMoney(summary.totals.difference_total)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
