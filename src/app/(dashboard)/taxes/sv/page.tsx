"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Calculator,
  Save,
  FileCode,
  Download,
  Send,
  Globe,
  ArrowLeft,
  Loader2,
  FileText,
  Trash2,
  Eye,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface SVRecord {
  ic_dph_customer: string
  customer_name: string
  country_code: string
  total_value: number
  supply_type: "goods" | "services" | "triangular"
}

interface SVData {
  records: SVRecord[]
  total_goods: number
  total_services: number
  total_triangular: number
  grand_total: number
}

interface TaxReturn {
  id: string
  type: string
  period_from: string
  period_to: string
  status: string
  recognition_type: string
  xml_content: string | null
  data: any
  created_at: string
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("sk-SK").format(new Date(dateStr))
}

const supplyTypeLabels: Record<string, string> = {
  goods: "Tovar",
  services: "Sluzby",
  triangular: "Trojstranny obchod",
}

const periodTypeOptions = [
  { value: "monthly", label: "Mesacne" },
  { value: "quarterly", label: "Stvrtrocne" },
]

const months = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "Marec" },
  { value: 4, label: "April" },
  { value: 5, label: "Maj" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

const quarters = [
  { value: 1, label: "Q1 (jan-mar)" },
  { value: 2, label: "Q2 (apr-jun)" },
  { value: 3, label: "Q3 (jul-sep)" },
  { value: 4, label: "Q4 (okt-dec)" },
]

const statusLabels: Record<string, string> = {
  draft: "Navrh",
  submitted: "Odoslany",
  accepted: "Prijaty",
}

const recognitionLabels: Record<string, string> = {
  riadne: "Riadne",
  opravne: "Opravne",
  dodatocne: "Dodatocne",
}

export default function SVPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Period selection
  const currentYear = new Date().getFullYear()
  const [periodType, setPeriodType] = useState("monthly")
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [recognitionType, setRecognitionType] = useState("riadne")

  // Calculation results
  const [svData, setSvData] = useState<SVData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Previous returns
  const [previousReturns, setPreviousReturns] = useState<TaxReturn[]>([])
  const [loadingReturns, setLoadingReturns] = useState(true)

  // XML preview & validation
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  // Compute period dates
  const getPeriodDates = useCallback(() => {
    if (periodType === "monthly") {
      const monthStr = String(month).padStart(2, "0")
      const lastDay = new Date(year, month, 0).getDate()
      return {
        period_from: `${year}-${monthStr}-01`,
        period_to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
      }
    } else {
      const startMonth = (quarter - 1) * 3 + 1
      const endMonth = quarter * 3
      const startMonthStr = String(startMonth).padStart(2, "0")
      const endMonthStr = String(endMonth).padStart(2, "0")
      const lastDay = new Date(year, endMonth, 0).getDate()
      return {
        period_from: `${year}-${startMonthStr}-01`,
        period_to: `${year}-${endMonthStr}-${String(lastDay).padStart(2, "0")}`,
      }
    }
  }, [periodType, year, month, quarter])

  // Fetch previous returns
  const fetchReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingReturns(true)
    try {
      const res = await fetch(`/api/tax-returns/sv?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setPreviousReturns(json.data || [])
      }
    } catch {
      // Silent fail for previous returns
    } finally {
      setLoadingReturns(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  // Calculate SV
  const handleCalculate = async () => {
    if (!activeCompanyId) return
    setCalculating(true)
    setSvData(null)

    try {
      const { period_from, period_to } = getPeriodDates()

      const res = await fetch("/api/tax-returns/sv/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          period_from,
          period_to,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setSvData(json.data)
        toast({ title: "Suhrnny vykaz vypocitany" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa vypocitat SV" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat SV" })
    } finally {
      setCalculating(false)
    }
  }

  // Save SV
  const handleSave = async (generateXml = false) => {
    if (!activeCompanyId || !svData) return
    setSaving(true)

    try {
      const { period_from, period_to } = getPeriodDates()

      const res = await fetch("/api/tax-returns/sv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          period_from,
          period_to,
          recognition_type: recognitionType,
          generate_xml: generateXml,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: generateXml ? "SV ulozeny a XML vygenerovane" : "Suhrnny vykaz ulozeny" })
        fetchReturns()

        // If XML was generated, offer download
        if (generateXml && json.xml_content) {
          downloadXml(json.xml_content, `SV_${year}_${periodType === "monthly" ? month : "Q" + quarter}.xml`)
          const result = validateBeforeDownload(json.xml_content, "sv")
          setValidationResult(result)
          setPreviewXml(json.xml_content)
        }
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa ulozit SV" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit SV" })
    } finally {
      setSaving(false)
    }
  }

  // Download XML from a previous return
  const handleDownloadXml = (taxReturn: TaxReturn) => {
    if (!taxReturn.xml_content) {
      toast({ variant: "destructive", title: "Chyba", description: "XML nebolo vygenerovane" })
      return
    }
    const periodLabel = taxReturn.period_from.substring(0, 7)
    downloadXml(taxReturn.xml_content, `SV_${periodLabel}.xml`)
  }

  const downloadXml = (xmlContent: string, filename: string) => {
    const blob = new Blob([xmlContent], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePreviewReturn = (taxReturn: TaxReturn) => {
    if (!taxReturn.xml_content) {
      toast({ variant: "destructive", title: "Chyba", description: "XML nebolo vygenerovane" })
      return
    }
    setPreviewXml(taxReturn.xml_content)
    setPreviewOpen(true)
    const result = validateBeforeDownload(taxReturn.xml_content, "sv")
    setValidationResult(result)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suhrnny vykaz</h1>
          <p className="text-muted-foreground">
            EU Summary Declaration - prehled dodavok tovaru a sluzieb do EU
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Obdobie a parametre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Period type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Typ obdobia</label>
              <div className="flex gap-1">
                {periodTypeOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={periodType === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodType(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm font-medium mb-1 block">Rok</label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
                className="w-24"
                min={2020}
                max={2030}
              />
            </div>

            {/* Month or Quarter */}
            {periodType === "monthly" ? (
              <div>
                <label className="text-sm font-medium mb-1 block">Mesiac</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">Stvrtrok</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(parseInt(e.target.value))}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {quarters.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recognition type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Druh</label>
              <select
                value={recognitionType}
                onChange={(e) => setRecognitionType(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="riadne">Riadne</option>
                <option value="opravne">Opravne</option>
                <option value="dodatocne">Dodatocne</option>
              </select>
            </div>

            {/* Calculate button */}
            <Button onClick={handleCalculate} disabled={calculating || !activeCompanyId}>
              {calculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Vypocitat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {svData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tovar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(svData.total_goods)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sluzby</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(svData.total_services)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Trojstranny obchod</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(svData.total_triangular)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Celkom</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatMoney(svData.grand_total)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Records Table */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Zaznamy ({svData.records.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">#</th>
                      <th className="h-10 px-4 text-left font-medium">IC DPH</th>
                      <th className="h-10 px-4 text-left font-medium">Odberatel</th>
                      <th className="h-10 px-4 text-left font-medium">Krajina</th>
                      <th className="h-10 px-4 text-left font-medium">Typ dodavky</th>
                      <th className="h-10 px-4 text-right font-medium">Hodnota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {svData.records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          <div>
                            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Ziadne EU dodavky v zvolenom obdobi.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      svData.records.map((record, index) => (
                        <tr key={`${record.ic_dph_customer}-${record.supply_type}`} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2 text-muted-foreground">{index + 1}</td>
                          <td className="px-4 py-2 font-mono text-sm">{record.ic_dph_customer}</td>
                          <td className="px-4 py-2">{record.customer_name}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {record.country_code}
                            </span>
                          </td>
                          <td className="px-4 py-2">{supplyTypeLabels[record.supply_type] || record.supply_type}</td>
                          <td className="px-4 py-2 text-right font-mono">{formatMoney(record.total_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {svData.records.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/50 font-medium">
                        <td className="px-4 py-3" colSpan={5}>Celkom</td>
                        <td className="px-4 py-3 text-right font-mono">{formatMoney(svData.grand_total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Ulozit
                </Button>
                <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                  <FileCode className="mr-2 h-4 w-4" />
                  Generovat XML
                </Button>
                <Button variant="outline" onClick={() => { if (previewXml) setPreviewOpen(true) }} disabled={!previewXml}>
                  <Eye className="mr-2 h-4 w-4" />
                  Nahlad XML
                </Button>
                <Button variant="outline" disabled>
                  <Send className="mr-2 h-4 w-4" />
                  Odoslat
                </Button>
              </div>
              <XmlValidationAlert result={validationResult} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Previous Returns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predchadzajuce suhrnne vykazy</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Druh</th>
                  <th className="h-10 px-4 text-left font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Celkova suma</th>
                  <th className="h-10 px-4 text-left font-medium">Vytvorene</th>
                  <th className="h-10 px-4 text-center font-medium">XML</th>
                </tr>
              </thead>
              <tbody>
                {loadingReturns ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Nacitavam...
                    </td>
                  </tr>
                ) : previousReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-16 text-center text-muted-foreground">
                      Ziadne predchadzajuce suhrnne vykazy.
                    </td>
                  </tr>
                ) : (
                  previousReturns.map((ret) => {
                    const retData = ret.data as SVData | null
                    return (
                      <tr key={ret.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2">
                          {formatDate(ret.period_from)} - {formatDate(ret.period_to)}
                        </td>
                        <td className="px-4 py-2">
                          {recognitionLabels[ret.recognition_type] || ret.recognition_type}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ret.status === "submitted"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}>
                            {statusLabels[ret.status] || ret.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {retData ? formatMoney(retData.grand_total) : "-"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(ret.created_at)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {ret.xml_content ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewReturn(ret)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadXml(ret)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="Suhrnny vykaz - XML nahlad"
        filename={`SV_${year}_${periodType === "monthly" ? month : "Q" + quarter}.xml`}
      />
    </div>
  )
}
