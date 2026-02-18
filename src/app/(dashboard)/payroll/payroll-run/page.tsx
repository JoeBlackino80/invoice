"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Play,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from "lucide-react"

interface PayrollRun {
  id: string
  period_month: number
  period_year: number
  status: string
  total_gross: number
  total_net: number
  total_employer_cost: number
  created_at: string
}

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Koncept",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  approved: {
    label: "Schvalene",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  paid: {
    label: "Vyplatene",
    className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function PayrollRunPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  // Period selector state
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const fetchRuns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })

      const res = await fetch(`/api/payroll?${params}`)
      const json = await res.json()

      if (res.ok) {
        setRuns(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat vyplatne listiny" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, pagination.page, toast])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const handleCreatePayrollRun = async () => {
    if (!activeCompanyId) return
    setCreating(true)
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          period_month: selectedMonth,
          period_year: selectedYear,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: "Vyplatna listina vytvorena" })
        fetchRuns()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit vyplatnu listinu" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tuto vyplatnu listinu?")) return
    try {
      const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Vyplatna listina odstranena" })
        fetchRuns()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit vyplatnu listinu" })
    }
  }

  // Generate year options
  const years: number[] = []
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    years.push(y)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spracovanie miezd</h1>
          <p className="text-muted-foreground">Vypocet a sprava vyplatnych listin</p>
        </div>
      </div>

      {/* Period selector and create button */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Novy vypocet miezd</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Mesiac</label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {monthNames.map((name, index) => (
                  <option key={index} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Rok</label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleCreatePayrollRun} disabled={creating || !activeCompanyId}>
              <Play className="mr-2 h-4 w-4" />
              {creating ? "Vypocitavam..." : "Spustit vypocet miezd"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payroll runs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vyplatne listiny</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Hrube mzdy spolu</th>
                  <th className="h-10 px-4 text-right font-medium">Ciste mzdy spolu</th>
                  <th className="h-10 px-4 text-right font-medium">Naklady zamestnavatela</th>
                  <th className="h-10 px-4 text-left font-medium">Datum vytvorenia</th>
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
                ) : runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ziadne vyplatne listiny.</p>
                        <p className="text-sm">Zvolte obdobie a spustite vypocet miezd.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/payroll/payroll-run/${run.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {monthNames[run.period_month - 1]} {run.period_year}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusLabels[run.status]?.className || ""
                          }`}
                        >
                          {statusLabels[run.status]?.label || run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(run.total_gross)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(run.total_net)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(run.total_employer_cost)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(run.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/payroll/payroll-run/${run.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                          {run.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(run.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
                {pagination.total} zaznamov celkovo
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Predchadzajuca
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Dalsia
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
