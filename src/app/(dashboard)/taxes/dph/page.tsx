"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Calculator,
  Download,
  Save,
  Send,
  FileText,
  Loader2,
  Trash2,
  Eye,
  Clock,
  Search,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"
import { calculateNextDPHDeadline } from "@/lib/tax/dph-deadlines"

interface DPHData {
  output_vat_base_23: number
  output_vat_amount_23: number
  output_vat_base_19: number
  output_vat_amount_19: number
  output_vat_base_5: number
  output_vat_amount_5: number
  output_vat_total: number
  input_vat_base_23: number
  input_vat_amount_23: number
  input_vat_base_19: number
  input_vat_amount_19: number
  input_vat_base_5: number
  input_vat_amount_5: number
  input_vat_total: number
  own_tax_liability: number
  excess_deduction: number
  issued_invoice_count: number
  received_invoice_count: number
}

interface TaxReturn {
  id: string
  type: string
  period_from: string
  period_to: string
  status: string
  recognition_type: string
  submitted_at: string | null
  created_at: string
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  final: { label: "Finalizovane", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  submitted: { label: "Podane", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function DPHPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Period selector state
  const currentDate = new Date()
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month")
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()) // Previous month
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil(currentDate.getMonth() / 3) || 1)
  const [recognitionType, setRecognitionType] = useState<"riadne" | "opravne" | "dodatocne">("riadne")

