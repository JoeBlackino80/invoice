"use client"

import { useState, useCallback, useEffect } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  BarChart3,
  Loader2,
  FileBarChart,
} from "lucide-react"
import {
  generateCSV,
  type QuarterlyStatReport,
  type AnnualStatReport,
} from "@/lib/reports/export-generator"

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i)
const QUARTERS = [
  { value: "1", label: "Q1 (januar - marec)" },
  { value: "2", label: "Q2 (april - jun)" },
  { value: "3", label: "Q3 (jul - september)" },
  { value: "4", label: "Q4 (oktober - december)" },
]

// -----------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------

function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value)
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export default function StatisticsReportsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Quarterly state
  const [qYear, setQYear] = useState(String(currentYear))
  const [qQuarter, setQQuarter] = useState("1")
  const [qLoading, setQLoading] = useState(false)
  const [qReport, setQReport] = useState<QuarterlyStatReport | null>(null)

  // Annual state
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFY, setSelectedFY] = useState("")
  const [aLoading, setALoading] = useState(false)
  const [aReport, setAReport] = useState<AnnualStatReport | null>(null)

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
  // Quarterly report
  // -----------------------------------------------------------------------

  const handleGenerateQuarterly = async () => {
    if (!activeCompanyId) return
    setQLoading(true)
    setQReport(null)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        year: qYear,
        quarter: qQuarter,
      })
      const res = await fetch(`/api/reports/statistics/quarterly?${params}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "Chyba")
      }
      const data: QuarterlyStatReport = await res.json()
      setQReport(data)
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setQLoading(false)
    }
  }

  const exportQuarterlyCSV = () => {
    if (!qReport) return
    const headers = ["Ukazovatel", "Hodnota (EUR)"]
    const rows: any[][] = [
      ["Trzby za vlastne vykony a tovary", qReport.trzby_spolu.toFixed(2)],
      ["  z toho: vlastne vykony", qReport.trzby_vlastne_vykony.toFixed(2)],
      ["  z toho: tovar", qReport.trzby_tovar.toFixed(2)],
      [
        "Naklady na hospodarsku cinnost",
        qReport.naklady_hospodarsku_cinnost.toFixed(2),
      ],
      ["Vysledok hospodarenia", qReport.vysledok_hospodarenia.toFixed(2)],
      [
        "Priemerny pocet zamestnancov",
        String(qReport.priemerny_pocet_zamestnancov),
      ],
      ["Mzdove naklady", qReport.mzdove_naklady.toFixed(2)],
      ["Investicie", qReport.investicie.toFixed(2)],
      ["Odpisy", qReport.odpisy.toFixed(2)],
    ]
    const csv = generateCSV(headers, rows)
    downloadBlob(csv, `stvrtrocny_vykaz_${qYear}_Q${qQuarter}.csv`)
  }

  // -----------------------------------------------------------------------
  // Annual report
  // -----------------------------------------------------------------------

  const handleGenerateAnnual = async () => {
    if (!activeCompanyId || !selectedFY) return
    setALoading(true)
    setAReport(null)

    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        fiscal_year_id: selectedFY,
      })
      const res = await fetch(`/api/reports/statistics/annual?${params}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "Chyba")
      }
      const data: AnnualStatReport = await res.json()
      setAReport(data)
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setALoading(false)
    }
  }

  const exportAnnualCSV = () => {
    if (!aReport) return
    const headers = ["Sekcia", "Ukazovatel", "Hodnota (EUR)"]
    const bs = aReport.balanceSheet
    const pl = aReport.profitLoss
    const st = aReport.statistics
    const rows: any[][] = [
      ["Suvaha", "AKTIVA SPOLU", bs.aktiva_spolu.toFixed(2)],
      ["Suvaha", "Neobezny majetok", bs.neobezny_majetok.toFixed(2)],
      ["Suvaha", "Obezny majetok", bs.obezny_majetok.toFixed(2)],
      [
        "Suvaha",
        "Casove rozlisenie aktiv",
        bs.casove_rozlisenie_aktiv.toFixed(2),
      ],
      ["Suvaha", "PASIVA SPOLU", bs.pasiva_spolu.toFixed(2)],
      ["Suvaha", "Vlastne imanie", bs.vlastne_imanie.toFixed(2)],
      ["Suvaha", "Zavazky", bs.zavazky.toFixed(2)],
      [
        "Suvaha",
        "Casove rozlisenie pasiv",
        bs.casove_rozlisenie_pasiv.toFixed(2),
      ],
      ["VZaS", "Trzby predaj tovaru", pl.trzby_predaj_tovaru.toFixed(2)],
      [
        "VZaS",
        "Naklady obstaranie tovaru",
        pl.naklady_obstaranie_tovaru.toFixed(2),
      ],
      ["VZaS", "Obchodna marza", pl.obchodna_marza.toFixed(2)],
      ["VZaS", "Vyroby", pl.vyroby.toFixed(2)],
      ["VZaS", "Vyrobna spotreba", pl.vyrobna_spotreba.toFixed(2)],
      ["VZaS", "Pridana hodnota", pl.pridana_hodnota.toFixed(2)],
      ["VZaS", "Osobne naklady", pl.osobne_naklady.toFixed(2)],
      ["VZaS", "Odpisy", pl.odpisy.toFixed(2)],
      ["VZaS", "Prevadzkovy vysledok", pl.prevadzkovy_vysledok.toFixed(2)],
      ["VZaS", "Financny vysledok", pl.financny_vysledok.toFixed(2)],
      [
        "VZaS",
        "Vysledok pred zdanenim",
        pl.vysledok_pred_zdanenim.toFixed(2),
      ],
      ["VZaS", "Dan z prijmov", pl.dan_z_prijmov.toFixed(2)],
      ["VZaS", "Vysledok po zdaneni", pl.vysledok_po_zdaneni.toFixed(2)],
      [
        "Statistika",
        "Priemerny pocet zamestnancov",
        String(st.priemerny_pocet_zamestnancov),
      ],
      ["Statistika", "Osobne naklady", st.osobne_naklady.toFixed(2)],
      ["Statistika", "Odpisy", st.odpisy.toFixed(2)],
    ]
    for (const t of st.trzby_podla_odvetvia) {
      rows.push(["Statistika", `Trzby: ${t.odvetvie}`, t.suma.toFixed(2)])
    }
    const csv = generateCSV(headers, rows)
    downloadBlob(csv, `rocny_vykaz_${aReport.fiscalYear.replace(/\s/g, "_")}.csv`)
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function downloadBlob(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!activeCompanyId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Najprv vyberte firmu pre generovanie statistickych vykazov.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statisticke vykazy</h1>
        <p className="text-muted-foreground">
          Vykazy pre Statisticky urad SR
        </p>
      </div>

      <Tabs defaultValue="quarterly">
        <TabsList>
          <TabsTrigger value="quarterly">
            <BarChart3 className="h-4 w-4 mr-2" />
            Stvrtrocny vykaz
          </TabsTrigger>
          <TabsTrigger value="annual">
            <FileBarChart className="h-4 w-4 mr-2" />
            Rocny vykaz (Uc POD)
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* Quarterly */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="quarterly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stvrtrocny vykaz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Rok</Label>
                  <Select value={qYear} onValueChange={setQYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stvrtrok</Label>
                  <Select value={qQuarter} onValueChange={setQQuarter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map((q) => (
                        <SelectItem key={q.value} value={q.value}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateQuarterly}
                    disabled={qLoading}
                  >
                    {qLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4 mr-2" />
                    )}
                    Generovat
                  </Button>
                </div>
              </div>

              {qReport && (
                <div className="space-y-4 mt-4">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {qReport.company} (ICO: {qReport.ico})
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Rok {qReport.year}, Q{qReport.quarter}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportQuarterlyCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ukazovatel</TableHead>
                            <TableHead className="text-right">
                              Hodnota
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="font-semibold">
                            <TableCell>
                              Trzby za vlastne vykony a tovar
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.trzby_spolu)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="pl-8">
                              z toho: vlastne vykony
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.trzby_vlastne_vykony)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="pl-8">
                              z toho: tovar
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.trzby_tovar)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              Naklady na hospodarsku cinnost
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                qReport.naklady_hospodarsku_cinnost
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Vysledok hospodarenia</TableCell>
                            <TableCell
                              className={`text-right ${qReport.vysledok_hospodarenia >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatEur(qReport.vysledok_hospodarenia)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              Priemerny prepocitany pocet zamestnancov
                            </TableCell>
                            <TableCell className="text-right">
                              {qReport.priemerny_pocet_zamestnancov}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Mzdove naklady</TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.mzdove_naklady)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Investicie</TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.investicie)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Odpisy</TableCell>
                            <TableCell className="text-right">
                              {formatEur(qReport.odpisy)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Annual */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="annual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rocny vykaz (Uc POD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Uctovne obdobie</Label>
                  <Select value={selectedFY} onValueChange={setSelectedFY}>
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
                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateAnnual}
                    disabled={aLoading || !selectedFY}
                  >
                    {aLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileBarChart className="h-4 w-4 mr-2" />
                    )}
                    Generovat
                  </Button>
                </div>
              </div>

              {aReport && (
                <div className="space-y-6 mt-4">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {aReport.company} (ICO: {aReport.ico})
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Obdobie: {aReport.fiscalYear}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportAnnualCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>

                  {/* Balance Sheet Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Suvaha (suhrn)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-2">AKTIVA</h4>
                          <Table>
                            <TableBody>
                              <TableRow className="font-semibold bg-muted/50">
                                <TableCell>AKTIVA SPOLU</TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.aktiva_spolu
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Neobezny majetok
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.neobezny_majetok
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Obezny majetok
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.obezny_majetok
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Casove rozlisenie
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet
                                      .casove_rozlisenie_aktiv
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">PASIVA</h4>
                          <Table>
                            <TableBody>
                              <TableRow className="font-semibold bg-muted/50">
                                <TableCell>PASIVA SPOLU</TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.pasiva_spolu
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Vlastne imanie
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.vlastne_imanie
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Zavazky
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet.zavazky
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="pl-6">
                                  Casove rozlisenie
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatEur(
                                    aReport.balanceSheet
                                      .casove_rozlisenie_pasiv
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* P&L Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Vykaz ziskov a strat (suhrn)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Polozka</TableHead>
                            <TableHead className="text-right">
                              Suma (EUR)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Trzby z predaja tovaru</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.trzby_predaj_tovaru
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              Naklady na obstaranie tovaru
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss
                                  .naklady_obstaranie_tovaru
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-medium">
                            <TableCell>Obchodna marza</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.obchodna_marza
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Vyroby</TableCell>
                            <TableCell className="text-right">
                              {formatEur(aReport.profitLoss.vyroby)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Vyrobna spotreba</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.vyrobna_spotreba
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/30">
                            <TableCell>Pridana hodnota</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.pridana_hodnota
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Osobne naklady</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.osobne_naklady
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Odpisy</TableCell>
                            <TableCell className="text-right">
                              {formatEur(aReport.profitLoss.odpisy)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Prevadzkovy vysledok</TableCell>
                            <TableCell
                              className={`text-right ${aReport.profitLoss.prevadzkovy_vysledok >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatEur(
                                aReport.profitLoss.prevadzkovy_vysledok
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Financny vysledok</TableCell>
                            <TableCell
                              className={`text-right ${aReport.profitLoss.financny_vysledok >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatEur(
                                aReport.profitLoss.financny_vysledok
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-semibold">
                            <TableCell>Vysledok pred zdanenim</TableCell>
                            <TableCell
                              className={`text-right ${aReport.profitLoss.vysledok_pred_zdanenim >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatEur(
                                aReport.profitLoss.vysledok_pred_zdanenim
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Dan z prijmov</TableCell>
                            <TableCell className="text-right">
                              {formatEur(
                                aReport.profitLoss.dan_z_prijmov
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-bold bg-muted">
                            <TableCell>
                              Vysledok hospodarenia po zdaneni
                            </TableCell>
                            <TableCell
                              className={`text-right ${aReport.profitLoss.vysledok_po_zdaneni >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatEur(
                                aReport.profitLoss.vysledok_po_zdaneni
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Additional Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Doplnujuce statisticke udaje
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Priemerny pocet zamestnancov
                          </p>
                          <p className="text-2xl font-bold">
                            {aReport.statistics
                              .priemerny_pocet_zamestnancov}
                          </p>
                        </Card>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Osobne naklady
                          </p>
                          <p className="text-2xl font-bold">
                            {formatEur(
                              aReport.statistics.osobne_naklady
                            )}
                          </p>
                        </Card>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Odpisy
                          </p>
                          <p className="text-2xl font-bold">
                            {formatEur(aReport.statistics.odpisy)}
                          </p>
                        </Card>
                      </div>

                      {aReport.statistics.trzby_podla_odvetvia.length >
                        0 && (
                        <div>
                          <h4 className="font-semibold mb-2">
                            Trzby podla odvetvia
                          </h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Odvetvie</TableHead>
                                <TableHead className="text-right">
                                  Suma (EUR)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {aReport.statistics.trzby_podla_odvetvia.map(
                                (t, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{t.odvetvie}</TableCell>
                                    <TableCell className="text-right">
                                      {formatEur(t.suma)}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
