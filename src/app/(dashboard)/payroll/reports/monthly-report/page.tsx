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
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface MonthlyTaxReportData {
  company: {
    name: string
    ico: string
    dic: string
    address: string
    tax_office: string
  }
  period: { month: number; year: number }
  number_of_employees: number
  total_gross_income: number
  total_insurance_deductions: number
  total_nczd: number
  total_tax_base: number
  total_tax_19pct: number
  total_tax_25pct: number
  total_tax_bonus: number
  total_tax_withheld: number
  generated_at: string
}

const months = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

const currentDate = new Date()
const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function MonthlyReportPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()
  )
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
  )
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MonthlyTaxReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleGenerate = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(
        `/api/payroll/reports/monthly-tax?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setData(json)
        toast({ title: "Vygenerovane", description: "Mesacny prehlad bol uspesne vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat prehlad" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedMonth, selectedYear, toast])

  const handleDownloadXml = async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=monthly-tax&month=${selectedMonth}&year=${selectedYear}`
      )
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "mesacny_prehlad")
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
      a.download = `mesacny_prehlad_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`
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
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=monthly-tax&month=${selectedMonth}&year=${selectedYear}`
      )
      const xml = await res.text()
      setPreviewXml(xml)
      setPreviewOpen(true)
      const result = validateBeforeDownload(xml, "mesacny_prehlad")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  const reportRows = data ? [
    { label: "Pocet zamestnancov", value: data.number_of_employees.toString(), isMoney: false },
    { label: "Uhrn prijmov (r. 01)", value: formatMoney(data.total_gross_income), isMoney: true },
    { label: "Poistne zamestnanec (r. 02)", value: formatMoney(data.total_insurance_deductions), isMoney: true },
    { label: "NCZD (r. 03)", value: formatMoney(data.total_nczd), isMoney: true },
    { label: "Zaklad dane (r. 04)", value: formatMoney(data.total_tax_base), isMoney: true },
    { label: "Dan 19% (r. 05)", value: formatMoney(data.total_tax_19pct), isMoney: true },
    { label: "Dan 25% (r. 06)", value: formatMoney(data.total_tax_25pct), isMoney: true },
    { label: "Danovy bonus (r. 07)", value: formatMoney(data.total_tax_bonus), isMoney: true },
    { label: "Preddavok na dan (r. 08)", value: formatMoney(data.total_tax_withheld), isMoney: true },
  ] : []

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Mesacny prehlad</h1>
        <p className="text-muted-foreground">
          Prehlad o zrazenych preddavkoch na dan z prijmov zo zavislej cinnosti (§35 ods. 6 ZDP)
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
          {/* Info header */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">
                Mesacny prehlad - {months[data.period.month - 1]} {data.period.year}
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

          {/* Data table */}
          <Card className="mb-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Polozka</th>
                      <th className="h-10 px-4 text-right font-medium">Hodnota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${
                          idx === reportRows.length - 1
                            ? "bg-muted/30 font-medium"
                            : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="px-4 py-3">{row.label}</td>
                        <td className={`px-4 py-3 text-right ${row.isMoney ? "font-mono" : "font-medium"}`}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
              <p className="text-lg font-medium mb-1">Mesacny prehlad este nebol vygenerovany</p>
              <p className="text-sm">Zvolte obdobie a kliknite na &quot;Generovat&quot;.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="Mesacny prehlad - XML nahlad"
        filename={`mesacny_prehlad_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`}
      />
    </div>
  )
}
