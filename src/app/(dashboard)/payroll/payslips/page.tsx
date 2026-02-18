"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, Printer } from "lucide-react"

interface PayrollRun {
  id: string
  period_month: number
  period_year: number
  status: string
  total_gross: number
  total_net: number
  total_employer_cost: number
}

interface Payslip {
  employee_id: string
  employee_name: string
  contract_type: string
  period: string
  period_month: number
  period_year: number
  gross_salary: number
  total_gross: number
  surcharges: {
    night: number
    saturday: number
    sunday: number
    holiday: number
    overtime: number
    total: number
  }
  sick_leave: {
    days_25_percent: number
    days_55_percent: number
    amount_25: number
    amount_55: number
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
  tax: {
    partial_tax_base: number
    nontaxable_amount: number
    tax_base: number
    tax_19_base: number
    tax_25_base: number
    tax_19: number
    tax_25: number
    tax_total: number
    tax_bonus_children: number
    tax_after_bonus: number
    is_withholding: boolean
  }
  net_salary: number
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
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

const contractTypeLabels: Record<string, string> = {
  hpp: "Hlavny pracovny pomer",
  dovp: "Dohoda o vykonani prace",
  dopc: "Dohoda o pracovnej cinnosti",
  dobps: "Dohoda o brigadnickej praci studentov",
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function PayslipsPageContent() {
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>(searchParams.get("run_id") || "")
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
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

  // Fetch payslips when run changes
  const fetchPayslips = useCallback(async () => {
    if (!selectedRunId) {
      setPayslips([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/${selectedRunId}/payslips`)
      const json = await res.json()
      if (res.ok) {
        setPayslips(json.payslips || [])
        if (json.payslips && json.payslips.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(json.payslips[0].employee_id)
        }
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat vyplatne pasky" })
    } finally {
      setLoading(false)
    }
  }, [selectedRunId, toast, selectedEmployeeId])

  useEffect(() => {
    fetchPayslips()
  }, [selectedRunId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPayslip = payslips.find((p) => p.employee_id === selectedEmployeeId)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/payroll/payroll-run">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Vyplatne pasky</h1>
          <p className="text-muted-foreground">Prehlad vyplatnych pasok zamestnancov</p>
        </div>
        {selectedPayslip && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Tlacit
          </Button>
        )}
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="text-sm font-medium mb-1 block">Vyplatne obdobie</label>
          <select
            className="flex h-10 w-64 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedRunId}
            onChange={(e) => {
              setSelectedRunId(e.target.value)
              setSelectedEmployeeId("")
            }}
          >
            <option value="">-- Zvolte obdobie --</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {monthNames[run.period_month - 1]} {run.period_year}
              </option>
            ))}
          </select>
        </div>
        {payslips.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1 block">Zamestnanec</label>
            <select
              className="flex h-10 w-64 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              {payslips.map((p) => (
                <option key={p.employee_id} value={p.employee_id}>
                  {p.employee_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !selectedRunId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Zvolte vyplatne obdobie pre zobrazenie vyplatnych pasok.
          </CardContent>
        </Card>
      )}

      {!loading && selectedPayslip && (
        <div className="print:bg-white" id="payslip-content">
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Vyplatna paska</CardTitle>
                  <p className="text-muted-foreground">
                    {monthNames[selectedPayslip.period_month - 1]} {selectedPayslip.period_year}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{selectedPayslip.employee_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contractTypeLabels[selectedPayslip.contract_type] || selectedPayslip.contract_type}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Hruba mzda */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide">Hruba mzda</h3>
                <div className="space-y-1">
                  <div className="flex justify-between py-1">
                    <span>Zakladna mzda</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.gross_salary)}</span>
                  </div>
                  {selectedPayslip.surcharges.total > 0 && (
                    <>
                      {selectedPayslip.surcharges.night > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Nocny priplatky</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.surcharges.night)}</span>
                        </div>
                      )}
                      {selectedPayslip.surcharges.saturday > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Priplatky za sobotu</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.surcharges.saturday)}</span>
                        </div>
                      )}
                      {selectedPayslip.surcharges.sunday > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Priplatky za nedelu</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.surcharges.sunday)}</span>
                        </div>
                      )}
                      {selectedPayslip.surcharges.holiday > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Priplatky za sviatky</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.surcharges.holiday)}</span>
                        </div>
                      )}
                      {selectedPayslip.surcharges.overtime > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Nadcasove priplatky</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.surcharges.overtime)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedPayslip.sick_leave.total > 0 && (
                    <div className="flex justify-between py-1 text-muted-foreground text-sm">
                      <span className="pl-4">Nahrada pri PN</span>
                      <span className="font-mono">{formatMoney(selectedPayslip.sick_leave.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>Hruba mzda spolu</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.total_gross)}</span>
                  </div>
                </div>
              </div>

              {/* Odpocitatelne polozky */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide">Odpocitatelne polozky (odvody zamestnanca)</h3>
                <div className="space-y-1">
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Zdravotne poistenie (4%)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.health)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Nemocenske poistenie (1,4%)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.sickness)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Starobne poistenie (4%)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.retirement)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Invalidne poistenie (3%)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.disability)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Poistenie v nezamestnanosti (1%)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.unemployment)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>Odvody zamestnanca spolu</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.employee_insurance.total)}</span>
                  </div>
                </div>
              </div>

              {/* Dan z prijmov */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide">Vypocet dane</h3>
                <div className="space-y-1">
                  <div className="flex justify-between py-1">
                    <span>Ciastkovy zaklad dane</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.tax.partial_tax_base)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">NCZD (nezdanitelna cast)</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.tax.nontaxable_amount)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Zaklad dane</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.tax.tax_base)}</span>
                  </div>
                  {selectedPayslip.tax.is_withholding ? (
                    <div className="flex justify-between py-1 text-muted-foreground text-sm">
                      <span className="pl-4">Zrazkova dan (19%)</span>
                      <span className="font-mono">{formatMoney(selectedPayslip.tax.tax_total)}</span>
                    </div>
                  ) : (
                    <>
                      {selectedPayslip.tax.tax_19 > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Dan 19%</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.tax.tax_19)}</span>
                        </div>
                      )}
                      {selectedPayslip.tax.tax_25 > 0 && (
                        <div className="flex justify-between py-1 text-muted-foreground text-sm">
                          <span className="pl-4">Dan 25%</span>
                          <span className="font-mono">{formatMoney(selectedPayslip.tax.tax_25)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between py-1">
                    <span>Preddavok na dan</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.tax.tax_total)}</span>
                  </div>
                  {selectedPayslip.tax.tax_bonus_children > 0 && (
                    <div className="flex justify-between py-1 text-muted-foreground text-sm">
                      <span className="pl-4">Danovy bonus na deti</span>
                      <span className="font-mono text-green-600">-{formatMoney(selectedPayslip.tax.tax_bonus_children)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>Dan po odpocitani bonusu</span>
                    <span className="font-mono">-{formatMoney(selectedPayslip.tax.tax_after_bonus)}</span>
                  </div>
                </div>
              </div>

              {/* Cista mzda */}
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Cista mzda</span>
                  <span className="text-2xl font-bold font-mono">{formatMoney(selectedPayslip.net_salary)}</span>
                </div>
              </div>

              {/* Odvody zamestnavatela */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide">Odvody zamestnavatela</h3>
                <div className="space-y-1">
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Zdravotne poistenie (10%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.health)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Nemocenske poistenie (1,4%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.sickness)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Starobne poistenie (14%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.retirement)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Invalidne poistenie (3%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.disability)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Poistenie v nezamestnanosti (1%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.unemployment)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Garancny fond (0,25%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.guarantee || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Rezervny fond (4,75%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.reserve || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-muted-foreground text-sm">
                    <span className="pl-4">Urazove poistenie (0,8%)</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.accident || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t font-medium">
                    <span>Odvody zamestnavatela spolu</span>
                    <span className="font-mono">{formatMoney(selectedPayslip.employer_insurance.total)}</span>
                  </div>
                </div>
              </div>

              {/* Celkove naklady */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Celkove naklady zamestnavatela</span>
                  <span className="text-xl font-bold font-mono">
                    {formatMoney(selectedPayslip.total_gross + selectedPayslip.employer_insurance.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function PayslipsPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <PayslipsPageContent />
    </Suspense>
  )
}
