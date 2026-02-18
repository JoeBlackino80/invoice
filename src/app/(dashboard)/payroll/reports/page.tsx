"use client"

import { useState } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  FileText,
  Download,
  Calculator,
  Loader2,
  Building2,
  Heart,
  ChevronRight,
} from "lucide-react"

const currentDate = new Date()
const months = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]
const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function PayrollReportsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Okres selectors
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()
  )
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
  )
  const [selectedAnnualYear, setSelectedAnnualYear] = useState(currentDate.getFullYear() - 1)

  // Generating states
  const [generatingMonthly, setGeneratingMonthly] = useState(false)
  const [generatingAnnual, setGeneratingAnnual] = useState(false)
  const [generatingSP, setGeneratingSP] = useState(false)
  const [generatingZP, setGeneratingZP] = useState(false)

  // Quick summary results
  const [monthlyResult, setMonthlyResult] = useState<any>(null)
  const [annualResult, setAnnualResult] = useState<any>(null)
  const [spResult, setSpResult] = useState<any>(null)
  const [zpResult, setZpResult] = useState<any>(null)

  const handleGenerateMonthly = async () => {
    if (!activeCompanyId) return
    setGeneratingMonthly(true)
    try {
      const res = await fetch(
        `/api/payroll/reports/monthly-tax?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setMonthlyResult(json)
        toast({ title: "Vygenerovane", description: "Mesacny prehlad bol vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat prehlad" })
    } finally {
      setGeneratingMonthly(false)
    }
  }

  const handleGenerateAnnual = async () => {
    if (!activeCompanyId) return
    setGeneratingAnnual(true)
    try {
      const res = await fetch(
        `/api/payroll/reports/annual-tax?company_id=${activeCompanyId}&year=${selectedAnnualYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setAnnualResult(json)
        toast({ title: "Vygenerovane", description: "Rocne hlasenie bolo vygenerovane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat hlasenie" })
    } finally {
      setGeneratingAnnual(false)
    }
  }

  const handleGenerateSP = async () => {
    if (!activeCompanyId) return
    setGeneratingSP(true)
    try {
      const res = await fetch(
        `/api/payroll/reports/sp?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setSpResult(json)
        toast({ title: "Vygenerovane", description: "Vykaz SP bol vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat vykaz SP" })
    } finally {
      setGeneratingSP(false)
    }
  }

  const handleGenerateZP = async () => {
    if (!activeCompanyId) return
    setGeneratingZP(true)
    try {
      const res = await fetch(
        `/api/payroll/reports/zp?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setZpResult(json)
        toast({ title: "Vygenerovane", description: "Vykaz ZP bol vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat vykaz ZP" })
    } finally {
      setGeneratingZP(false)
    }
  }

  const handleDownloadXml = (type: string, extraParams?: string) => {
    if (!activeCompanyId) return
    let url = `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=${type}&year=${selectedYear}`
    if (type !== "annual-tax") {
      url += `&month=${selectedMonth}`
    } else {
      url = `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=${type}&year=${selectedAnnualYear}`
    }
    if (extraParams) {
      url += `&${extraParams}`
    }
    window.open(url, "_blank")
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Mzdove reporty a hlasenia</h1>
        <p className="text-muted-foreground">
          Danove hlasenia, vykazy pre poistovne a XML subory pre Financnu spravu SR
        </p>
      </div>

      {/* Spolocny vyber obdobia */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Obdobie pre mesacne reporty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Mesiac</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {months.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Rok</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[100px]"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground pb-1">
              Obdobie: {months[selectedMonth - 1]} {selectedYear}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danove hlasenia */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Danove hlasenia
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Mesacny prehlad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mesacny prehlad</CardTitle>
              <p className="text-xs text-muted-foreground">
                Prehlad o zrazenych preddavkoch na dan (§35 ods. 6 ZDP)
              </p>
            </CardHeader>
            <CardContent>
              {monthlyResult && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                  <p>Zamestnanci: <span className="font-medium">{monthlyResult.number_of_employees}</span></p>
                  <p>Uhrn prijmov: <span className="font-medium">{formatMoney(monthlyResult.total_gross_income)}</span></p>
                  <p>Preddavok dane: <span className="font-medium">{formatMoney(monthlyResult.total_tax_withheld)}</span></p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateMonthly}
                  disabled={generatingMonthly || !activeCompanyId}
                >
                  {generatingMonthly ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="mr-1 h-3 w-3" />
                  )}
                  Generovat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadXml("monthly-tax")}
                  disabled={!activeCompanyId}
                >
                  <Download className="mr-1 h-3 w-3" />
                  XML
                </Button>
                <Link href="/payroll/reports/monthly-report">
                  <Button size="sm" variant="ghost">
                    Detail
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Rocne hlasenie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rocne hlasenie</CardTitle>
              <p className="text-xs text-muted-foreground">
                Hlasenie o vyuctovani dane (§39 ods. 9 ZDP)
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <label className="text-sm font-medium mb-1 block">Rok</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedAnnualYear}
                  onChange={(e) => setSelectedAnnualYear(parseInt(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {annualResult && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                  <p>Zamestnanci: <span className="font-medium">{annualResult.number_of_employees}</span></p>
                  <p>Uhrn prijmov: <span className="font-medium">{formatMoney(annualResult.totals?.total_gross_income || 0)}</span></p>
                  <p>Dan celkom: <span className="font-medium">{formatMoney(annualResult.totals?.total_tax_withheld || 0)}</span></p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateAnnual}
                  disabled={generatingAnnual || !activeCompanyId}
                >
                  {generatingAnnual ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="mr-1 h-3 w-3" />
                  )}
                  Generovat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadXml("annual-tax")}
                  disabled={!activeCompanyId}
                >
                  <Download className="mr-1 h-3 w-3" />
                  XML
                </Button>
                <Link href="/payroll/reports/annual-report">
                  <Button size="sm" variant="ghost">
                    Detail
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Potvrdenie o prijmoch */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Potvrdenie o prijmoch</CardTitle>
              <p className="text-xs text-muted-foreground">
                Potvrdenie o zdanitelnych prijmoch (§39 ods. 5 ZDP)
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Vygenerujte potvrdenie pre konkretneho zamestnanca na detailnej stranke.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/payroll/reports/annual-report">
                  <Button size="sm" variant="outline">
                    <FileText className="mr-1 h-3 w-3" />
                    Prejst na detail
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vykazy poistovniam */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Vykazy poistovniam
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Socialna poistovna */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Socialna poistovna - MVP
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Mesacny vykaz poistneho a prispevkov
              </p>
            </CardHeader>
            <CardContent>
              {spResult && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                  <p>Zamestnanci: <span className="font-medium">{spResult.number_of_employees}</span></p>
                  <p>Zamestnanec: <span className="font-medium">{formatMoney(spResult.totals?.total_employee || 0)}</span></p>
                  <p>Zamestnavatel: <span className="font-medium">{formatMoney(spResult.totals?.total_employer || 0)}</span></p>
                  <p>Celkom: <span className="font-medium">{formatMoney(spResult.totals?.total || 0)}</span></p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateSP}
                  disabled={generatingSP || !activeCompanyId}
                >
                  {generatingSP ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="mr-1 h-3 w-3" />
                  )}
                  Generovat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadXml("sp")}
                  disabled={!activeCompanyId}
                >
                  <Download className="mr-1 h-3 w-3" />
                  XML
                </Button>
                <Link href="/payroll/reports/sp-report">
                  <Button size="sm" variant="ghost">
                    Detail
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Zdravotna poistovna */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Zdravotne poistovne
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Mesacne oznamenie platitela poistneho
              </p>
            </CardHeader>
            <CardContent>
              {zpResult && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                  <p>Zamestnanci: <span className="font-medium">{zpResult.number_of_employees}</span></p>
                  {zpResult.insurers?.map((ins: any) => (
                    <p key={ins.insurer_code}>
                      {ins.insurer}: <span className="font-medium">{ins.number_of_employees} zam.</span>{" "}
                      ({formatMoney(ins.totals?.total_insurance || 0)})
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateZP}
                  disabled={generatingZP || !activeCompanyId}
                >
                  {generatingZP ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="mr-1 h-3 w-3" />
                  )}
                  Generovat
                </Button>
                {zpResult?.insurers?.map((ins: any) => (
                  <Button
                    key={ins.insurer_code}
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadXml("zp", `insurer=${ins.insurer_code}`)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {ins.insurer}
                  </Button>
                ))}
                <Link href="/payroll/reports/zp-report">
                  <Button size="sm" variant="ghost">
                    Detail
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
