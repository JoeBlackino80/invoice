"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  CheckCircle,
  Banknote,
  FileText,
  Loader2,
} from "lucide-react"

interface PayrollItem {
  id: string
  employee_id: string
  employee_name: string
  contract_type: string
  gross_salary: number
  total_gross: number
  net_salary: number
  surcharges: {
    night: number
    saturday: number
    sunday: number
    holiday: number
    overtime: number
    total: number
  }
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
    partial_tax_base: number
    nontaxable_amount: number
    tax_base: number
    tax_total: number
    tax_bonus_children: number
    tax_after_bonus: number
    is_withholding: boolean
  }
}

interface PayrollRunDetail {
  id: string
  company_id: string
  period_month: number
  period_year: number
  status: string
  total_gross: number
  total_net: number
  total_employer_cost: number
  created_at: string
  approved_at: string | null
  paid_at: string | null
  items: PayrollItem[]
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

const contractTypeLabels: Record<string, string> = {
  hpp: "HPP",
  dovp: "DoVP",
  dopc: "DoPC",
  dobps: "DoBPS",
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function PayrollRunDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [payrollRun, setPayrollRun] = useState<PayrollRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [paying, setPaying] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/${params.id}`)
      const json = await res.json()
      if (res.ok) {
        setPayrollRun(json)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat detail" })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleApprove = async () => {
    if (!confirm("Naozaj chcete schvalit tuto vyplatnu listinu? Budu vytvorene uctovne zapisy.")) return
    setApproving(true)
    try {
      const res = await fetch(`/api/payroll/${params.id}/approve`, { method: "POST" })
      const json = await res.json()
      if (res.ok) {
        toast({ title: "Vyplatna listina schvalena" })
        fetchDetail()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa schvalit" })
    } finally {
      setApproving(false)
    }
  }

  const handlePay = async () => {
    if (!confirm("Naozaj chcete oznacit tuto vyplatnu listinu ako vyplatenu?")) return
    setPaying(true)
    try {
      const res = await fetch(`/api/payroll/${params.id}/pay`, { method: "POST" })
      const json = await res.json()
      if (res.ok) {
        toast({ title: "Vyplatna listina oznacena ako vyplatena" })
        fetchDetail()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa oznacit ako vyplatenu" })
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!payrollRun) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Vyplatna listina nenajdena</p>
        <Link href="/payroll/payroll-run">
          <Button variant="link">Spat na zoznam</Button>
        </Link>
      </div>
    )
  }

  const items = payrollRun.items || []

  // Calculate summary totals from items
  const summaryTotals = {
    totalGross: items.reduce((s, i) => s + (i.total_gross || 0), 0),
    totalNet: items.reduce((s, i) => s + (i.net_salary || 0), 0),
    totalEmployeeInsurance: items.reduce((s, i) => s + (i.employee_insurance?.total || 0), 0),
    totalEmployerInsurance: items.reduce((s, i) => s + (i.employer_insurance?.total || 0), 0),
    totalTax: items.reduce((s, i) => s + (i.tax?.tax_after_bonus || 0), 0),
    totalEmployerZP: items.reduce((s, i) => s + (i.employer_insurance?.health || 0), 0),
    totalEmployerSP: items.reduce(
      (s, i) => s + ((i.employer_insurance?.total || 0) - (i.employer_insurance?.health || 0)),
      0
    ),
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/payroll/payroll-run">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Mzdy za {monthNames[payrollRun.period_month - 1]} {payrollRun.period_year}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                statusLabels[payrollRun.status]?.className || ""
              }`}
            >
              {statusLabels[payrollRun.status]?.label || payrollRun.status}
            </span>
          </div>
          <p className="text-muted-foreground">
            {items.length} zamestnancov
          </p>
        </div>
        <div className="flex gap-2">
          {payrollRun.status === "draft" && (
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Schvalit
            </Button>
          )}
          {payrollRun.status === "approved" && (
            <Button onClick={handlePay} disabled={paying}>
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Vyplatit
            </Button>
          )}
          <Link href={`/payroll/payslips?run_id=${payrollRun.id}`}>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Vyplatne pasky
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hrube mzdy spolu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatMoney(summaryTotals.totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ciste mzdy spolu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatMoney(summaryTotals.totalNet)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ZP zamestnavatel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatMoney(summaryTotals.totalEmployerZP)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              SP zamestnavatel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatMoney(summaryTotals.totalEmployerSP)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkove naklady
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatMoney(payrollRun.total_employer_cost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee payroll items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Polozky vyplatnej listiny</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Zamestnanec</th>
                  <th className="h-10 px-4 text-center font-medium">Typ</th>
                  <th className="h-10 px-4 text-right font-medium">Hruba mzda</th>
                  <th className="h-10 px-4 text-right font-medium">ZP zam.</th>
                  <th className="h-10 px-4 text-right font-medium">SP zam.</th>
                  <th className="h-10 px-4 text-right font-medium">Dan</th>
                  <th className="h-10 px-4 text-right font-medium">Dan. bonus</th>
                  <th className="h-10 px-4 text-right font-medium">Cista mzda</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const spEmployee = (item.employee_insurance?.total || 0) - (item.employee_insurance?.health || 0)
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{item.employee_name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {contractTypeLabels[item.contract_type] || item.contract_type}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(item.total_gross)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(item.employee_insurance?.health || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(spEmployee)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(item.tax?.tax_after_bonus || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(item.tax?.tax_bonus_children || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {formatMoney(item.net_salary)}
                      </td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td className="px-4 py-3" colSpan={2}>
                    Spolu
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(summaryTotals.totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(items.reduce((s, i) => s + (i.employee_insurance?.health || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(
                      items.reduce(
                        (s, i) => s + ((i.employee_insurance?.total || 0) - (i.employee_insurance?.health || 0)),
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(summaryTotals.totalTax)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(items.reduce((s, i) => s + (i.tax?.tax_bonus_children || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(summaryTotals.totalNet)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
