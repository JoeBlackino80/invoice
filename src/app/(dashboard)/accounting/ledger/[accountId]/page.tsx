"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowLeft,
  Filter,
  BookOpen,
} from "lucide-react"

interface AccountInfo {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
  typ: string
  aktivny: boolean
}

interface MovementLine {
  id: string
  date: string
  document_number: string
  description: string
  journal_entry_id: string
  md_amount: number
  d_amount: number
  running_balance: number
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

const typLabels: Record<string, string> = {
  aktivny: "Aktívny",
  pasivny: "Pasívny",
  nakladovy: "Nákladový",
  vynosovy: "Výnosový",
  uzavierkovy: "Uzávierkový",
  podsuvahovy: "Podsúvahový",
}

export default function AccountDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const accountId = params.accountId as string

  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || `${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || `${currentYear}-12-31`)

  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [lines, setLines] = useState<MovementLine[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [closingBalance, setClosingBalance] = useState(0)
  const [totalMd, setTotalMd] = useState(0)
  const [totalD, setTotalD] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchDetail = useCallback(async () => {
    if (!activeCompanyId || !accountId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        date_from: dateFrom,
        date_to: dateTo,
      })

      const res = await fetch(`/api/ledger/${accountId}?${params}`)
      const json = await res.json()

      if (res.ok) {
        setAccount(json.account)
        setLines(json.lines || [])
        setOpeningBalance(json.opening_balance || 0)
        setClosingBalance(json.closing_balance || 0)
        setTotalMd(json.total_md || 0)
        setTotalD(json.total_d || 0)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa načítať detail účtu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať detail účtu" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, accountId, dateFrom, dateTo, toast])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const accountLabel = account
    ? `${account.synteticky_ucet}${account.analyticky_ucet ? "." + account.analyticky_ucet : ""}`
    : ""

  return (
    <div>
      <Breadcrumb />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/accounting/ledger?date_from=${dateFrom}&date_to=${dateTo}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Späť na hlavnú knihu
        </Link>
      </div>

      {/* Account header */}
      {account && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="font-mono">{accountLabel}</span>{" "}
            <span className="text-muted-foreground font-normal">-</span>{" "}
            {account.nazov}
          </h1>
          <p className="text-muted-foreground">
            Typ: {typLabels[account.typ] || account.typ}
            {!account.aktivny && " (neaktívny)"}
          </p>
        </div>
      )}

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
            <Button onClick={fetchDetail} variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrovať
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {!loading && account && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Počiatočný zostatok</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold font-mono ${openingBalance < 0 ? "text-destructive" : ""}`}>
                {formatMoney(openingBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Obraty MD</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatMoney(totalMd)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Obraty D</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatMoney(totalD)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Konečný zostatok</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold font-mono ${closingBalance < 0 ? "text-destructive" : ""}`}>
                {formatMoney(closingBalance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Movements table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Dátum</th>
                  <th className="h-10 px-4 text-left font-medium">Č. dokladu</th>
                  <th className="h-10 px-4 text-left font-medium">Popis</th>
                  <th className="h-10 px-4 text-right font-medium">MD</th>
                  <th className="h-10 px-4 text-right font-medium">D</th>
                  <th className="h-10 px-4 text-right font-medium">Zostatok</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                {!loading && (
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                      Počiatočný zostatok k {formatDate(dateFrom)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" colSpan={2}></td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${openingBalance < 0 ? "text-destructive" : ""}`}>
                      {formatMoney(openingBalance)}
                    </td>
                  </tr>
                )}
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      Načítavam...
                    </td>
                  </tr>
                ) : lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Žiadne pohyby v zvolenom období.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(line.date)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {line.document_number}
                      </td>
                      <td className="px-4 py-3">
                        {line.description}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.md_amount > 0 ? formatMoney(line.md_amount) : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.d_amount > 0 ? formatMoney(line.d_amount) : ""}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${line.running_balance < 0 ? "text-destructive" : ""}`}>
                        {formatMoney(line.running_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && lines.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-medium">
                    <td className="px-4 py-3" colSpan={3}>
                      Spolu ({lines.length} záznamov)
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMoney(totalMd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMoney(totalD)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${closingBalance < 0 ? "text-destructive" : ""}`}>
                      {formatMoney(closingBalance)}
                    </td>
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
