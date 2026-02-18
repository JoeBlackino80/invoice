"use client"

import { useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Calculator,
  Download,
  Loader2,
  FileText,
  Building2,
  Eye,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface SPEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  assessment_base: number
  nemocenske: { employee: number; employer: number }
  starobne: { employee: number; employer: number }
  invalidne: { employee: number; employer: number }
  nezamestnanost: { employee: number; employer: number }
  garancne: { employer: number }
  rezervny_fond: { employer: number }
  urazove: { employer: number }
  total_employee: number
  total_employer: number
  total: number
}

interface SPReportData {
  company: {
    name: string
    ico: string
    dic: string
    variabilny_symbol: string
    address: string
  }
  period: { month: number; year: number }
  employees: SPEmployee[]
  totals: {
    total_assessment_base: number
    total_nemocenske_employee: number
    total_nemocenske_employer: number
    total_starobne_employee: number
    total_starobne_employer: number
    total_invalidne_employee: number
    total_invalidne_employer: number
    total_nezamestnanost_employee: number
    total_nezamestnanost_employer: number
    total_garancne_employer: number
    total_rezervny_fond_employer: number
    total_urazove_employer: number
    total_employee: number
    total_employer: number
    total: number
  }
  number_of_employees: number
  generated_at: string
}

const months = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

const currentDate = new Date()
const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

function formatMoney(amount: number) {
  if (amount === 0) return "-"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function SPReportPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()
  )
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
  )
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SPReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleGenerate = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(
        `/api/payroll/reports/sp?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setData(json)
        toast({ title: "Vygenerovane", description: "Vykaz SP bol uspesne vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat vykaz SP" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedMonth, selectedYear, toast])

  const handleDownloadXml = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=sp&month=${selectedMonth}&year=${selectedYear}`
      )
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "mvp_sp")
      setValidationResult(result)
      if (!result.valid) {
        setPreviewXml(xml)
        toast({ variant: "destructive", title: "Validacia", description: "XML obsahuje chyby - skontrolujte upozornenia" })
        return
      }
      const blob = new Blob([xml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `mvp_sp_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stiahnut XML" })
    }
  }

  const handlePreview = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=sp&month=${selectedMonth}&year=${selectedYear}`
      )
      const xml = await res.text()
      setPreviewXml(xml)
      setPreviewOpen(true)
      const result = validateBeforeDownload(xml, "mvp_sp")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Vykaz pre Socialnu poistovnu
        </h1>
        <p className="text-muted-foreground">
          Mesacny vykaz poistneho a prispevkov (MVP)
        </p>
      </div>

      {/* Period selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
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
            <Button onClick={handleGenerate} disabled={loading || !activeCompanyId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generujem...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Generovat
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report data */}
      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Zamestnanci</p>
                <p className="text-2xl font-bold">{data.number_of_employees}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Zamestnanec celkom</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_employee)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Zamestnavatel celkom</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_employer)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Spolu</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Employees table */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">
                MVP - {months[data.period.month - 1]} {data.period.year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-2 text-left font-medium" rowSpan={2}>Meno</th>
                      <th className="h-10 px-2 text-right font-medium" rowSpan={2}>Vym. zaklad</th>
                      <th className="h-8 px-2 text-center font-medium border-l" colSpan={2}>Nemoc.</th>
                      <th className="h-8 px-2 text-center font-medium border-l" colSpan={2}>Starob.</th>
                      <th className="h-8 px-2 text-center font-medium border-l" colSpan={2}>Inval.</th>
                      <th className="h-8 px-2 text-center font-medium border-l" colSpan={2}>Nezam.</th>
                      <th className="h-8 px-2 text-center font-medium border-l">Gar.</th>
                      <th className="h-8 px-2 text-center font-medium border-l">Rez.</th>
                      <th className="h-8 px-2 text-center font-medium border-l">Uraz.</th>
                      <th className="h-10 px-2 text-right font-medium border-l" rowSpan={2}>Spolu</th>
                    </tr>
                    <tr className="border-b bg-muted/50">
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zam.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px]">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zam.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px]">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zam.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px]">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zam.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px]">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zav.</th>
                      <th className="h-6 px-2 text-right font-medium text-[10px] border-l">Zav.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employees.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="h-24 text-center text-muted-foreground text-sm">
                          Ziadni zamestnanci za dane obdobie
                        </td>
                      </tr>
                    ) : (
                      data.employees.map((emp) => (
                        <tr key={emp.employee_id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-2 py-2 font-medium text-sm whitespace-nowrap">{emp.name}</td>
                          <td className="px-2 py-2 text-right font-mono">{formatMoney(emp.assessment_base)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.nemocenske.employee)}</td>
                          <td className="px-2 py-2 text-right font-mono">{formatMoney(emp.nemocenske.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.starobne.employee)}</td>
                          <td className="px-2 py-2 text-right font-mono">{formatMoney(emp.starobne.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.invalidne.employee)}</td>
                          <td className="px-2 py-2 text-right font-mono">{formatMoney(emp.invalidne.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.nezamestnanost.employee)}</td>
                          <td className="px-2 py-2 text-right font-mono">{formatMoney(emp.nezamestnanost.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.garancne.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.rezervny_fond.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono border-l">{formatMoney(emp.urazove.employer)}</td>
                          <td className="px-2 py-2 text-right font-mono font-medium border-l">{formatMoney(emp.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.employees.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/50 font-bold text-xs">
                        <td className="px-2 py-3">Celkom</td>
                        <td className="px-2 py-3 text-right font-mono">{formatMoney(data.totals.total_assessment_base)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_nemocenske_employee)}</td>
                        <td className="px-2 py-3 text-right font-mono">{formatMoney(data.totals.total_nemocenske_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_starobne_employee)}</td>
                        <td className="px-2 py-3 text-right font-mono">{formatMoney(data.totals.total_starobne_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_invalidne_employee)}</td>
                        <td className="px-2 py-3 text-right font-mono">{formatMoney(data.totals.total_invalidne_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_nezamestnanost_employee)}</td>
                        <td className="px-2 py-3 text-right font-mono">{formatMoney(data.totals.total_nezamestnanost_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_garancne_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_rezervny_fond_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total_urazove_employer)}</td>
                        <td className="px-2 py-3 text-right font-mono border-l">{formatMoney(data.totals.total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handlePreview} disabled={!data}>
                  <Eye className="mr-2 h-4 w-4" />
                  Nahlad XML
                </Button>
                <Button variant="outline" onClick={handleDownloadXml} disabled={!data}>
                  <Download className="mr-2 h-4 w-4" />
                  Stiahnut XML pre Socialnu poistovnu
                </Button>
              </div>
              {validationResult && (
                <div className="mt-3">
                  <XmlValidationAlert result={validationResult} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Vygenerovane: {new Date(data.generated_at).toLocaleString("sk-SK")}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">Vykaz SP este nebol vygenerovany</p>
              <p className="text-sm">Zvolte obdobie a kliknite na &quot;Generovat&quot;.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="Vykaz SP (MVP) - XML nahlad"
        filename={`mvp_sp_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`}
      />
    </div>
  )
}
