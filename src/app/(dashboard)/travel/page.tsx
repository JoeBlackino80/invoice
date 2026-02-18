"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Search,
  Plane,
  Car,
  MapPin,
  Calendar,
  FileText,
  Globe,
  Home,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  DOMESTIC_MEAL_RATES,
  FOREIGN_PER_DIEM_RATES,
  VEHICLE_RATE_PER_KM,
} from "@/lib/travel/travel-calculator"

// ---------- types ----------

interface TravelOrderRow {
  id: string
  employee_id: string
  type: "tuzemsky" | "zahranicny"
  purpose: string
  destination: string
  country: string | null
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  transport_type: string
  status: string
  total_amount: number | null
  advance_amount: number | null
  advance_currency: string
  employee: { id: string; name: string; surname: string } | null
}

// ---------- labels ----------

const statusLabels: Record<string, string> = {
  draft: "Koncept",
  approved: "Schvaleny",
  completed: "Dokonceny",
  settled: "Vyuctovany",
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  settled:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
}

const typeLabels: Record<string, string> = {
  tuzemsky: "Tuzemsky",
  zahranicny: "Zahranicny",
}

const typeColors: Record<string, string> = {
  tuzemsky: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  zahranicny:
    "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
}

const statusFilterOptions = [
  { value: "vsetky", label: "Vsetky" },
  { value: "draft", label: "Koncept" },
  { value: "approved", label: "Schvaleny" },
  { value: "completed", label: "Dokonceny" },
  { value: "settled", label: "Vyuctovany" },
]

const typeFilterOptions = [
  { value: "vsetky", label: "Vsetky typy" },
  { value: "tuzemsky", label: "Tuzemsky" },
  { value: "zahranicny", label: "Zahranicny" },
]

type Tab = "prikazy" | "sadzby"

// ---------- component ----------

