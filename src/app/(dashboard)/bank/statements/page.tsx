"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileText,
  Trash2,
  MoreHorizontal,
  Eye,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  currency: string
}

interface BankStatement {
  id: string
  statement_number: string | null
  date: string
  opening_balance: number
  closing_balance: number
  transaction_count: number
  bank_account: {
    id: string
    name: string
    iban: string
    currency: string
  } | null
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function BankStatementsPageContent() {
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [statements, setStatements] = useState<BankStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [selectedAccount, setSelectedAccount] = useState(searchParams.get("bank_account_id") || "")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

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

  const fetchStatements = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })

      if (selectedAccount) {
        params.set("bank_account_id", selectedAccount)
      }

      const res = await fetch(`/api/bank-statements?${params}`)
      const json = await res.json()

      if (res.ok) {
        setStatements(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat vypisy" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedAccount, pagination.page, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchStatements()
  }, [fetchStatements])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento vypis? Budu odstranene aj vsetky jeho transakcie.")) return
    try {
      const res = await fetch(`/api/bank-statements/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Vypis odstraneny" })
        fetchStatements()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit vypis" })
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bankove vypisy</h1>
          <p className="text-muted-foreground">Prehlad importovanych bankovych vypisov</p>
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Bankovy ucet</label>
          <select
            className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
          >
            <option value="">Vsetky ucty</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.iban})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">C. vypisu</th>
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-left font-medium">Bankovy ucet</th>
                  <th className="h-10 px-4 text-right font-medium">Pociatocny zostatok</th>
                  <th className="h-10 px-4 text-right font-medium">Konecny zostatok</th>
                  <th className="h-10 px-4 text-center font-medium">Pocet transakcii</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : statements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne bankove vypisy.</p>
                        <Link href="/bank/statements/import" className="text-primary hover:underline text-sm">
                          Importovat prvy vypis
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  statements.map((stmt) => {
                    const currency = stmt.bank_account?.currency || "EUR"
                    return (
                      <tr key={stmt.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {stmt.statement_number || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(stmt.date)}
                        </td>
                        <td className="px-4 py-3">
                          {stmt.bank_account?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(stmt.opening_balance, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(stmt.closing_balance, currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {stmt.transaction_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="relative inline-block">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setMenuOpen(menuOpen === stmt.id ? null : stmt.id)}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            {menuOpen === stmt.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
                                  <Link
                                    href={`/bank/transactions?bank_statement_id=${stmt.id}`}
                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Zobrazit transakcie
                                  </Link>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                    onClick={() => handleDelete(stmt.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Odstranit
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
                {pagination.total} vypisov celkovo
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

export default function BankStatementsPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <BankStatementsPageContent />
    </Suspense>
  )
}
