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
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  Trash2,
  MoreHorizontal,
  Pencil,
} from "lucide-react"

interface CashRegister {
  id: string
  name: string
  currency: string
  initial_balance: number
  account_number: string
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
  cash_register: {
    id: string
    name: string
    currency: string
  } | null
  running_balance: number
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function CashRegisterPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchRegisters = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/cash-registers?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setRegisters(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat pokladne" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  const fetchRecentTransactions = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingTx(true)
    try {
      const res = await fetch(`/api/cash-transactions?company_id=${activeCompanyId}&limit=10`)
      const json = await res.json()
      if (res.ok) {
        setTransactions(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat transakcie" })
    } finally {
      setLoadingTx(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchRegisters()
    fetchRecentTransactions()
  }, [fetchRegisters, fetchRecentTransactions])

  const handleDeleteRegister = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tuto pokladnu?")) return
    try {
      const res = await fetch(`/api/cash-registers/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Pokladna odstranena" })
        fetchRegisters()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit pokladnu" })
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pokladna</h1>
          <p className="text-muted-foreground">Sprava pokladni a pokladnicnych dokladov</p>
        </div>
        <Link href="/cash-register/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova pokladna
          </Button>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/cash-register/transactions/new?type=prijem">
          <Button variant="outline" className="gap-2">
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
            PPD - Prijmovy doklad
          </Button>
        </Link>
        <Link href="/cash-register/transactions/new?type=vydaj">
          <Button variant="outline" className="gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-600" />
            VPD - Vydavkovy doklad
          </Button>
        </Link>
        <Link href="/cash-register/book">
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Pokladnicna kniha
          </Button>
        </Link>
        <Link href="/cash-register/transactions">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            Vsetky transakcie
          </Button>
        </Link>
      </div>

      {/* Cash register cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : registers.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">Zatial nemate ziadnu pokladnu.</p>
            <Link href="/cash-register/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Vytvorit prvu pokladnu
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {registers.map((register) => (
            <Card key={register.id} className="relative">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">{register.name}</CardTitle>
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMenuOpen(menuOpen === register.id ? null : register.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {menuOpen === register.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                        <Link
                          href={`/cash-register/book?cash_register_id=${register.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Pokladnicna kniha
                        </Link>
                        <Link
                          href={`/cash-register/transactions?cash_register_id=${register.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Transakcie
                        </Link>
                        <button
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                          onClick={() => handleDeleteRegister(register.id)}
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
                <div className="text-2xl font-bold">
                  {formatMoney(register.current_balance, register.currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ucet: {register.account_number} | Mena: {register.currency}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Posledne transakcie</CardTitle>
          <Link href="/cash-register/transactions">
            <Button variant="ghost" size="sm">
              Zobrazit vsetky
            </Button>
          </Link>
        </CardHeader>
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
                </tr>
              </thead>
              <tbody>
                {loadingTx ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      Zatial nemate ziadne transakcie.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
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
                        {tx.type === "prijem" ? "+" : "-"}{formatMoney(tx.amount, tx.cash_register?.currency || "EUR")}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatMoney(tx.running_balance, tx.cash_register?.currency || "EUR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
