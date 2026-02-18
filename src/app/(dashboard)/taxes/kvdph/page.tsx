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
} from "lucide-react"
import { XmlPreviewDialog } from "@/components/tax/xml-preview-dialog"
import { XmlValidationAlert } from "@/components/tax/xml-validation-alert"
import { validateBeforeDownload } from "@/lib/edane/xml-validator"

interface KVDPHRecord {
  ic_dph: string
  invoice_number: string
  invoice_date: string
  vat_base: number
  vat_amount: number
  vat_rate: number
}

interface KVDPHData {
  a1: KVDPHRecord[]
  a2: KVDPHRecord[]
  b1: KVDPHRecord[]
  b2: KVDPHRecord[]
  b3: KVDPHRecord[]
  c1: KVDPHRecord[]
  c2: KVDPHRecord[]
  d1: KVDPHRecord[]
  d2: KVDPHRecord[]
  counts?: Record<string, number>
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

type SectionKey = "a1" | "a2" | "b1" | "b2" | "b3" | "c1" | "c2" | "d1" | "d2"

const sectionLabels: Record<SectionKey, string> = {
  a1: "A.1 - Vydane, DPH >= 5000",
  a2: "A.2 - Vydane, DPH < 5000",
  b1: "B.1 - Prijate, DPH >= 5000",
  b2: "B.2 - Prijate, DPH < 5000",
  b3: "B.3 - Prijate zjednodusene",
  c1: "C.1 - Vydane dobropisy",
  c2: "C.2 - Prijate dobropisy",
  d1: "D.1 - Tuzemsky prenos - dodavatel",
  d2: "D.2 - Tuzemsky prenos - odberatel",
}

const sectionKeys: SectionKey[] = ["a1", "a2", "b1", "b2", "b3", "c1", "c2", "d1", "d2"]

function formatMoney(amount: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function KVDPHPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Period selector state
  const currentDate = new Date()
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month")
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil(currentDate.getMonth() / 3) || 1)
  const [recognitionType, setRecognitionType] = useState<"riadne" | "opravne" | "dodatocne">("riadne")

  // Data state
  const [kvdphData, setKvdphData] = useState<KVDPHData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedReturnId, setSavedReturnId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SectionKey>("a1")

  // XML preview and validation state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewXml, setPreviewXml] = useState("")
  const [validationResult, setValidationResult] = useState<any>(null)

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

