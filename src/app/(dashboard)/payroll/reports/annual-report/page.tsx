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
  Eye,
  Loader2,
  FileText,
  Users,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface AnnualReportEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  total_gross_income: number
  total_insurance_employee: number
  total_nczd: number
  total_tax_base: number
  total_tax_19pct: number
  total_tax_25pct: number
  total_tax_bonus: number
  total_tax_withheld: number
  months_worked: number
}

interface AnnualReportData {
  company: {
    name: string
    ico: string
    dic: string
    address: string
    tax_office: string
  }
  year: number
  number_of_employees: number
  employees: AnnualReportEmployee[]
  totals: {
    total_gross_income: number
    total_insurance_deductions: number
    total_nczd: number
    total_tax_base: number
    total_tax_19pct: number
    total_tax_25pct: number
    total_tax_bonus: number
    total_tax_withheld: number
  }
  generated_at: string
}

const currentDate = new Date()
const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function AnnualReportPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear() - 1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AnnualReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleGenerate = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(
        `/api/payroll/reports/annual-tax?company_id=${activeCompanyId}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setData(json)
        toast({ title: "Vygenerovane", description: "Rocne hlasenie bolo uspesne vygenerovane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat hlasenie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedYear, toast])

  const handleDownloadXml = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=annual-tax&year=${selectedYear}`
      )
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "rocne_hlasenie")
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
      a.download = `rocne_hlasenie_${selectedYear}.xml`
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
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=annual-tax&year=${selectedYear}`
      )
      const xml = await res.text()
      setPreviewXml(xml)
      setPreviewOpen(true)
      const result = validateBeforeDownload(xml, "rocne_hlasenie")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Rocne hlasenie</h1>
        <p className="text-muted-foreground">
          Hlasenie o vyuctovani dane z prijmov zo zavislej cinnosti (§39 ods. 9 ZDP)
        </p>
      </div>

      {/* Year selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Rok</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
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
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Zamestnanci</p>
                </div>
                <p className="text-2xl font-bold">{data.number_of_employees}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Uhrn prijmov</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_gross_income)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Zaklad dane</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_tax_base)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Preddavky dane</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_tax_withheld)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Company info */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">
                Rocne hlasenie za rok {data.year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Zamestnavatel</p>
                  <p className="font-medium">{data.company.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ICO / DIC</p>
                  <p className="font-medium">{data.company.ico} / {data.company.dic}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Danovy urad</p>
                  <p className="font-medium">{data.company.tax_office || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employees table */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Rozpis podla zamestnancov</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-3 text-left font-medium">Meno</th>
                      <th className="h-10 px-3 text-left font-medium">Rodne cislo</th>
                      <th className="h-10 px-3 text-center font-medium">Mes.</th>
                      <th className="h-10 px-3 text-right font-medium">Prijmy</th>
                      <th className="h-10 px-3 text-right font-medium">Poistne</th>
                      <th className="h-10 px-3 text-right font-medium">NCZD</th>
                      <th className="h-10 px-3 text-right font-medium">ZD</th>
                      <th className="h-10 px-3 text-right font-medium">Dan 19%</th>
                      <th className="h-10 px-3 text-right font-medium">Dan 25%</th>
                      <th className="h-10 px-3 text-right font-medium">Bonus</th>
                      <th className="h-10 px-3 text-right font-medium">Preddavok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employees.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="h-24 text-center text-muted-foreground">
                          Ziadni zamestnanci za dane obdobie
                        </td>
                      </tr>
                    ) : (
                      data.employees.map((emp) => (
                        <tr key={emp.employee_id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-medium">{emp.name}</td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{emp.rodne_cislo}</td>
                          <td className="px-3 py-2 text-center">{emp.months_worked}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_gross_income)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_insurance_employee)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_nczd)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_tax_base)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_tax_19pct)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_tax_25pct)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(emp.total_tax_bonus)}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{formatMoney(emp.total_tax_withheld)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.employees.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/50 font-bold">
                        <td className="px-3 py-3" colSpan={3}>Celkom</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_gross_income)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_insurance_deductions)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_nczd)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_tax_base)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_tax_19pct)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_tax_25pct)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_tax_bonus)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(data.totals.total_tax_withheld)}</td>
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
                  Stiahnut XML pre Financnu spravu
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
              <p className="text-lg font-medium mb-1">Rocne hlasenie este nebolo vygenerovane</p>
              <p className="text-sm">Zvolte rok a kliknite na &quot;Generovat&quot;.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="Rocne hlasenie - XML nahlad"
        filename={`rocne_hlasenie_${selectedYear}.xml`}
      />
    </div>
  )
}