  // Data state
  const [dphData, setDphData] = useState<DPHData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedReturnId, setSavedReturnId] = useState<string | null>(null)

  // XML preview and validation state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

  // Crosscheck state
  const [crosscheckResult, setCrosscheckResult] = useState<any>(null)
  const [crosschecking, setCrosschecking] = useState(false)

  // Previous returns
  const [previousReturns, setPreviousReturns] = useState<TaxReturn[]>([])
  const [loadingReturns, setLoadingReturns] = useState(true)

  // Calculate period dates
  const getPeriodDates = () => {
    if (periodType === "month") {
      const startDate = new Date(selectedYear, selectedMonth, 1)
      const endDate = new Date(selectedYear, selectedMonth + 1, 0)
      return {
        period_from: startDate.toISOString().split("T")[0],
        period_to: endDate.toISOString().split("T")[0],
      }
    } else {
      const startMonth = (selectedQuarter - 1) * 3
      const startDate = new Date(selectedYear, startMonth, 1)
      const endDate = new Date(selectedYear, startMonth + 3, 0)
      return {
        period_from: startDate.toISOString().split("T")[0],
        period_to: endDate.toISOString().split("T")[0],
      }
    }
  }

  // Fetch previous DPH returns
  const fetchPreviousReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingReturns(true)
    try {
      const res = await fetch(`/api/tax-returns?company_id=${activeCompanyId}&type=dph&limit=10`)
      const json = await res.json()
      if (res.ok) {
        setPreviousReturns(json.data || [])
      }
    } catch {
      // Silent fail for list
    } finally {
      setLoadingReturns(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchPreviousReturns()
  }, [fetchPreviousReturns])

  // Calculate DPH
  const handleCalculate = async () => {
    if (!activeCompanyId) return
    setCalculating(true)
    setDphData(null)
    setSavedReturnId(null)

    try {
      const { period_from, period_to } = getPeriodDates()
      const res = await fetch("/api/tax-returns/dph/calculate", {
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
        setDphData(json)
        toast({ title: "DPH vypocitane", description: "Udaje boli uspesne vypocitane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat DPH" })
    } finally {
      setCalculating(false)
    }
  }

  // Save as draft
  const handleSave = async () => {
    if (!activeCompanyId || !dphData) return
    setSaving(true)

    try {
      const { period_from, period_to } = getPeriodDates()
      const res = await fetch("/api/tax-returns/dph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          period_from,
          period_to,
          recognition_type: recognitionType,
          data: dphData,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setSavedReturnId(json.id)
        toast({ title: "Ulozene", description: "DPH priznanie bolo ulozene ako koncept" })
        fetchPreviousReturns()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit DPH priznanie" })
    } finally {
      setSaving(false)
    }
  }

  // Preview XML
  const handlePreview = async () => {
    if (!savedReturnId) return
    try {
      const res = await fetch(`/api/tax-returns/${savedReturnId}/download-xml`)
      const xml = await res.text()
      setPreviewXml(xml)
      setPreviewOpen(true)
      const result = validateBeforeDownload(xml, "dph")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  // Download XML with validation
  const handleValidatedDownload = async () => {
    if (!savedReturnId) {
      toast({ variant: "destructive", title: "Chyba", description: "Najprv ulozite priznanie" })
      return
    }
    try {
      const res = await fetch(`/api/tax-returns/${savedReturnId}/download-xml`)
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "dph")
      setValidationResult(result)
      if (!result.valid) {
        toast({ variant: "destructive", title: "Validacia zlyhala", description: "Opravte chyby pred stiahnutim" })
        return
      }
      // Proceed with download
      const blob = new Blob([xml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dph_priznanie.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stiahnut XML" })
    }
  }

  // Submit
  const handleSubmit = async () => {
    if (!savedReturnId) {
      toast({ variant: "destructive", title: "Chyba", description: "Najprv ulozite priznanie" })
      return
    }

    if (!confirm("Naozaj chcete oznacit toto priznanie ako podane? Tuto akciu nie je mozne vratit.")) return

    try {
      const res = await fetch(`/api/tax-returns/${savedReturnId}/submit`, {
        method: "POST",
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: "Podane", description: "DPH priznanie bolo oznacene ako podane" })
        fetchPreviousReturns()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa podat DPH priznanie" })
    }
  }

  // Delete a previous return
  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit toto danove priznanie?")) return

    try {
      const res = await fetch(`/api/tax-returns/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Odstranene" })
        fetchPreviousReturns()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit priznanie" })
    }
  }

  // DPH deadline banner
  const deadline = calculateNextDPHDeadline("mesacne") // TODO: get from company settings

  const deadlineColors = {
    ok: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/20 dark:border-yellow-800 dark:text-yellow-400",
    urgent: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-400",
    overdue: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400",
  }

  // Crosscheck handler
  const handleCrosscheck = async () => {
    if (!activeCompanyId || !getPeriodDates().period_from || !getPeriodDates().period_to) return
    setCrosschecking(true)
    try {
      const { period_from: periodFrom, period_to: periodTo } = getPeriodDates()
      const res = await fetch("/api/tax-returns/dph/crosscheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId, period_from: periodFrom, period_to: periodTo }),
      })
      const data = await res.json()
      setCrosscheckResult(data)
    } catch { toast({ variant: "destructive", title: "Chyba" }) }
    finally { setCrosschecking(false) }
  }

  const months = [
    "Januar", "Februar", "Marec", "April", "Maj", "Jun",
    "Jul", "August", "September", "Oktober", "November", "December",
  ]

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">DPH priznanie</h1>
        <p className="text-muted-foreground">Priznanie k dani z pridanej hodnoty</p>
      </div>

      <div className={`rounded-lg border p-3 mb-6 flex items-center gap-2 ${deadlineColors[deadline.warningLevel]}`}>
        <Clock className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">
          {deadline.isOverdue
            ? `DPH za ${deadline.periodLabel} je po termíne! (termín bol ${deadline.deadlineDate})`
            : `Máte ${deadline.daysRemaining} dní na podanie DPH za ${deadline.periodLabel} (termín: ${deadline.deadlineDate})`
          }
        </span>
      </div>

      {/* Period selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Obdobie a typ priznania</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Typ obdobia</label>
              <div className="flex gap-1">
                <Button
                  variant={periodType === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodType("month")}
                >
                  Mesacne
                </Button>
                <Button
                  variant={periodType === "quarter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodType("quarter")}
                >
                  Stvrtrocne
                </Button>
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm font-medium mb-1 block">Rok</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month or Quarter */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {periodType === "month" ? "Mesiac" : "Stvrrok"}
              </label>
              {periodType === "month" ? (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {months.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              ) : (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                >
                  <option value={1}>Q1 (januar - marec)</option>
                  <option value={2}>Q2 (april - jun)</option>
                  <option value={3}>Q3 (jul - september)</option>
                  <option value={4}>Q4 (oktober - december)</option>
                </select>
              )}
            </div>

            {/* Recognition type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Druh priznania</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={recognitionType}
                onChange={(e) => setRecognitionType(e.target.value as "riadne" | "opravne" | "dodatocne")}
              >
                <option value="riadne">Riadne</option>
                <option value="opravne">Opravne</option>
                <option value="dodatocne">Dodatocne</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleCalculate} disabled={calculating || !activeCompanyId}>
              {calculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pocitam...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Vypocitat
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              Obdobie: {getPeriodDates().period_from} az {getPeriodDates().period_to}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {dphData && (
        <>
          {/* Output VAT */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Vystupna DPH (z vydanych faktur)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Sadzba DPH</th>
                      <th className="h-10 px-4 text-right font-medium">Zaklad dane</th>
                      <th className="h-10 px-4 text-right font-medium">DPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">23%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_base_23)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_amount_23)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">19%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_base_19)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_amount_19)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">5%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_base_5)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_amount_5)}</td>
                    </tr>
                    <tr className="border-b bg-muted/30 font-medium">
                      <td className="px-4 py-3">Celkom</td>
                      <td className="px-4 py-3 text-right font-mono">-</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.output_vat_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pocet vydanych faktur: {dphData.issued_invoice_count}
              </p>
            </CardContent>
          </Card>

          {/* Input VAT */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Vstupna DPH (z prijatych faktur)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Sadzba DPH</th>
                      <th className="h-10 px-4 text-right font-medium">Zaklad dane</th>
                      <th className="h-10 px-4 text-right font-medium">DPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">23%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_base_23)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_amount_23)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">19%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_base_19)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_amount_19)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">5%</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_base_5)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_amount_5)}</td>
                    </tr>
                    <tr className="border-b bg-muted/30 font-medium">
                      <td className="px-4 py-3">Celkom</td>
                      <td className="px-4 py-3 text-right font-mono">-</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(dphData.input_vat_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pocet prijatych faktur: {dphData.received_invoice_count}
              </p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Vysledok</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${
                  dphData.own_tax_liability > 0
                    ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                }`}>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Vlastna danova povinnost</p>
                  <p className={`text-2xl font-bold ${
                    dphData.own_tax_liability > 0 ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {formatMoney(dphData.own_tax_liability)}
                  </p>
                  {dphData.own_tax_liability > 0 && (
                    <p className="text-xs text-red-600 mt-1">Suma na uhradu danovemu uradu</p>
                  )}
                </div>
                <div className={`p-4 rounded-lg border ${
                  dphData.excess_deduction > 0
                    ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                }`}>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nadmerny odpocet</p>
                  <p className={`text-2xl font-bold ${
                    dphData.excess_deduction > 0 ? "text-green-600" : "text-muted-foreground"
                  }`}>
                    {formatMoney(dphData.excess_deduction)}
                  </p>
                  {dphData.excess_deduction > 0 && (
                    <p className="text-xs text-green-600 mt-1">Suma na vratenie od danoveho uradu</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-6">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ukladam...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Ulozit ako koncept
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!savedReturnId}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Nahlad
                </Button>
                <Button
                  variant="outline"
                  onClick={handleValidatedDownload}
                  disabled={!savedReturnId}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Stiahnut XML
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSubmit}
                  disabled={!savedReturnId}
                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Oznacit ako podane
                </Button>
              </div>

              <XmlValidationAlert result={validationResult} />

              {savedReturnId && (
                <p className="text-xs text-muted-foreground mt-2">
                  Priznanie ulozene (ID: {savedReturnId.substring(0, 8)}...)
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Krížová kontrola */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Krížová kontrola</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCrosscheck} disabled={crosschecking}>
              {crosschecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Skontrolovať
            </Button>
          </div>
        </CardHeader>
        {crosscheckResult && (
          <CardContent>
            <div className={`rounded-lg border p-4 ${crosscheckResult.isMatched ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                {crosscheckResult.isMatched ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                <span className="font-medium">{crosscheckResult.isMatched ? "Zhoda" : "Nesúlad"}</span>
              </div>
              <p className="text-sm">{crosscheckResult.details}</p>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>DPH z faktúr (netto): <span className="font-mono font-bold">{crosscheckResult.invoiceNetVAT?.toFixed(2)} €</span></div>
                <div>Zostatok účtu 343: <span className="font-mono font-bold">{crosscheckResult.account343Balance?.toFixed(2)} €</span></div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Previous DPH returns */}
      <Card>
        <CardHeader>
          <CardTitle>Predchadzajuce DPH priznania</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Obdobie</th>
                  <th className="h-10 px-4 text-left font-medium">Druh</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-left font-medium">Vytvorene</th>
                  <th className="h-10 px-4 text-left font-medium">Podane</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loadingReturns ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">Nacitavam...</td>
                  </tr>
                ) : previousReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemáte ziadne DPH priznania.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  previousReturns.map((tr) => (
                    <tr key={tr.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {formatDate(tr.period_from)} - {formatDate(tr.period_to)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{tr.recognition_type}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[tr.status]?.class || ""
                        }`}>
                          {statusLabels[tr.status]?.label || tr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(tr.created_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tr.submitted_at ? formatDate(tr.submitted_at) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/api/tax-returns/${tr.id}/download-xml`, "_blank")}
                            title="Stiahnut XML"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {tr.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(tr.id)}
                              title="Odstranit"
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
        </CardContent>
      </Card>

      <XmlPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        xmlContent={previewXml}
        title="DPH priznanie - XML nahlad"
        filename="dph_priznanie.xml"
      />
    </div>
  )
}