  // Fetch previous KV DPH returns
  const fetchPreviousReturns = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingReturns(true)
    try {
      const res = await fetch(`/api/tax-returns?company_id=${activeCompanyId}&type=kv_dph&limit=10`)
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

  // Calculate KV DPH
  const handleCalculate = async () => {
    if (!activeCompanyId) return
    setCalculating(true)
    setKvdphData(null)
    setSavedReturnId(null)

    try {
      const { period_from, period_to } = getPeriodDates()
      const res = await fetch("/api/tax-returns/kvdph/calculate", {
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
        setKvdphData(json)
        toast({ title: "KV DPH vypocitane", description: "Udaje boli uspesne vypocitane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vypocitat KV DPH" })
    } finally {
      setCalculating(false)
    }
  }

  // Save as draft
  const handleSave = async () => {
    if (!activeCompanyId || !kvdphData) return
    setSaving(true)

    try {
      const { period_from, period_to } = getPeriodDates()
      // Remove counts before saving
      const { counts, ...dataToSave } = kvdphData
      const res = await fetch("/api/tax-returns/kvdph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          period_from,
          period_to,
          recognition_type: recognitionType,
          data: dataToSave,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setSavedReturnId(json.id)
        toast({ title: "Ulozene", description: "KV DPH bolo ulozene ako koncept" })
        fetchPreviousReturns()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit KV DPH" })
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
      const result = validateBeforeDownload(xml, "kvdph")
      setValidationResult(result)
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat XML" })
    }
  }

  // Download XML with validation
  const handleValidatedDownload = async () => {
    if (!savedReturnId) {
      toast({ variant: "destructive", title: "Chyba", description: "Najprv ulozite vykaz" })
      return
    }
    try {
      const res = await fetch(`/api/tax-returns/${savedReturnId}/download-xml`)
      const xml = await res.text()
      const result = validateBeforeDownload(xml, "kvdph")
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
      a.download = `kvdph_vykaz.xml`
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
      toast({ variant: "destructive", title: "Chyba", description: "Najprv ulozite vykaz" })
      return
    }

    if (!confirm("Naozaj chcete oznacit tento vykaz ako podany? Tuto akciu nie je mozne vratit.")) return

    try {
      const res = await fetch(`/api/tax-returns/${savedReturnId}/submit`, {
        method: "POST",
      })

      const json = await res.json()

      if (res.ok) {
        toast({ title: "Podane", description: "KV DPH bolo oznacene ako podane" })
        fetchPreviousReturns()
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa podat KV DPH" })
    }
  }

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento kontrolny vykaz?")) return
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
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit vykaz" })
    }
  }

  // Get record count for a section
  const getSectionCount = (key: SectionKey): number => {
    if (!kvdphData) return 0
    return kvdphData[key]?.length || 0
  }

  // Get total records
  const getTotalRecords = (): number => {
    if (!kvdphData) return 0
    return sectionKeys.reduce((sum, key) => sum + getSectionCount(key), 0)
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
        <h1 className="text-3xl font-bold tracking-tight">Kontrolny vykaz DPH</h1>
        <p className="text-muted-foreground">Kontrolny vykaz k dani z pridanej hodnoty</p>
      </div>

      {/* Period selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Obdobie a typ vykazu</CardTitle>
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
              <label className="text-sm font-medium mb-1 block">Druh vykazu</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={recognitionType}
                onChange={(e) => setRecognitionType(e.target.value as "riadne" | "opravne" | "dodatocne")}
              >
                <option value="riadne">Riadny</option>
                <option value="opravne">Opravny</option>
                <option value="dodatocne">Dodatocny</option>
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
      {kvdphData && (
        <>
          {/* Summary */}
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Vysledok - celkom {getTotalRecords()} zaznamov
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ukladam...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Ulozit
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={!savedReturnId}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Nahlad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleValidatedDownload}
                    disabled={!savedReturnId}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Stiahnut XML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!savedReturnId}
                    className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Oznacit ako podane
                  </Button>
                </div>
              </div>
              <XmlValidationAlert result={validationResult} />
              {savedReturnId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Vykaz ulozeny (ID: {savedReturnId.substring(0, 8)}...)
                </p>
              )}
            </CardHeader>
          </Card>

          {/* Section tabs */}
          <Card className="mb-6">
            <CardContent className="p-0">
              {/* Tab navigation */}
              <div className="flex flex-wrap border-b">
                {sectionKeys.map((key) => (
                  <button
                    key={key}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                    }`}
                    onClick={() => setActiveTab(key)}
                  >
                    {key.toUpperCase()} ({getSectionCount(key)})
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {sectionLabels[activeTab]}
                </h3>

                {getSectionCount(activeTab) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">V tejto sekcii nie su ziadne zaznamy</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium">IC DPH</th>
                          <th className="h-10 px-4 text-left font-medium">Cislo faktury</th>
                          <th className="h-10 px-4 text-left font-medium">Datum</th>
                          <th className="h-10 px-4 text-right font-medium">Zaklad dane</th>
                          <th className="h-10 px-4 text-right font-medium">DPH</th>
                          <th className="h-10 px-4 text-right font-medium">Sadzba</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kvdphData[activeTab] || []).map((record: KVDPHRecord, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs">{record.ic_dph || "-"}</td>
                            <td className="px-4 py-3">{record.invoice_number}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(record.invoice_date)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(record.vat_base)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(record.vat_amount)}</td>
                            <td className="px-4 py-3 text-right">{record.vat_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30 font-medium">
                          <td colSpan={3} className="px-4 py-3">Celkom ({getSectionCount(activeTab)} zaznamov)</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatMoney(
                              (kvdphData[activeTab] || []).reduce((sum: number, r: KVDPHRecord) => sum + r.vat_base, 0)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatMoney(
                              (kvdphData[activeTab] || []).reduce((sum: number, r: KVDPHRecord) => sum + r.vat_amount, 0)
                            )}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Previous KV DPH returns */}
      <Card>
        <CardHeader>
          <CardTitle>Predchadzajuce kontrolne vykazy</CardTitle>
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
                        <p>Zatial nemate ziadne kontrolne vykazy.</p>
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
        title="Kontrolny vykaz DPH - XML nahlad"
        filename="kvdph_vykaz.xml"
      />
    </div>
  )
}
