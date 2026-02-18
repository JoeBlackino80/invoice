"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, Printer, Download } from "lucide-react"

interface PayrollRun {
  id: string
  period_month: number
  period_year: number
  status: string
  total_gross: number
  total_net: number
  total_employer_cost: number
}

interface PayslipItem {
  employee_id: string
  employee_name: string
  contract_type: string
  gross_salary: number
  total_gross: number
  net_salary: number
  employee_insurance: {
    health: number
    sickness: number
    retirement: number
    disability: number
    unemployment: number
    total: number
  }
  employer_insurance: {
    health: number
    sickness: number
    retirement: number
    disability: number
    unemployment: number
    guarantee: number
    reserve: number
    accident: number
    total: number
  }
  tax: {
    tax_total: number
    tax_bonus_children: number
    tax_after_bonus: number
  }
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

const contractTypeLabels: Record<string, string> = {
  hpp: "HPP",
  dovp: "DoVP",
  dopc: "DoPC",
  dobps: "DoBPS",
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function PayrollListPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>("")
  const [items, setItems] = useState<PayslipItem[]>([])
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingRuns, setLoadingRuns] = useState(true)

  // Fetch payroll runs
  const fetchRuns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingRuns(true)
    try {
      const res = await fetch(`/api/payroll?company_id=${activeCompanyId}&limit=50`)
      const json = await res.json()
      if (res.ok) {
        setRuns(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat obdobia" })
    } finally {
      setLoadingRuns(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  // Fetch payroll items when run changes
  const fetchItems = useCallback(async () => {
    if (!selectedRunId) {
      setItems([])
      setSelectedRun(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/${selectedRunId}/payslips`)
      const json = await res.json()
      if (res.ok) {
        setItems(json.payslips || [])
        setSelectedRun(json.payroll_run || null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat data" })
    } finally {
      setLoading(false)
    }
  }, [selectedRunId, toast])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!items.length || !selectedRun) return

    const headers = [
      "Poradie",
      "Zamestnanec",
      "Typ",
      "Hruba mzda",
      "ZP zamestnanec",
      "SP zamestnanec",
      "Odvody zamestnanec",
      "Dan",
      "Danovy bonus",
      "Cista mzda",
      "ZP zamestnavatel",
      "SP zamestnavatel",
      "Odvody zamestnavatel",
      "Celkove naklady",
    ]

    const rows = items.map((item, index) => {
      const spEmployee = item.employee_insurance.total - item.employee_insurance.health
      const spEmployer = item.employer_insurance.total - item.employer_insurance.health
      return [
        index + 1,
        item.employee_name,
        contractTypeLabels[item.contract_type] || item.contract_type,
        item.total_gross,
        item.employee_insurance.health,
        spEmployee,
        item.employee_insurance.total,
        item.tax.tax_after_bonus,
        item.tax.tax_bonus_children,
        item.net_salary,
        item.employer_insurance.health,
        spEmployer,
        item.employer_insurance.total,
        item.total_gross + item.employer_insurance.total,
      ].join(";")
    })

    // Totals row
    const totals = [
      "",
      "SPOLU",
      "",
      items.reduce((s, i) => s + i.total_gross, 0),
      items.reduce((s, i) => s + i.employee_insurance.health, 0),
      items.reduce((s, i) => s + (i.employee_insurance.total - i.employee_insurance.health), 0),
      items.reduce((s, i) => s + i.employee_insurance.total, 0),
      items.reduce((s, i) => s + i.tax.tax_after_bonus, 0),
      items.reduce((s, i) => s + i.tax.tax_bonus_children, 0),
      items.reduce((s, i) => s + i.net_salary, 0),
      items.reduce((s, i) => s + i.employer_insurance.health, 0),
      items.reduce((s, i) => s + (i.employer_insurance.total - i.employer_insurance.health), 0),
      items.reduce((s, i) => s + i.employer_insurance.total, 0),
      items.reduce((s, i) => s + i.total_gross + i.employer_insurance.total, 0),
    ].join(";")

    const csv = [headers.join(";"), ...rows, totals].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `vyplatna-listina-${selectedRun.period_month}-${selectedRun.period_year}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Link href="/payroll/payroll-run">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Vyplatna listina</h1>
          <p className="text-muted-foreground">Suhrn vyplatnej listiny za obdobie</p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Tlacit
            </Button>
          </div>
        )}
      </div>

      {/* Selector */}
      <div className="mb-6 print:hidden">
        <label className="text-sm font-medium mb-1 block">Vyplatne obdobie</label>
        <select
          className="flex h-10 w-64 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedRunId}
          onChange={(e) => setSelectedRunId(e.target.value)}
        >
          <option value="">-- Zvolte obdobie --</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {monthNames[run.period_month - 1]} {run.period_year}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !selectedRunId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Zvolte vyplatne obdobie pre zobrazenie vyplatnej listiny.
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && selectedRun && (
        <Card>
          <CardHeader className="print:pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Vyplatna listina - {monthNames[selectedRun.period_month - 1]} {selectedRun.period_year}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{items.length} zamestnancov</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-center font-medium w-10">#</th>
                    <th className="h-10 px-3 text-left font-medium">Zamestnanec</th>
                    <th className="h-10 px-3 text-center font-medium">Typ</th>
                    <th className="h-10 px-3 text-right font-medium">Hruba mzda</th>
                    <th className="h-10 px-3 text-right font-medium">ZP zam.</th>
                    <th className="h-10 px-3 text-right font-medium">SP zam.</th>
                    <th className="h-10 px-3 text-right font-medium">Dan</th>
                    <th className="h-10 px-3 text-right font-medium">Bonus</th>
                    <th className="h-10 px-3 text-right font-medium">Cista mzda</th>
                    <th className="h-10 px-3 text-right font-medium">ZP zam-el</th>
                    <th className="h-10 px-3 text-right font-medium">SP zam-el</th>
                    <th className="h-10 px-3 text-right font-medium">Celk. nakl.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const spEmployee = item.employee_insurance.total - item.employee_insurance.health
                    const spEmployer = item.employer_insurance.total - item.employer_insurance.health
                    const totalCost = item.total_gross + item.employer_insurance.total
                    return (
                      <tr key={item.employee_id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.employee_name}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {contractTypeLabels[item.contract_type] || item.contract_type}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatMoney(item.total_gross)}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(item.employee_insurance.health)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(spEmployee)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(item.tax.tax_after_bonus)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(item.tax.tax_bonus_children)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          {formatMoney(item.net_salary)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(item.employer_insurance.health)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(spEmployer)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          {formatMoney(totalCost)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 bg-muted/30 font-medium">
                    <td className="px-3 py-3" colSpan={3}>
                      SPOLU
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.total_gross, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.employee_insurance.health, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(
                        items.reduce((s, i) => s + (i.employee_insurance.total - i.employee_insurance.health), 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.tax.tax_after_bonus, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.tax.tax_bonus_children, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.net_salary, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(items.reduce((s, i) => s + i.employer_insurance.health, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(
                        items.reduce((s, i) => s + (i.employer_insurance.total - i.employer_insurance.health), 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {formatMoney(
                        items.reduce((s, i) => s + i.total_gross + i.employer_insurance.total, 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
