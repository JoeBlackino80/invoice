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
  Search,
  Landmark,
  Upload,
  Eye,
  MoreHorizontal,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  currency: string
}

interface BankTransaction {
  id: string
  date: string
  amount: number
  type: "credit" | "debit"
  counterparty_name: string | null
  counterparty_iban: string | null
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  description: string | null
  reference: string | null
  status: "neparovana" | "parovana" | "zauctovana"
  invoice_id: string | null
  bank_account: {
    id: string
    name: string
    iban: string
    currency: string
  } | null
  invoice: {
    id: string
    number: string
    total_amount: number
  } | null
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function getStatusBadge(status: string) {
  switch (status) {
    case "neparovana":
      return {
        label: "Nesparovana",
        className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      }
    case "parovana":
      return {
        label: "Sparovana",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      }
    case "zauctovana":
      return {
        label: "Zauctovana",
        className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      }
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
      }
  }
}

const txRowStyle = (status: string) => {
  if (status === "neparovana") return "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500"
  if (status === "parovana") return "bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-l-yellow-400"
  return "" // zauctovana - default
}

function BankTransactionsPageContent() {
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [selectedAccount, setSelectedAccount] = useState(searchParams.get("bank_account_id") || "")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "vsetky")
  const [typeFilter, setTypeFilter] = useState("vsetky")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  const bankStatementId = searchParams.get("bank_statement_id") || ""

  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/bank-accounts?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setAccounts(json.data || [])
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

      if (selectedAccount) params.set("bank_account_id", selectedAccount)
      if (bankStatementId) params.set("bank_statement_id", bankStatementId)
      if (statusFilter && statusFilter !== "vsetky") params.set("status", statusFilter)
      if (typeFilter && typeFilter !== "vsetky") params.set("type", typeFilter)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)
      if (search) params.set("search", search)

      const res = await fetch(`/api/bank-transactions?${params}`)
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
  }, [activeCompanyId, selectedAccount, bankStatementId, statusFilter, typeFilter, dateFrom, dateTo, search, pagination.page, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const statusFilters = [
    { value: "vsetky", label: "Vsetky" },
    { value: "neparovana", label: "Nesparovane" },
    { value: "parovana", label: "Sparovane" },
    { value: "zauctovana", label: "Zauctovane" },
  ]

  const typeFilters = [
    { value: "vsetky", label: "Vsetky" },
    { value: "credit", label: "Prijem" },
    { value: "debit", label: "Vydaj" },
  ]

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bankove transakcie</h1>
          <p className="text-muted-foreground">
            {bankStatementId
              ? "Transakcie z bankoveho vypisu"
              : "Prehlad vsetkych bankovych transakcii"
            }
          </p>
        </div>
        <Link href="/bank/statements/import">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Import vypisu
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Bank account selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Bankovy ucet</label>
          <select
            className="flex h-10 w-56 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          >
            <option value="">Vsetky ucty</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Stav</label>
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

        {/* Type filter */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Typ</label>
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
            placeholder="Hladat podla protiuctu, VS, popisu..."
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
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-right font-medium">Suma</th>
                  <th className="h-10 px-4 text-left font-medium">Protiucet</th>
                  <th className="h-10 px-4 text-left font-medium">VS</th>
                  <th className="h-10 px-4 text-left font-medium">Popis</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-left font-medium">Faktura</th>
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
                        <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne bankove transakcie.</p>
                        <Link href="/bank/statements/import" className="text-primary hover:underline text-sm">
                          Importovat bankovy vypis
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const currency = tx.bank_account?.currency || "EUR"
                    const badge = getStatusBadge(tx.status)
                    return (
                      <tr key={tx.id} className={`border-b hover:bg-muted/30 transition-colors ${txRowStyle(tx.status)}`}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                          tx.type === "credit" ? "text-green-600" : "text-red-600"
                        }`}>
                          {tx.amount >= 0 ? "+" : ""}{formatMoney(tx.amount, currency)}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="truncate">
                            {tx.counterparty_name || "-"}
                          </div>
                          {tx.counterparty_iban && (
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {tx.counterparty_iban}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {tx.variable_symbol || "-"}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="truncate text-muted-foreground">
                            {tx.description || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {tx.invoice ? (
                            <Link
                              href={`/invoices/${tx.invoice.id}/edit`}
                              className="text-primary hover:underline text-xs"
                            >
                              {tx.invoice.number}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
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
                                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => {
                                      setMenuOpen(null)
                                      // In a full implementation, this would open a detail/matching modal
                                      toast({ title: "Detail transakcie", description: `ID: ${tx.id}` })
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detail
                                  </button>
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

export default function BankTransactionsPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <BankTransactionsPageContent />
    </Suspense>
  )
}
