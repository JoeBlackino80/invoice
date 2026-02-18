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
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Upload,
  Link2,
  FileText,
  Trash2,
  MoreHorizontal,
  AlertCircle,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  bic: string | null
  currency: string
  bank_name: string | null
  account_number: string
  opening_balance: number
  current_balance: number
  unmatched_count: number
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

export default function BankPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/bank-accounts?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setAccounts(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat bankove ucty" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento bankovy ucet?")) return
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Bankovy ucet odstraneny" })
        fetchAccounts()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit bankovy ucet" })
    }
    setMenuOpen(null)
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)
  const totalUnmatched = accounts.reduce((sum, acc) => sum + acc.unmatched_count, 0)

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banka</h1>
          <p className="text-muted-foreground">Sprava bankovych uctov, vypisov a transakcii</p>
        </div>
        <Link href="/bank/accounts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy bankovy ucet
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Celkovy zostatok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pocet uctov: {accounts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nesparovane transakcie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalUnmatched > 0 ? "text-yellow-600" : "text-green-600"}`}>
              {totalUnmatched}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalUnmatched > 0 ? "Vyzaduju pozornost" : "Vsetko sparovane"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rychle akcie</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/bank/statements/import">
              <Button variant="outline" size="sm" className="gap-1">
                <Upload className="h-3.5 w-3.5" />
                Import vypisu
              </Button>
            </Link>
            <Link href="/bank/transactions?status=neparovana">
              <Button variant="outline" size="sm" className="gap-1">
                <Link2 className="h-3.5 w-3.5" />
                Parovanie
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/bank/statements/import">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            Import vypisu
          </Button>
        </Link>
        <Link href="/bank/statements">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Vypisy
          </Button>
        </Link>
        <Link href="/bank/transactions">
          <Button variant="outline" className="gap-2">
            <Landmark className="h-4 w-4" />
            Vsetky transakcie
          </Button>
        </Link>
        <Link href="/bank/transactions?status=neparovana">
          <Button variant="outline" className="gap-2">
            <Link2 className="h-4 w-4 text-yellow-600" />
            Parovanie transakcii
          </Button>
        </Link>
      </div>

      {/* Bank account cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">Zatial nemate ziadny bankovy ucet.</p>
            <Link href="/bank/accounts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Vytvorit prvy bankovy ucet
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="relative">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Landmark className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold truncate">{account.name}</CardTitle>
                    {account.bank_name && (
                      <p className="text-xs text-muted-foreground truncate">{account.bank_name}</p>
                    )}
                  </div>
                </div>
                <div className="relative shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {menuOpen === account.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                        <Link
                          href={`/bank/transactions?bank_account_id=${account.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          Transakcie
                        </Link>
                        <Link
                          href={`/bank/statements?bank_account_id=${account.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Vypisy
                        </Link>
                        <Link
                          href={`/bank/statements/import?bank_account_id=${account.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Import vypisu
                        </Link>
                        <button
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                          onClick={() => handleDelete(account.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Odstranit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${account.current_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatMoney(account.current_balance, account.currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  {account.iban}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Ucet: {account.account_number} | {account.currency}
                  </p>
                  {account.unmatched_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      <AlertCircle className="h-3 w-3" />
                      {account.unmatched_count}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
