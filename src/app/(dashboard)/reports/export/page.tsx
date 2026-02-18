"use client"

import { useState, useCallback, useEffect } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  FileSpreadsheet,
  Loader2,
  CheckSquare,
  XSquare,
  FileText,
} from "lucide-react"
import { generateCSV } from "@/lib/reports/export-generator"

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
}

interface AuditorSection {
  key: string
  title: string
  headers: string[]
  rows: any[][]
}

interface AuditorPackageData {
  companyName: string
  fiscalYear: string
  generatedAt: string
  sections: AuditorSection[]
}

const EXPORT_TYPES = [
  { value: "invoices", label: "Faktury (vydane)" },
  { value: "invoices-received", label: "Faktury (prijate)" },
  { value: "journal", label: "Uctovne zapisy" },
  { value: "contacts", label: "Kontakty" },
  { value: "employees", label: "Zamestnanci" },
  { value: "products", label: "Produkty" },
  { value: "bank-transactions", label: "Bankove transakcie" },
]

const AUDITOR_SECTIONS = [
  { key: "chart_of_accounts", label: "Uctovy rozvrh" },
  { key: "journal_entries", label: "Uctovne zapisy (dennik)" },
  { key: "trial_balance", label: "Obratova predvaha" },
  { key: "balance_sheet", label: "Suvaha" },
  { key: "profit_loss", label: "Vykaz ziskov a strat" },
  { key: "issued_invoices", label: "Vydane faktury" },
  { key: "received_invoices", label: "Prijate faktury" },
  { key: "bank_statements", label: "Bankove vypisy" },
  { key: "cash_register", label: "Pokladnicna kniha" },
  { key: "asset_register", label: "Register majetku" },
  { key: "payroll_summary", label: "Mzdovy suhrn" },
]

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export default function ReportsExportPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Bulk export state
  const [exportType, setExportType] = useState("invoices")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [bulkExporting, setBulkExporting] = useState(false)

  // Auditor export state
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("")
  const [selectedSections, setSelectedSections] = useState<string[]>(
    AUDITOR_SECTIONS.map((s) => s.key)
  )
  const [auditorExporting, setAuditorExporting] = useState(false)
  const [auditorData, setAuditorData] = useState<AuditorPackageData | null>(
    null
  )

  // Fetch fiscal years
  const fetchFiscalYears = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(
        `/api/fiscal-years?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const json = await res.json()
        const years = json.data || json || []
        setFiscalYears(Array.isArray(years) ? years : [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchFiscalYears()
  }, [fetchFiscalYears])

  // -----------------------------------------------------------------------
  // Bulk CSV export
  // -----------------------------------------------------------------------

  const handleBulkExport = async () => {
    if (!activeCompanyId) return
    setBulkExporting(true)

    try {
      // Map combined type to API params
      let apiType = exportType
      const filters: Record<string, string> = {}

      if (exportType === "invoices") {
        apiType = "invoices"
        filters.invoice_type = "vydana"
      } else if (exportType === "invoices-received") {
        apiType = "invoices"
        filters.invoice_type = "prijata"
      }

      if (dateFrom) filters.date_from = dateFrom
      if (dateTo) filters.date_to = dateTo
      if (statusFilter) filters.status = statusFilter

      const res = await fetch("/api/reports/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: apiType,
          company_id: activeCompanyId,
          filters,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "Chyba pri exporte")
      }

      // Download the CSV
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
        "export.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export dokonceny",
        description: "CSV subor bol stiahnuty.",
      })
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message || "Nepodarilo sa exportovat data",
        variant: "destructive",
      })
    } finally {
      setBulkExporting(false)
    }
  }

  // -----------------------------------------------------------------------
  // Auditor export
  // -----------------------------------------------------------------------

  const toggleSection = (key: string) => {
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  const selectAllSections = () => {
    setSelectedSections(AUDITOR_SECTIONS.map((s) => s.key))
  }

  const deselectAllSections = () => {
    setSelectedSections([])
  }

  const handleAuditorExport = async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    if (selectedSections.length === 0) {
      toast({
        title: "Ziadna sekcia",
        description: "Vyberte aspon jednu sekciu na export.",
        variant: "destructive",
      })
      return
    }

    setAuditorExporting(true)
    setAuditorData(null)

    try {
      const res = await fetch("/api/reports/export/auditor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          fiscal_year_id: selectedFiscalYear,
          sections: selectedSections,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "Chyba pri generovani")
      }

      const data: AuditorPackageData = await res.json()
      setAuditorData(data)

      toast({
        title: "Export vygenerovany",
        description: `Balík obsahuje ${data.sections.length} sekcii.`,
      })
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message || "Nepodarilo sa generovat export",
        variant: "destructive",
      })
    } finally {
      setAuditorExporting(false)
    }
  }

  const downloadSectionCSV = (section: AuditorSection) => {
    const csv = generateCSV(section.headers, section.rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${section.key}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const downloadAllSectionsCSV = () => {
    if (!auditorData) return
    for (const section of auditorData.sections) {
      downloadSectionCSV(section)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!activeCompanyId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Najprv vyberte firmu pre generovanie exportov.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Export dat</h1>
        <p className="text-muted-foreground">
          Hromadny export dat a export pre auditora
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Bulk data export */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Hromadny export dat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Typ exportu</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Datum od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Datum do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {(exportType === "invoices" ||
              exportType === "invoices-received") && (
              <div className="space-y-2">
                <Label>Stav</Label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vsetky" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vsetky</SelectItem>
                    <SelectItem value="draft">Koncept</SelectItem>
                    <SelectItem value="sent">Odoslana</SelectItem>
                    <SelectItem value="paid">Uhradena</SelectItem>
                    <SelectItem value="overdue">Po splatnosti</SelectItem>
                    <SelectItem value="cancelled">Zrusena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button onClick={handleBulkExport} disabled={bulkExporting}>
            {bulkExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportovat CSV
          </Button>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Auditor export */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export pre auditora
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label>Uctovne obdobie</Label>
            <Select
              value={selectedFiscalYear}
              onValueChange={setSelectedFiscalYear}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte obdobie" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((fy) => (
                  <SelectItem key={fy.id} value={fy.id}>
                    {fy.name || `${fy.start_date} - ${fy.end_date}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllSections}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Vybrat vsetko
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllSections}
              >
                <XSquare className="h-4 w-4 mr-1" />
                Zrusit vyber
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {AUDITOR_SECTIONS.map((section) => (
                <label
                  key={section.key}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedSections.includes(section.key)}
                    onCheckedChange={() => toggleSection(section.key)}
                  />
                  <span className="text-sm">{section.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            onClick={handleAuditorExport}
            disabled={
              auditorExporting ||
              !selectedFiscalYear ||
              selectedSections.length === 0
            }
          >
            {auditorExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generovat export
          </Button>

          {/* Auditor results */}
          {auditorData && (
            <div className="space-y-4 mt-6">
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {auditorData.companyName} - {auditorData.fiscalYear}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Vygenerovane: {new Date(auditorData.generatedAt).toLocaleString("sk-SK")}
                  </p>
                </div>
                <Button variant="outline" onClick={downloadAllSectionsCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Stiahnut vsetko (CSV)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {auditorData.sections.map((section) => (
                  <Card key={section.key} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{section.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {section.rows.length} zaznamov
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadSectionCSV(section)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {auditorData.sections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ziadne data na export pre zvolene sekcie a obdobie.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
