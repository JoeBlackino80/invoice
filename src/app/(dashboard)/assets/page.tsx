"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Plus,
  Search,
  Building,
  MoreHorizontal,
  Trash2,
  Eye,
  Calculator,
} from "lucide-react"

interface Asset {
  id: string
  name: string
  description: string | null
  acquisition_date: string
  acquisition_cost: number
  depreciation_group: number
  depreciation_method: string
  useful_life_years: number
  status: string
  asset_categories: { id: string; name: string } | null
  latest_depreciation: {
    year: number
    tax_depreciation: number
    accounting_depreciation: number
    tax_residual_value: number
    accounting_residual_value: number
  } | null
}

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: "Aktívny", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  disposed: { label: "Vyradený", class: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
  sold: { label: "Predaný", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  fully_depreciated: { label: "Plne odpísaný", class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
}

const groupFilters = [
  { value: "", label: "Všetky skupiny" },
  { value: "1", label: "Skupina 1 (4 roky)" },
  { value: "2", label: "Skupina 2 (6 rokov)" },
  { value: "3", label: "Skupina 3 (8 rokov)" },
  { value: "4", label: "Skupina 4 (12 rokov)" },
  { value: "5", label: "Skupina 5 (20 rokov)" },
  { value: "6", label: "Skupina 6 (40 rokov)" },
]

const statusFilters = [
  { value: "", label: "Všetky stavy" },
  { value: "active", label: "Aktívne" },
  { value: "disposed", label: "Vyradené" },
  { value: "sold", label: "Predané" },
  { value: "fully_depreciated", label: "Plne odpísané" },
]

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function AssetsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [groupFilter, setGroupFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (groupFilter) params.set("group", groupFilter)
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)

      const res = await fetch(`/api/assets?${params}`)
      const json = await res.json()

      if (res.ok) {
        setAssets(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať majetok" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, groupFilter, statusFilter, search, pagination.page, toast])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť tento majetok?")) return
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Majetok odstránený" })
      fetchAssets()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleDepreciate = async (id: string) => {
    const res = await fetch(`/api/assets/${id}/depreciate`, { method: "POST" })
    if (res.ok) {
      toast({ title: "Odpis vypočítaný" })
      fetchAssets()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Majetok</h1>
          <p className="text-muted-foreground">Evidencia a odpisovanie dlhodobého majetku</p>
        </div>
        <Link href="/taxes/depreciation/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nový majetok
          </Button>
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa názvu, popisu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={groupFilter}
          onChange={(e) => {
            setGroupFilter(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          {groupFilters.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(f.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabuľka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Názov</th>
                  <th className="h-10 px-4 text-left font-medium">Kategória</th>
                  <th className="h-10 px-4 text-left font-medium">Dátum obstarania</th>
                  <th className="h-10 px-4 text-right font-medium">Obstarávacia cena</th>
                  <th className="h-10 px-4 text-center font-medium">Odp. skupina</th>
                  <th className="h-10 px-4 text-right font-medium">Zostatková hodnota</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">Načítavam...</td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatiaľ nemáte žiadny majetok.</p>
                        <Link href="/taxes/depreciation/new" className="text-primary hover:underline text-sm">
                          Pridať prvý majetok
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/taxes/depreciation/${asset.id}`} className="font-medium hover:text-primary">
                          {asset.name}
                        </Link>
                        {asset.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{asset.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {asset.asset_categories?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(asset.acquisition_date)}</td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {formatMoney(asset.acquisition_cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {asset.depreciation_group}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {asset.latest_depreciation
                          ? formatMoney(asset.latest_depreciation.tax_residual_value)
                          : formatMoney(asset.acquisition_cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[asset.status]?.class || ""
                        }`}>
                          {statusLabels[asset.status]?.label || asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === asset.id ? null : asset.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === asset.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/taxes/depreciation/${asset.id}`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Detail
                                </Link>
                                {asset.status === "active" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleDepreciate(asset.id)}
                                  >
                                    <Calculator className="h-3.5 w-3.5" />
                                    Vypočítať odpis
                                  </button>
                                )}
                                <div className="border-t my-1" />
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(asset.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Odstrániť
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

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} majetkov celkovo
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                  Predchádzajúca
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                  Ďalšia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
