"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Loader2,
  Printer,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

// ---- Types ----

interface BalanceSheetLine {
  oznacenie: string
  nazov: string
  riadok: number
  brutto: number
  korekcia: number
  netto: number
  predchadzajuce_obdobie: number
  ucty: string[]
  children?: BalanceSheetLine[]
  is_subtotal?: boolean
}

interface BalanceSheetData {
  aktiva: BalanceSheetLine[]
  pasiva: BalanceSheetLine[]
  aktiva_spolu: {
    brutto: number
    korekcia: number
    netto: number
    predchadzajuce_obdobie: number
  }
  pasiva_spolu: {
    netto: number
    predchadzajuce_obdobie: number
  }
  fiscal_year: string
  date_to: string
  generated_at: string
}

interface FiscalYear {
  id: string
  year: number
  start_date: string
  end_date: string
}

// ---- Helpers ----

function formatMoney(amount: number): string {
  if (amount === 0) return "-"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount)
}

// ---- Line Row Component ----

function BalanceSheetRow({
  line,
  depth,
  isAktiva,
}: {
  line: BalanceSheetLine
  depth: number
  isAktiva: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = line.children && line.children.length > 0
  const paddingLeft = 16 + depth * 20

  return (
    <>
      <tr
        className={`border-b transition-colors ${
          line.is_subtotal
            ? "bg-muted/30 font-medium hover:bg-muted/50"
            : "hover:bg-muted/20"
        } ${hasChildren ? "cursor-pointer" : ""}`}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
      >
        <td className="px-2 py-2 text-xs font-mono w-16" style={{ paddingLeft }}>
          {hasChildren && (
            <span className="inline-flex items-center mr-1">
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {line.oznacenie}
        </td>
        <td className="px-2 py-2 text-sm">{line.nazov}</td>
        <td className="px-2 py-2 text-xs text-center text-muted-foreground w-10">{line.riadok}</td>
        {isAktiva && (
          <>
            <td className="px-2 py-2 text-right font-mono text-xs border-l w-28">
              {formatMoney(line.brutto)}
            </td>
            <td className="px-2 py-2 text-right font-mono text-xs w-28">
              {formatMoney(line.korekcia)}
            </td>
          </>
        )}
        <td className="px-2 py-2 text-right font-mono text-xs border-l w-28">
          {formatMoney(line.netto)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-xs border-l w-28">
          {formatMoney(line.predchadzajuce_obdobie)}
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        line.children!.map((child) => (
          <BalanceSheetRow
            key={`${child.oznacenie}-${child.riadok}`}
            line={child}
            depth={depth + 1}
            isAktiva={isAktiva}
          />
        ))}
    </>
  )
}

// ---- Main Page ----

export default function BalanceSheetPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("")
  const [loadingFy, setLoadingFy] = useState(true)

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

  // Fetch balance sheet data
  const fetchBalanceSheet = useCallback(async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setLoading(true)
    setData(null)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFiscalYear,
      })

      const res = await fetch(`/api/closing/balance-sheet?${params}`)
      const json = await res.json()

      if (res.ok) {
        setData(json)
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa nacitat suvahu",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat suvahu",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedFiscalYear, toast])

  useEffect(() => {
    if (selectedFiscalYear) {
      fetchBalanceSheet()
    }
  }, [selectedFiscalYear, fetchBalanceSheet])

  const handlePrint = () => {
    window.print()
  }

  const isBalanced = data
    ? Math.abs(data.aktiva_spolu.netto - data.pasiva_spolu.netto) < 0.01
    : true

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suvaha</h1>
          <p className="text-muted-foreground">
            Suvaha (Uc 1-01) - Prehlad majetku a zdrojov jeho krytia
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <>
              {isBalanced ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Vyvazena
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Nevyvazena
                </span>
              )}
            </>
          )}
          <Button variant="outline" onClick={handlePrint} disabled={!data}>
            <Printer className="mr-2 h-4 w-4" />
            Tlacit
          </Button>
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
                  Ziadne uctovne obdobia. Najprv vytvorte uctovne obdobie.
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
            <Button onClick={fetchBalanceSheet} disabled={loading || !selectedFiscalYear}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pocitam...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Vypocitat
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Pocitam suvahu...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance sheet data */}
      {!loading && data && (
        <>
          {/* AKTIVA */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>AKTIVA (Majetok)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-2 text-left font-medium" rowSpan={2}>
                        Ozn.
                      </th>
                      <th className="h-10 px-2 text-left font-medium" rowSpan={2}>
                        Polozka
                      </th>
                      <th className="h-10 px-2 text-center font-medium text-muted-foreground" rowSpan={2}>
                        r.
                      </th>
                      <th
                        className="h-10 px-2 text-center font-medium border-l"
                        colSpan={3}
                      >
                        Bezne uctovne obdobie
                      </th>
                      <th className="h-10 px-2 text-center font-medium border-l" rowSpan={2}>
                        Predch. obdobie
                      </th>
                    </tr>
                    <tr className="border-b bg-muted/50">
                      <th className="h-8 px-2 text-right font-medium text-xs border-l">
                        Brutto
                      </th>
                      <th className="h-8 px-2 text-right font-medium text-xs">
                        Korekcia
                      </th>
                      <th className="h-8 px-2 text-right font-medium text-xs border-l">
                        Netto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aktiva.map((line) => (
                      <BalanceSheetRow
                        key={`a-${line.oznacenie}-${line.riadok}`}
                        line={line}
                        depth={0}
                        isAktiva={true}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-bold">
                      <td className="px-2 py-3" colSpan={2}>
                        AKTIVA SPOLU
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-muted-foreground">
                        1
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs border-l">
                        {formatMoney(data.aktiva_spolu.brutto)}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs">
                        {formatMoney(data.aktiva_spolu.korekcia)}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs border-l">
                        {formatMoney(data.aktiva_spolu.netto)}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs border-l">
                        {formatMoney(data.aktiva_spolu.predchadzajuce_obdobie)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* PASIVA */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>PASIVA (Zdroje krytia)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-2 text-left font-medium">Ozn.</th>
                      <th className="h-10 px-2 text-left font-medium">Polozka</th>
                      <th className="h-10 px-2 text-center font-medium text-muted-foreground">
                        r.
                      </th>
                      <th className="h-10 px-2 text-right font-medium border-l">
                        Bezne obdobie
                      </th>
                      <th className="h-10 px-2 text-right font-medium border-l">
                        Predch. obdobie
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pasiva.map((line) => (
                      <BalanceSheetRow
                        key={`p-${line.oznacenie}-${line.riadok}`}
                        line={line}
                        depth={0}
                        isAktiva={false}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-bold">
                      <td className="px-2 py-3" colSpan={2}>
                        PASIVA SPOLU
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-muted-foreground">
                        65
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs border-l">
                        {formatMoney(data.pasiva_spolu.netto)}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs border-l">
                        {formatMoney(data.pasiva_spolu.predchadzajuce_obdobie)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Balance check */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Kontrola suvahy</p>
                  <p className="text-xs text-muted-foreground">
                    Aktiva netto: {formatMoney(data.aktiva_spolu.netto)} | Pasiva:{" "}
                    {formatMoney(data.pasiva_spolu.netto)} | Rozdiel:{" "}
                    {formatMoney(
                      Math.abs(data.aktiva_spolu.netto - data.pasiva_spolu.netto)
                    )}
                  </p>
                </div>
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    Suvaha je vyvazena
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Suvaha nie je vyvazena!
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Vygenerovane: {new Date(data.generated_at).toLocaleString("sk-SK")} |
                Obdobie do: {data.date_to}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!loading && !data && selectedFiscalYear && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">Suvaha este nebola vypocitana</p>
              <p className="text-sm">
                Zvolte uctovne obdobie a kliknite na &quot;Vypocitat&quot;.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
