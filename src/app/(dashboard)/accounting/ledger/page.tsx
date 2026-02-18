"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  BookOpen,
  Search,
  Filter,
  Download,
  ChevronRight,
} from "lucide-react"

interface LedgerAccount {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
  typ: string
  aktivny: boolean
  pociatocny_zostatok: number
  obraty_md: number
  obraty_d: number
  konecny_zostatok: number
  has_movements: boolean
}

interface LedgerSummary {
  total_pociatocny_zostatok_md: number
  total_pociatocny_zostatok_d: number
  total_obraty_md: number
  total_obraty_d: number
  total_konecny_zostatok_md: number
  total_konecny_zostatok_d: number
}

interface AccountOption {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

const typLabels: Record<string, { label: string; class: string }> = {
  aktivny: { label: "Aktívny", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  pasivny: { label: "Pasívny", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  nakladovy: { label: "Nákladový", class: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  vynosovy: { label: "Výnosový", class: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  uzavierkovy: { label: "Uzávierkový", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  podsuvahovy: { label: "Podsúvahový", class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
}

export default function LedgerPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [ledgerData, setLedgerData] = useState<LedgerAccount[]>([])
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [accountSearch, setAccountSearch] = useState("")
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  // Default date range: current fiscal year
  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)

  // Fetch accounts for filter dropdown
  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        limit: "500",
      })
      const res = await fetch(`/api/chart-of-accounts?${params}`)
      const json = await res.json()
      if (res.ok) {
        setAccounts(json.data || [])
      }
    } catch {
      // silently fail - accounts filter is optional
    }
  }, [activeCompanyId])

  const fetchLedger = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        date_from: dateFrom,
        date_to: dateTo,
      })
      if (selectedAccountId) {
        params.set("account_id", selectedAccountId)
      }

      const res = await fetch(`/api/ledger?${params}`)
      const json = await res.json()

      if (res.ok) {
        setLedgerData(json.data || [])
        setSummary(json.summary || null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa načítať hlavnú knihu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať hlavnú knihu" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, dateFrom, dateTo, selectedAccountId, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchLedger()
  }, [fetchLedger])

  const filteredAccounts = accounts.filter((a) => {
    if (!accountSearch) return true
    const searchLower = accountSearch.toLowerCase()
    return (
      a.synteticky_ucet.toLowerCase().includes(searchLower) ||
      (a.analyticky_ucet || "").toLowerCase().includes(searchLower) ||
      a.nazov.toLowerCase().includes(searchLower)
    )
  })

  const handleSelectAccount = (account: AccountOption | null) => {
    if (account) {
      setSelectedAccountId(account.id)
      setAccountSearch(`${account.synteticky_ucet}${account.analyticky_ucet ? "." + account.analyticky_ucet : ""} - ${account.nazov}`)
    } else {
      setSelectedAccountId("")
      setAccountSearch("")
    }
    setShowAccountDropdown(false)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hlavná kniha</h1>
          <p className="text-muted-foreground">Prehľad pohybov na účtoch</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Od</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Do</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="relative flex-1 max-w-sm">
              <label className="text-sm font-medium mb-1 block">Účet (voliteľný filter)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Hľadať účet..."
                  className="pl-9"
                  value={accountSearch}
                  onChange={(e) => {
                    setAccountSearch(e.target.value)
                    setShowAccountDropdown(true)
                    if (!e.target.value) {
                      setSelectedAccountId("")
                    }
                  }}
                  onFocus={() => setShowAccountDropdown(true)}
                />
              </div>
              {showAccountDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountDropdown(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md">
                    <button
                      className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent text-muted-foreground"
                      onClick={() => handleSelectAccount(null)}
                    >
                      Všetky účty
                    </button>
                    {filteredAccounts.slice(0, 50).map((account) => (
                      <button
                        key={account.id}
                        className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent text-left"
                        onClick={() => handleSelectAccount(account)}
                      >
                        <span className="font-mono mr-2">
                          {account.synteticky_ucet}{account.analyticky_ucet ? `.${account.analyticky_ucet}` : ""}
                        </span>
                        <span className="text-muted-foreground truncate">{account.nazov}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button onClick={fetchLedger} variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrovať
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Účet</th>
                  <th className="h-10 px-4 text-left font-medium">Názov</th>
                  <th className="h-10 px-4 text-center font-medium">Typ</th>
                  <th className="h-10 px-4 text-right font-medium">Počiatočný zostatok</th>
                  <th className="h-10 px-4 text-right font-medium">Obraty MD</th>
                  <th className="h-10 px-4 text-right font-medium">Obraty D</th>
                  <th className="h-10 px-4 text-right font-medium">Konečný zostatok</th>
                  <th className="h-10 px-4 text-center font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      Načítavam...
                    </td>
                  </tr>
                ) : ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Žiadne pohyby v zvolenom období.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((account) => {
                    const typInfo = typLabels[account.typ] || { label: account.typ, class: "bg-gray-100 text-gray-700" }
                    return (
                      <tr key={account.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium">
                          <Link
                            href={`/accounting/ledger/${account.id}?date_from=${dateFrom}&date_to=${dateTo}`}
                            className="hover:text-primary"
                          >
                            {account.synteticky_ucet}
                            {account.analyticky_ucet ? `.${account.analyticky_ucet}` : ""}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/accounting/ledger/${account.id}?date_from=${dateFrom}&date_to=${dateTo}`}
                            className="hover:text-primary"
                          >
                            {account.nazov}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typInfo.class}`}>
                            {typInfo.label}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${account.pociatocny_zostatok < 0 ? "text-destructive" : ""}`}>
                          {formatMoney(account.pociatocny_zostatok)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(account.obraty_md)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(account.obraty_d)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${account.konecny_zostatok < 0 ? "text-destructive" : ""}`}>
                          {formatMoney(account.konecny_zostatok)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/accounting/ledger/${account.id}?date_from=${dateFrom}&date_to=${dateTo}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {summary && ledgerData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-medium">
                    <td className="px-4 py-3" colSpan={3}>
                      Spolu ({ledgerData.length} účtov)
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <div>MD: {formatMoney(summary.total_pociatocny_zostatok_md)}</div>
                      <div className="text-muted-foreground">D: {formatMoney(summary.total_pociatocny_zostatok_d)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMoney(summary.total_obraty_md)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMoney(summary.total_obraty_d)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <div>MD: {formatMoney(summary.total_konecny_zostatok_md)}</div>
                      <div className="text-muted-foreground">D: {formatMoney(summary.total_konecny_zostatok_d)}</div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
