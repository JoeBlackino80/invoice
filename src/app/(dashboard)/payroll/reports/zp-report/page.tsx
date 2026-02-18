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
  Heart,
  Eye,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface ZPEmployee {
  employee_id: string
  name: string
  rodne_cislo: string
  insurer: string
  insurer_code: string
  assessment_base: number
  insurance_employee: number
  insurance_employer: number
  insurance_total: number
}

interface ZPInsurerGroup {
  insurer: string
  insurer_code: string
  employees: ZPEmployee[]
  totals: {
    total_assessment_base: number
    total_insurance_employee: number
    total_insurance_employer: number
    total_insurance: number
  }
  number_of_employees: number
}

interface ZPReportData {
  company: {
    name: string
    ico: string
    dic: string
    address: string
  }
  period: { month: number; year: number }
  insurers: ZPInsurerGroup[]
  totals: {
    total_assessment_base: number
    total_insurance_employee: number
    total_insurance_employer: number
    total_insurance: number
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

const insurerFilters = [
  { value: "all", label: "Vsetky" },
  { value: "24", label: "VsZP" },
  { value: "25", label: "Dovera" },
  { value: "27", label: "Union" },
]

function formatMoney(amount: number) {
  if (amount === 0) return "-"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

export default function ZPReportPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()
  )
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
  )
  const [selectedInsurer, setSelectedInsurer] = useState("all")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ZPReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleGenerate = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(
        `/api/payroll/reports/zp?company_id=${activeCompanyId}&month=${selectedMonth}&year=${selectedYear}`
      )
      const json = await res.json()
      if (res.ok) {
        setData(json)
        toast({ title: "Vygenerovane", description: "Vykaz ZP bol uspesne vygenerovany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa generovat vykaz ZP" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedMonth, selectedYear, toast])

  const handleDownloadXml = async (insurerCode: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=zp&month=${selectedMonth}&year=${selectedYear}&insurer=${insurerCode}`
      )
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "zp_oznamenie")
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
      a.download = `zp_${insurerCode}_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stiahnut XML" })
    }
  }

  const handlePreview = async (insurerCode: string) => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/payroll/reports/download-xml?company_id=${activeCompanyId}&type=zp&month=${selectedMonth}&year=${selectedYear}&insurer=${insurerCode}`
      )
      const xml = await res.text()
      setPreviewXml(xml)
      setPreviewOpen(true)
      const result = validateBeforeDownload(xml, "zp_oznamenie")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  // Filtrovane skupiny
  const filteredInsurers = data?.insurers?.filter((g) =>
    selectedInsurer === "all" ? true : g.insurer_code === selectedInsurer
  ) || []

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Heart className="h-8 w-8" />
          Vykaz pre zdravotne poistovne
        </h1>
        <p className="text-muted-foreground">
          Mesacne oznamenie platitela poistneho
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
            <div>
              <label className="text-sm font-medium mb-1 block">Poistovna</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
                value={selectedInsurer}
                onChange={(e) => setSelectedInsurer(e.target.value)}
              >
                {insurerFilters.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
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
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_insurance_employee)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Zamestnavatel celkom</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_insurance_employer)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Spolu</p>
                <p className="text-2xl font-bold">{formatMoney(data.totals.total_insurance)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tables per insurer */}
          {filteredInsurers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">Ziadni zamestnanci pre zvolenu poistovnu</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredInsurers.map((group) => (
              <Card key={group.insurer_code} className="mb-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {group.insurer} (kod: {group.insurer_code})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(group.insurer_code)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Nahlad
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadXml(group.insurer_code)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        XML
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {group.number_of_employees} zamestnancov
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium">Meno</th>
                          <th className="h-10 px-4 text-left font-medium">Poistovna</th>
                          <th className="h-10 px-4 text-right font-medium">Vym. zaklad</th>
                          <th className="h-10 px-4 text-right font-medium">Poistne zam.</th>
                          <th className="h-10 px-4 text-right font-medium">Poistne zav.</th>
                          <th className="h-10 px-4 text-right font-medium">Spolu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.employees.map((emp) => (
                          <tr key={emp.employee_id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2 font-medium">{emp.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{emp.insurer}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatMoney(emp.assessment_base)}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatMoney(emp.insurance_employee)}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatMoney(emp.insurance_employer)}</td>
                            <td className="px-4 py-2 text-right font-mono font-medium">{formatMoney(emp.insurance_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/50 font-bold">
                          <td className="px-4 py-3" colSpan={2}>Celkom {group.insurer}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatMoney(group.totals.total_assessment_base)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatMoney(group.totals.total_insurance_employee)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatMoney(group.totals.total_insurance_employer)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatMoney(group.totals.total_insurance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                {data.insurers.map((g) => (
                  <Button
                    key={g.insurer_code}
                    variant="outline"
                    onClick={() => handleDownloadXml(g.insurer_code)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    XML {g.insurer}
                  </Button>
                ))}
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
              <p className="text-lg font-medium mb-1">Vykaz ZP este nebol vygenerovany</p>
              <p className="text-sm">Zvolte obdobie a kliknite na &quot;Generovat&quot;.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="Vykaz ZP - XML nahlad"
        filename={`zp_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xml`}
      />
    </div>
  )
}
