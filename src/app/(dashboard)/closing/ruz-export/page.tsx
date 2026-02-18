"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Shield,
  Send,
} from "lucide-react"

// ---- Types ----

interface FiscalYear {
  id: string
  year: number
  start_date: string
  end_date: string
}

interface ValidationItem {
  key: string
  label: string
  status: "ok" | "warning" | "error"
  message: string
}

interface PreviewData {
  aktiva_netto: number
  pasiva_netto: number
  is_balanced: boolean
  vh_za_obdobie: number
  obchodna_marza: number
  pridana_hodnota: number
  has_balance_sheet: boolean
  has_profit_loss: boolean
}

// ---- Helpers ----

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

// ---- Status tracking ----

type ExportStatus = "draft" | "validated" | "exported"

const statusConfig: Record<ExportStatus, { label: string; color: string }> = {
  draft: { label: "Koncept", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  validated: { label: "Validovane", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  exported: { label: "Exportovane", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
}

// ---- Main Page ----

export default function RuzExportPage() {
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("")
  const [loadingFy, setLoadingFy] = useState(true)
  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [validations, setValidations] = useState<ValidationItem[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [exportStatus, setExportStatus] = useState<ExportStatus>("draft")

  // Fetch fiscal years
  const fetchFiscalYears = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingFy(true)

    try {
      const res = await fetch(`/api/settings/fiscal-years?company_id=${activeCompanyId}`)
      if (res.ok) {
        const fyData = await res.json()
        if (fyData && fyData.length > 0) {
          setFiscalYears(fyData)
          setSelectedFiscalYear(fyData[0].id)
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingFy(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchFiscalYears()
  }, [fetchFiscalYears])

  // Reset when fiscal year changes
  useEffect(() => {
    setValidations([])
    setPreview(null)
    setExportStatus("draft")
  }, [selectedFiscalYear])

  // Validate data
  const handleValidate = useCallback(async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setValidating(true)
    setValidations([])
    setPreview(null)

    const results: ValidationItem[] = []
    let bsData: any = null
    let plData: any = null

    // 1. Check balance sheet
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFiscalYear,
      })

      const bsRes = await fetch(`/api/closing/balance-sheet?${params}`)
      if (bsRes.ok) {
        bsData = await bsRes.json()
        const isBalanced = Math.abs(bsData.aktiva_spolu.netto - bsData.pasiva_spolu.netto) < 0.01

        results.push({
          key: "balance_sheet",
          label: "Suvaha (Uc 1-01)",
          status: isBalanced ? "ok" : "error",
          message: isBalanced
            ? `Suvaha je vyvazena. Aktiva: ${formatMoney(bsData.aktiva_spolu.netto)}`
            : `Suvaha NIE JE vyvazena! Aktiva: ${formatMoney(bsData.aktiva_spolu.netto)}, Pasiva: ${formatMoney(bsData.pasiva_spolu.netto)}`,
        })
      } else {
        results.push({
          key: "balance_sheet",
          label: "Suvaha (Uc 1-01)",
          status: "error",
          message: "Nepodarilo sa vypocitat suvahu",
        })
      }
    } catch {
      results.push({
        key: "balance_sheet",
        label: "Suvaha (Uc 1-01)",
        status: "error",
        message: "Chyba pri vypocte suvahy",
      })
    }

    // 2. Check P&L
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFiscalYear,
      })

      const plRes = await fetch(`/api/closing/profit-loss?${params}`)
      if (plRes.ok) {
        plData = await plRes.json()
        results.push({
          key: "profit_loss",
          label: "Vykaz ziskov a strat (Uc 2-01)",
          status: "ok",
          message: `VH za obdobie: ${formatMoney(plData.vh_za_obdobie.bezne)}`,
        })
      } else {
        results.push({
          key: "profit_loss",
          label: "Vykaz ziskov a strat (Uc 2-01)",
          status: "error",
          message: "Nepodarilo sa vypocitat vykaz ziskov a strat",
        })
      }
    } catch {
      results.push({
        key: "profit_loss",
        label: "Vykaz ziskov a strat (Uc 2-01)",
        status: "error",
        message: "Chyba pri vypocte vykazu ziskov a strat",
      })
    }

    // 3. Check company info
    const companyData = activeCompany as any
    if (companyData) {
      const hasIco = !!companyData.ico
      const hasDic = !!companyData.dic

      results.push({
        key: "company_ico",
        label: "ICO spolocnosti",
        status: hasIco ? "ok" : "error",
        message: hasIco ? `ICO: ${companyData.ico}` : "ICO spolocnosti nie je vyplnene",
      })

      results.push({
        key: "company_dic",
        label: "DIC spolocnosti",
        status: hasDic ? "ok" : "error",
        message: hasDic ? `DIC: ${companyData.dic}` : "DIC spolocnosti nie je vyplnene",
      })
    }

    // 4. Check fiscal year
    const selectedFy = fiscalYears.find((fy) => fy.id === selectedFiscalYear)
    if (selectedFy) {
      results.push({
        key: "fiscal_year",
        label: "Uctovne obdobie",
        status: "ok",
        message: `Obdobie: ${selectedFy.start_date} - ${selectedFy.end_date}`,
      })
    }

    setValidations(results)

    // Build preview
    const hasErrors = results.some((r) => r.status === "error")
    if (bsData || plData) {
      setPreview({
        aktiva_netto: bsData?.aktiva_spolu?.netto || 0,
        pasiva_netto: bsData?.pasiva_spolu?.netto || 0,
        is_balanced: bsData
          ? Math.abs(bsData.aktiva_spolu.netto - bsData.pasiva_spolu.netto) < 0.01
          : false,
        vh_za_obdobie: plData?.vh_za_obdobie?.bezne || 0,
        obchodna_marza: plData?.obchodna_marza?.bezne || 0,
        pridana_hodnota: plData?.pridana_hodnota?.bezne || 0,
        has_balance_sheet: !!bsData,
        has_profit_loss: !!plData,
      })
    }

    if (!hasErrors) {
      setExportStatus("validated")
    }

    setValidating(false)
  }, [activeCompanyId, selectedFiscalYear, activeCompany, fiscalYears])

  // Export XML
  const handleExport = async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setExporting(true)

    try {
      const res = await fetch("/api/closing/ruz-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          fiscal_year_id: selectedFiscalYear,
        }),
      })

      if (res.ok) {
        // Download the XML file
        const blob = await res.blob()
        const contentDisposition = res.headers.get("Content-Disposition")
        let fileName = "uctovna_zavierka.xml"
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/)
          if (match) {
            fileName = match[1]
          }
        }

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        setExportStatus("exported")
        toast({
          title: "XML exportovane",
          description: `Subor ${fileName} bol stiahnuty`,
        })
      } else {
        const json = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa exportovat XML",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa exportovat XML",
      })
    } finally {
      setExporting(false)
    }
  }

  const hasErrors = validations.some((v) => v.status === "error")
  const selectedFy = fiscalYears.find((fy) => fy.id === selectedFiscalYear)

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RUZ Export</h1>
          <p className="text-muted-foreground">
            Export uctovnej zavierky do Registra uctovnych zavierok (RUZ)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              statusConfig[exportStatus].color
            }`}
          >
            {statusConfig[exportStatus].label}
          </span>
        </div>
      </div>

      {/* Fiscal year selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Uctovne obdobie</label>
              {loadingFy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Nacitavam...
                </div>
              ) : fiscalYears.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ziadne uctovne obdobia.
                </p>
              ) : (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(e.target.value)}
                >
                  {fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.year} ({fy.start_date} - {fy.end_date})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button
              onClick={handleValidate}
              disabled={validating || !selectedFiscalYear}
              variant="outline"
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validujem...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Validovat data
                </>
              )}
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || !selectedFiscalYear || hasErrors}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportujem...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Stiahnut XML
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation results */}
      {validations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Validacia dat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validations.map((v) => (
                <div
                  key={v.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    v.status === "ok"
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                      : v.status === "warning"
                      ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  }`}
                >
                  {v.status === "ok" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      v.status === "warning"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`} />
                  )}
                  <div>
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className="text-xs text-muted-foreground">{v.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {hasErrors && (
              <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Nie je mozne exportovat XML kym nie su vyriesene vsetky chyby.
                </p>
              </div>
            )}

            {!hasErrors && validations.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Vsetky kontroly presli uspesne. Mozete pokracovat s exportom.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Prehlad exportovanych dat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Balance sheet preview */}
              <div>
                <h4 className="text-sm font-medium mb-3">Suvaha (Uc 1-01)</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Aktiva netto</td>
                      <td className="py-2 text-right font-mono">
                        {formatMoney(preview.aktiva_netto)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Pasiva</td>
                      <td className="py-2 text-right font-mono">
                        {formatMoney(preview.pasiva_netto)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">Stav</td>
                      <td className="py-2 text-right">
                        {preview.is_balanced ? (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                            Vyvazena
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 text-xs font-medium">
                            Nevyvazena
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* P&L preview */}
              <div>
                <h4 className="text-sm font-medium mb-3">Vykaz ziskov a strat (Uc 2-01)</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Obchodna marza</td>
                      <td className="py-2 text-right font-mono">
                        {formatMoney(preview.obchodna_marza)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Pridana hodnota</td>
                      <td className="py-2 text-right font-mono">
                        {formatMoney(preview.pridana_hodnota)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">VH za obdobie</td>
                      <td className={`py-2 text-right font-mono font-medium ${
                        preview.vh_za_obdobie >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {formatMoney(preview.vh_za_obdobie)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export info */}
            <div className="mt-6 p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Informacie o exporte</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div>
                  <p>Spolocnost: {(activeCompany as any)?.name || "-"}</p>
                  <p>ICO: {(activeCompany as any)?.ico || "-"}</p>
                </div>
                <div>
                  <p>Obdobie: {selectedFy ? `${selectedFy.start_date} - ${selectedFy.end_date}` : "-"}</p>
                  <p>Druh zavierky: Riadna</p>
                </div>
                <div>
                  <p>Format: XML pre RUZ</p>
                  <p>Obsahuje: Suvaha + Vykaz Z/S</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {preview && !hasErrors && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Export uctovnej zavierky</p>
                <p className="text-xs text-muted-foreground">
                  XML subor bude vygenerovany a stiahnuty pre nahratie do RUZ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={validating}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Znova validovat
                </Button>
                <Button onClick={handleExport} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exportujem...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Stiahnut XML
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state when no validation done yet */}
      {validations.length === 0 && !validating && selectedFiscalYear && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Send className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">
                RUZ Export
              </p>
              <p className="text-sm mb-4 text-center max-w-md">
                Pred exportom je potrebne zvalidovat data. Kliknite na
                &quot;Validovat data&quot; pre kontrolu uplnosti a spravnosti udajov.
              </p>
              <Button
                onClick={handleValidate}
                disabled={validating}
                variant="outline"
              >
                <Shield className="mr-2 h-4 w-4" />
                Validovat data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export status history */}
      {exportStatus === "exported" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  XML bolo uspesne exportovane
                </p>
                <p className="text-xs text-muted-foreground">
                  Subor bol stiahnuty. Nahrajte ho do systemu Register uctovnych
                  zavierok na www.registeruz.sk
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
