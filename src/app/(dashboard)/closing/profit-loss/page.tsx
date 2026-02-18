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
  TrendingUp,
  TrendingDown,
} from "lucide-react"

// ---- Types ----

interface ProfitLossLine {
  oznacenie: string
  nazov: string
  riadok: number
  bezne_obdobie: number
  predchadzajuce_obdobie: number
  ucty: string[]
  children?: ProfitLossLine[]
  is_subtotal?: boolean
  is_highlight?: boolean
}

interface ProfitLossData {
  lines: ProfitLossLine[]
  obchodna_marza: { bezne: number; predchadzajuce: number }
  pridana_hodnota: { bezne: number; predchadzajuce: number }
  vh_hospodarska: { bezne: number; predchadzajuce: number }
  vh_financna: { bezne: number; predchadzajuce: number }
  vh_bezna_cinnost: { bezne: number; predchadzajuce: number }
  vh_mimoriadna: { bezne: number; predchadzajuce: number }
  vh_za_obdobie: { bezne: number; predchadzajuce: number }
  vh_po_zdaneni: { bezne: number; predchadzajuce: number }
  fiscal_year: string
  date_from: string
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

// ---- P&L Row Component ----

function PLRow({
  line,
  depth,
}: {
  line: ProfitLossLine
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = line.children && line.children.length > 0
  const paddingLeft = 16 + depth * 20

  const rowClass = line.is_highlight
    ? "bg-blue-50 dark:bg-blue-950/30 font-bold border-b-2"
    : line.is_subtotal
    ? "bg-muted/30 font-medium"
    : ""

  return (
    <>
      <tr
        className={`border-b transition-colors ${rowClass} ${
          hasChildren ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/20"
        }`}
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
        <td className="px-2 py-2 text-xs text-center text-muted-foreground w-10">
          {line.riadok < 10 ? `0${line.riadok}` : line.riadok}
        </td>
        <td
          className={`px-2 py-2 text-right font-mono text-xs border-l w-32 ${
            line.bezne_obdobie < 0 ? "text-destructive" : ""
          }`}
        >
          {formatMoney(line.bezne_obdobie)}
        </td>
        <td
          className={`px-2 py-2 text-right font-mono text-xs border-l w-32 ${
            line.predchadzajuce_obdobie < 0 ? "text-destructive" : ""
          }`}
        >
          {formatMoney(line.predchadzajuce_obdobie)}
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        line.children!.map((child) => (
          <PLRow
            key={`${child.oznacenie}-${child.riadok}`}
            line={child}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

// ---- Summary Card ----

function SummaryCard({
  title,
  bezne,
  predchadzajuce,
}: {
  title: string
  bezne: number
  predchadzajuce: number
}) {
  const isPositive = bezne >= 0
  const change = predchadzajuce !== 0
    ? ((bezne - predchadzajuce) / Math.abs(predchadzajuce) * 100)
    : 0

  return (
    <div className={`p-4 rounded-lg border ${
      isPositive
        ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
        : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
    }`}>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className={`text-xl font-bold ${isPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
        {formatMoney(bezne)}
      </p>
      <div className="flex items-center gap-1 mt-1">
        {change > 0 ? (
          <TrendingUp className="h-3 w-3 text-green-600" />
        ) : change < 0 ? (
          <TrendingDown className="h-3 w-3 text-red-600" />
        ) : null}
        <span className="text-xs text-muted-foreground">
          Predch.: {formatMoney(predchadzajuce)}
          {predchadzajuce !== 0 && ` (${change > 0 ? "+" : ""}${change.toFixed(1)}%)`}
        </span>
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function ProfitLossPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [data, setData] = useState<ProfitLossData | null>(null)
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

  // Fetch P&L data
  const fetchProfitLoss = useCallback(async () => {
    if (!activeCompanyId || !selectedFiscalYear) return
    setLoading(true)
    setData(null)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFiscalYear,
      })

      const res = await fetch(`/api/closing/profit-loss?${params}`)
      const json = await res.json()

      if (res.ok) {
        setData(json)
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: json.error || "Nepodarilo sa nacitat vykaz ziskov a strat",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa nacitat vykaz ziskov a strat",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedFiscalYear, toast])

  useEffect(() => {
    if (selectedFiscalYear) {
      fetchProfitLoss()
    }
  }, [selectedFiscalYear, fetchProfitLoss])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vykaz ziskov a strat</h1>
          <p className="text-muted-foreground">
            Vykaz ziskov a strat (Uc 2-01) - Prehlad vynosov a nakladov
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} disabled={!data}>
          <Printer className="mr-2 h-4 w-4" />
          Tlacit
        </Button>
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
            <Button onClick={fetchProfitLoss} disabled={loading || !selectedFiscalYear}>
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
              <p>Pocitam vykaz ziskov a strat...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* P&L data */}
      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              title="Obchodna marza"
              bezne={data.obchodna_marza.bezne}
              predchadzajuce={data.obchodna_marza.predchadzajuce}
            />
            <SummaryCard
              title="Pridana hodnota"
              bezne={data.pridana_hodnota.bezne}
              predchadzajuce={data.pridana_hodnota.predchadzajuce}
            />
            <SummaryCard
              title="VH z hospodarskej cinnosti"
              bezne={data.vh_hospodarska.bezne}
              predchadzajuce={data.vh_hospodarska.predchadzajuce}
            />
            <SummaryCard
              title="VH za obdobie"
              bezne={data.vh_za_obdobie.bezne}
              predchadzajuce={data.vh_za_obdobie.predchadzajuce}
            />
          </div>

          {/* P&L table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Vykaz ziskov a strat (Uc 2-01)</CardTitle>
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
                    {data.lines.map((line) => (
                      <PLRow
                        key={`pl-${line.oznacenie}-${line.riadok}`}
                        line={line}
                        depth={0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Additional summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Doplnkove ukazovatele</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1 text-muted-foreground">VH z financnej cinnosti</td>
                        <td className="py-1 text-right font-mono">{formatMoney(data.vh_financna.bezne)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 text-muted-foreground">VH pred zdanenim</td>
                        <td className="py-1 text-right font-mono">{formatMoney(data.vh_bezna_cinnost.bezne)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 text-muted-foreground">VH po zdaneni</td>
                        <td className="py-1 text-right font-mono">{formatMoney(data.vh_po_zdaneni.bezne)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-muted-foreground">VH z mimoriadnej cinnosti</td>
                        <td className="py-1 text-right font-mono">{formatMoney(data.vh_mimoriadna.bezne)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Vygenerovane: {new Date(data.generated_at).toLocaleString("sk-SK")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Obdobie: {data.date_from} az {data.date_to}
                  </p>
                </div>
              </div>
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
              <p className="text-lg font-medium mb-1">
                Vykaz ziskov a strat este nebol vypocitany
              </p>
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