export default function TravelPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>("prikazy")
  const [orders, setOrders] = useState<TravelOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("vsetky")
  const [statusFilter, setStatusFilter] = useState("vsetky")
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [ratesSearch, setRatesSearch] = useState("")

  const fetchOrders = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (search) params.set("search", search)
      if (typeFilter !== "vsetky") params.set("type", typeFilter)
      if (statusFilter !== "vsetky") params.set("status", statusFilter)

      const res = await fetch(`/api/travel-orders?${params}`)
      const json = await res.json()

      if (res.ok) {
        setOrders(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat cestovne prikazy",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, search, typeFilter, statusFilter, pagination.page, toast])

  useEffect(() => {
    if (activeTab === "prikazy") {
      fetchOrders()
    }
  }, [fetchOrders, activeTab])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento cestovny prikaz?")) return
    const res = await fetch(`/api/travel-orders/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Cestovny prikaz odstraneny" })
      fetchOrders()
    } else {
      const json = await res.json()
      toast({
        variant: "destructive",
        title: "Chyba",
        description: json.error || "Nepodarilo sa odstranit",
      })
    }
    setMenuOpen(null)
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("sk-SK")
    } catch {
      return date
    }
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-"
    return amount.toLocaleString("sk-SK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Foreign per diem list for the Sadzby tab
  const foreignRateEntries = Array.from(
    Object.entries(FOREIGN_PER_DIEM_RATES)
  )
    .filter(([code, info]) => {
      if (!ratesSearch) return true
      const s = ratesSearch.toLowerCase()
      return (
        code.toLowerCase().includes(s) ||
        info.country_sk.toLowerCase().includes(s)
      )
    })
    .sort((a, b) => a[1].country_sk.localeCompare(b[1].country_sk))

  // ---------- tabs ----------

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "prikazy", label: "Cestovne prikazy", icon: Plane },
    { id: "sadzby", label: "Sadzby", icon: FileText },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cestovne prikazy
          </h1>
          <p className="text-muted-foreground">
            Sprava cestovnych prikazov a vyuctovanie pracovnych ciest
          </p>
        </div>
        <Link href="/travel/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy cestovny prikaz
          </Button>
        </Link>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Cestovne prikazy */}
      {activeTab === "prikazy" && (
        <>
          {/* Filtre */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Hladat podla destinacie, ucelu..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {typeFilterOptions.map((f) => (
                <Button
                  key={f.value}
                  variant={typeFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTypeFilter(f.value)
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                >
                  {f.value === "tuzemsky" && (
                    <Home className="mr-1 h-3.5 w-3.5" />
                  )}
                  {f.value === "zahranicny" && (
                    <Globe className="mr-1 h-3.5 w-3.5" />
                  )}
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {statusFilterOptions.map((f) => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? "secondary" : "outline"}
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

          {/* Tabulka */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">
                        C.
                      </th>
                      <th className="h-10 px-4 text-left font-medium">
                        Zamestnanec
                      </th>
                      <th className="h-10 px-4 text-left font-medium">
                        Typ
                      </th>
                      <th className="h-10 px-4 text-left font-medium">
                        Destinacia
                      </th>
                      <th className="h-10 px-4 text-left font-medium">
                        Datumy
                      </th>
                      <th className="h-10 px-4 text-center font-medium">
                        Stav
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Suma
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Akcie
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Nacitavam...
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          <div>
                            <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Zatial nemate ziadne cestovne prikazy.</p>
                            <Link
                              href="/travel/new"
                              className="text-primary hover:underline text-sm"
                            >
                              Vytvorit prvy cestovny prikaz
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order, index) => (
                        <tr
                          key={order.id}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {(pagination.page - 1) * 25 + index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/travel/${order.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {order.employee
                                ? `${order.employee.name} ${order.employee.surname}`
                                : "-"}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                typeColors[order.type] || ""
                              }`}
                            >
                              {order.type === "zahranicny" && (
                                <Globe className="mr-1 h-3 w-3" />
                              )}
                              {order.type === "tuzemsky" && (
                                <Home className="mr-1 h-3 w-3" />
                              )}
                              {typeLabels[order.type] || order.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {order.destination}
                              {order.country && (
                                <span className="text-muted-foreground text-xs">
                                  ({order.country})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(order.departure_date)} -{" "}
                              {formatDate(order.arrival_date)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                statusColors[order.status] || ""
                              }`}
                            >
                              {statusLabels[order.status] || order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatAmount(order.total_amount)} EUR
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-block">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setMenuOpen(
                                    menuOpen === order.id ? null : order.id
                                  )
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              {menuOpen === order.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setMenuOpen(null)}
                                  />
                                  <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
                                    <Link
                                      href={`/travel/${order.id}`}
                                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => setMenuOpen(null)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </Link>
                                    {order.status === "draft" && (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                        onClick={() => handleDelete(order.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Odstranit
                                      </button>
                                    )}
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

              {/* Strankovanie */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {pagination.total} cestovnych prikazov celkovo
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page - 1,
                        }))
                      }
                    >
                      Predchadzajuca
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page + 1,
                        }))
                      }
                    >
                      Dalsia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Sadzby */}
      {activeTab === "sadzby" && (
        <div className="space-y-6">
          {/* Tuzemske sadzby */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Tuzemske sadzby stravneho (2025)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">
                        Trvanie cesty
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Sadzba
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">5 az 12 hodin</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {DOMESTIC_MEAL_RATES.tier1.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">12 az 18 hodin</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {DOMESTIC_MEAL_RATES.tier2.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Nad 18 hodin</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {DOMESTIC_MEAL_RATES.tier3.rate.toFixed(2)} EUR
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Znizenie stravneho pri poskytnutom jedle:</strong>
                </p>
                <ul className="list-disc list-inside ml-2">
                  <li>Ranajky: 25 %</li>
                  <li>Obed: 40 %</li>
                  <li>Vecera: 35 %</li>
                </ul>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Car className="h-4 w-4" />
                  <strong>Nahrada za pouzitie sukromneho vozidla</strong>
                </div>
                <p>
                  Sadzba: {VEHICLE_RATE_PER_KM} EUR/km + naklady na pohonne
                  hmoty (spotreba podla TP)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Zahranicne sadzby */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Zahranicne diéty – denne sadzby
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Hladat krajinu..."
                    className="pl-9"
                    value={ratesSearch}
                    onChange={(e) => setRatesSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">
                        Kod
                      </th>
                      <th className="h-10 px-4 text-left font-medium">
                        Krajina
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Denna sadzba
                      </th>
                      <th className="h-10 px-4 text-center font-medium">
                        Mena
                      </th>
                      <th className="h-10 px-4 text-right font-medium">
                        Max. vreckove (40%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {foreignRateEntries.map(([code, info]) => (
                      <tr key={code} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">
                          {code}
                        </td>
                        <td className="px-4 py-2">{info.country_sk}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {info.rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {info.currency}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {(info.rate * 0.4).toFixed(2)} {info.currency}
                        </td>
                      </tr>
                    ))}
                    {foreignRateEntries.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="h-16 text-center text-muted-foreground"
                        >
                          Ziadne vysledky pre "{ratesSearch}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                <p>
                  Podla Opatrenia MF SR o sumach zakladnej nahrady za pouzivanie
                  cestnych motorovych vozidiel pri pracovnych cestach a o sumach
                  stravneho pri zahranicnych pracovnych cestach.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
