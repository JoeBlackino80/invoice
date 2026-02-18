"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  Wallet,
} from "lucide-react"

interface CashRegister {
  id: string
  name: string
  currency: string
  current_balance: number
}

interface CashTransaction {
  id: string
  document_number: string
  type: string
  date: string
  amount: number
  purpose: string
  person: string | null
  posted_at: string | null
  running_balance: number
  cash_register: {
    id: string
    name: string
    currency: string
  } | null
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function CashTransactionsPageContent() {
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [selectedRegister, setSelectedRegister] = useState(searchParams.get("cash_register_id") || "")
  const [typeFilter, setTypeFilter] = useState("vsetky")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  // Fetch cash registers for dropdown
  const fetchRegisters = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/cash-registers?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setRegisters(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  const fetchTransactions = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })

      if (selectedRegister) params.set("cash_register_id", selectedRegister)
      if (typeFilter && typeFilter !== "vsetky") params.set("type", typeFilter)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)
      if (search) params.set("search", search)

      const res = await fetch(`/api/cash-transactions?${params}`)
      const json = await res.json()

      if (res.ok) {
        setTransactions(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat transakcie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedRegister, typeFilter, dateFrom, dateTo, search, pagination.page, toast])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tuto transakciu?")) return
    try {
      const res = await fetch(`/api/cash-transactions/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Transakcia odstranena" })
        fetchTransactions()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit transakciu" })
    }
    setMenuOpen(null)
  }

  const typeFilters = [
    { value: "vsetky", label: "Vsetky" },
    { value: "prijem", label: "PPD" },
    { value: "vydaj", label: "VPD" },
  ]

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pokladnicne doklady</h1>
          <p className="text-muted-foreground">Zoznam prijmovych a vydavkovych pokladnicnych dokladov</p>
        </div>
        <Link href="/cash-register/transactions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy doklad
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Cash register selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Pokladna</label>
          <select
            className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedRegister}
            onChange={(e) => {
              setSelectedRegister(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          >
            <option value="">Vsetky pokladne</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTypeFilter(f.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Date range */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Od</label>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Do</label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hladat podla cisla, ucelu, osoby..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">C. dokladu</th>
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-left font-medium">Ucel</th>
                  <th className="h-10 px-4 text-left font-medium">Osoba</th>
                  <th className="h-10 px-4 text-right font-medium">Suma</th>
                  <th className="h-10 px-4 text-right font-medium">Zostatok</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne transakcie.</p>
                        <Link href="/cash-register/transactions/new" className="text-primary hover:underline text-sm">
                          Vytvorit prvy doklad
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const currency = tx.cash_register?.currency || "EUR"
                    return (
                      <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{tx.document_number}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.type === "prijem"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}>
                            {tx.type === "prijem" ? "PPD" : "VPD"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">{tx.purpose}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.person || "-"}</td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          tx.type === "prijem" ? "text-green-600" : "text-red-600"
                        }`}>
                          {tx.type === "prijem" ? "+" : "-"}{formatMoney(tx.amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatMoney(tx.running_balance, currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="relative inline-block">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setMenuOpen(menuOpen === tx.id ? null : tx.id)}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            {menuOpen === tx.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                  <Link
                                    href={`/api/cash-transactions/${tx.id}`}
                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detail
                                  </Link>
                                  {!tx.posted_at && (
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                      onClick={() => handleDelete(tx.id)}
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} transakcii celkovo
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Predchadzajuca
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Dalsia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CashTransactionsPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <CashTransactionsPageContent />
    </Suspense>
  )
}
