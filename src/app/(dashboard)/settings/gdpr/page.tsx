"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Shield,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle,
  Search,
  User,
  Building2,
  Lock,
  Eye,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface ProcessingRecord {
  id: string
  category: string
  purpose: string
  legal_basis: string
  retention_period: string
  recipients: string
  description: string
}

interface RetentionCheck {
  entity_type: string
  label: string
  records_beyond_retention: number
  oldest_record_date: string | null
  retention_years: number
  status: "ok" | "warning" | "violation"
}

interface PersonalDataExport {
  person_type: string
  person_id: string
  exported_at: string
  data: {
    basic_info: Record<string, any>
    addresses: Record<string, any>[]
    financial_data: Record<string, any>[]
    documents: Record<string, any>[]
    activity_log: Record<string, any>[]
  }
}

interface AnonymizeResult {
  success: boolean
  person_type: string
  person_id: string
  anonymized_fields: string[]
  preserved_records: string[]
  error?: string
}

interface PersonOption {
  id: string
  name: string
}

// ============================================================================
// Component
// ============================================================================

export default function GdprPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Dashboard state
  const [processingRecords, setProcessingRecords] = useState<ProcessingRecord[]>([])
  const [retentionChecks, setRetentionChecks] = useState<RetentionCheck[]>([])
  const [loading, setLoading] = useState(true)

  // Export state
  const [exportPersonType, setExportPersonType] = useState<string>("")
  const [exportPersonId, setExportPersonId] = useState<string>("")
  const [exportPersonSearch, setExportPersonSearch] = useState("")
  const [exportPersonOptions, setExportPersonOptions] = useState<PersonOption[]>([])
  const [exportData, setExportData] = useState<PersonalDataExport | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  // Anonymize state
  const [anonPersonType, setAnonPersonType] = useState<string>("")
  const [anonPersonId, setAnonPersonId] = useState<string>("")
  const [anonPersonSearch, setAnonPersonSearch] = useState("")
  const [anonPersonOptions, setAnonPersonOptions] = useState<PersonOption[]>([])
  const [anonConfirmOpen, setAnonConfirmOpen] = useState(false)
  const [anonConfirmText, setAnonConfirmText] = useState("")
  const [anonResult, setAnonResult] = useState<AnonymizeResult | null>(null)
  const [anonLoading, setAnonLoading] = useState(false)

  // Checklist
  const [checklist, setChecklist] = useState({
    privacy_policy: false,
    dpo_contact: false,
    consent_records: false,
    retention_periods: false,
  })

  // ============================================================================
  // Data fetching
  // ============================================================================

  const fetchGdprData = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/settings/gdpr?company_id=${activeCompanyId}`)
      const json = await res.json()

      if (res.ok) {
        setProcessingRecords(json.data?.processing_records || [])
        setRetentionChecks(json.data?.retention_checks || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat GDPR data" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchGdprData()
  }, [fetchGdprData])

  // Search persons for export/anonymize
  const searchPersons = useCallback(async (
    personType: string,
    search: string,
    setter: (options: PersonOption[]) => void
  ) => {
    if (!activeCompanyId || !personType || search.length < 2) {
      setter([])
      return
    }

    try {
      if (personType === "contact") {
        const res = await fetch(
          `/api/contacts?company_id=${activeCompanyId}&search=${encodeURIComponent(search)}&limit=10`
        )
        const json = await res.json()
        if (res.ok && json.data) {
          setter(json.data.map((c: any) => ({ id: c.id, name: c.name })))
        }
      } else {
        const res = await fetch(
          `/api/employees?company_id=${activeCompanyId}&search=${encodeURIComponent(search)}&limit=10`
        )
        const json = await res.json()
        if (res.ok && json.data) {
          setter(json.data.map((e: any) => ({
            id: e.id,
            name: `${e.first_name} ${e.last_name}`,
          })))
        }
      }
    } catch {
      // Ticho
    }
  }, [activeCompanyId])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPersons(exportPersonType, exportPersonSearch, setExportPersonOptions)
    }, 300)
    return () => clearTimeout(timer)
  }, [exportPersonType, exportPersonSearch, searchPersons])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPersons(anonPersonType, anonPersonSearch, setAnonPersonOptions)
    }, 300)
    return () => clearTimeout(timer)
  }, [anonPersonType, anonPersonSearch, searchPersons])

  // ============================================================================
  // Actions
  // ============================================================================

  const handleExportData = async () => {
    if (!activeCompanyId || !exportPersonType || !exportPersonId) return
    setExportLoading(true)
    setExportData(null)

    try {
      const res = await fetch("/api/settings/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          action: "export",
          person_type: exportPersonType,
          person_id: exportPersonId,
        }),
      })

      const json = await res.json()
      if (res.ok) {
        setExportData(json.data)
        toast({ title: "Udaje exportovane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa exportovat udaje" })
    } finally {
      setExportLoading(false)
    }
  }

  const handleDownloadExport = () => {
    if (!exportData) return
    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gdpr-export-${exportData.person_type}-${exportData.person_id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAnonymize = async () => {
    if (!activeCompanyId || !anonPersonType || !anonPersonId) return
    setAnonLoading(true)
    setAnonResult(null)

    try {
      const res = await fetch("/api/settings/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          action: "anonymize",
          person_type: anonPersonType,
          person_id: anonPersonId,
        }),
      })

      const json = await res.json()
      if (res.ok) {
        setAnonResult(json.data)
        setAnonConfirmOpen(false)
        setAnonConfirmText("")
        toast({ title: "Udaje anonymizovane" })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
        setAnonConfirmOpen(false)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa anonymizovat udaje" })
    } finally {
      setAnonLoading(false)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GDPR</h1>
          <p className="text-muted-foreground">Ochrana osobnych udajov a zhoda s GDPR</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Prehlad</TabsTrigger>
          <TabsTrigger value="export">Export udajov</TabsTrigger>
          <TabsTrigger value="anonymize">Anonymizacia</TabsTrigger>
          <TabsTrigger value="processing">Evidencia spracovania</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Tab: Prehlad */}
        {/* ================================================================ */}
        <TabsContent value="overview">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Nacitavam...</div>
          ) : (
            <div className="space-y-6">
              {/* Status karty */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Evidencia spracovania
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{processingRecords.length}</p>
                    <p className="text-xs text-muted-foreground">kategorii osobnych udajov</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Retencne lehoty
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {retentionChecks.filter((r) => r.status === "ok").length} / {retentionChecks.length}
                    </p>
                    <p className="text-xs text-muted-foreground">v sulade</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Anonymizovane zaznamy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">-</p>
                    <p className="text-xs text-muted-foreground">poziadavky spracovane</p>
                  </CardContent>
                </Card>
              </div>

              {/* Retencne lehoty status */}
              {retentionChecks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Stav retencnych lehot</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-10 px-4 text-left font-medium">Typ</th>
                          <th className="h-10 px-4 text-left font-medium">Retencia</th>
                          <th className="h-10 px-4 text-left font-medium">Zaznamy za lehotu</th>
                          <th className="h-10 px-4 text-left font-medium">Najstarsi</th>
                          <th className="h-10 px-4 text-left font-medium">Stav</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retentionChecks.map((check) => (
                          <tr key={check.entity_type} className="border-b">
                            <td className="px-4 py-3">{check.label}</td>
                            <td className="px-4 py-3">{check.retention_years} rokov</td>
                            <td className="px-4 py-3">{check.records_beyond_retention}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {check.oldest_record_date
                                ? new Date(check.oldest_record_date).toLocaleDateString("sk-SK")
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {check.status === "ok" && (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  V poriadku
                                </span>
                              )}
                              {check.status === "warning" && (
                                <span className="inline-flex items-center gap-1 text-yellow-600">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Varovanie
                                </span>
                              )}
                              {check.status === "violation" && (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Porusenie
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* GDPR checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">GDPR checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="privacy-policy"
                      checked={checklist.privacy_policy}
                      onCheckedChange={(v) => setChecklist((p) => ({ ...p, privacy_policy: !!v }))}
                    />
                    <Label htmlFor="privacy-policy" className="text-sm cursor-pointer">
                      Zasady ochrany osobnych udajov (Privacy policy)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="dpo-contact"
                      checked={checklist.dpo_contact}
                      onCheckedChange={(v) => setChecklist((p) => ({ ...p, dpo_contact: !!v }))}
                    />
                    <Label htmlFor="dpo-contact" className="text-sm cursor-pointer">
                      DPO kontakt (zodpovedna osoba)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="consent-records"
                      checked={checklist.consent_records}
                      onCheckedChange={(v) => setChecklist((p) => ({ ...p, consent_records: !!v }))}
                    />
                    <Label htmlFor="consent-records" className="text-sm cursor-pointer">
                      Evidencia suhlasov dotknutych osob
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="retention-periods"
                      checked={checklist.retention_periods}
                      onCheckedChange={(v) => setChecklist((p) => ({ ...p, retention_periods: !!v }))}
                    />
                    <Label htmlFor="retention-periods" className="text-sm cursor-pointer">
                      Lehoty uchovávania su nastavene a kontrolovane
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Tab: Export udajov */}
        {/* ================================================================ */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Pravo na pristup - Export osobnych udajov
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Podla clanku 15 GDPR ma dotkнuta osoba pravo na pristup k jej osobnym udajom.
                Exportujte kompletne osobne udaje vybranej osoby.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Typ osoby</Label>
                  <Select value={exportPersonType} onValueChange={(v) => { setExportPersonType(v); setExportPersonId(""); setExportPersonSearch(""); setExportPersonOptions([]); setExportData(null) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" /> Kontakt
                        </span>
                      </SelectItem>
                      <SelectItem value="employee">
                        <span className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" /> Zamestnanec
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block">Hladanie osoby</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Hladajte podla mena..."
                      className="pl-9"
                      value={exportPersonSearch}
                      onChange={(e) => setExportPersonSearch(e.target.value)}
                      disabled={!exportPersonType}
                    />
                  </div>
                  {exportPersonOptions.length > 0 && (
                    <div className="mt-1 border rounded-md bg-popover shadow-sm max-h-40 overflow-auto">
                      {exportPersonOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setExportPersonId(opt.id)
                            setExportPersonSearch(opt.name)
                            setExportPersonOptions([])
                          }}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleExportData}
                disabled={exportLoading || !exportPersonId}
              >
                <Download className="mr-2 h-4 w-4" />
                {exportLoading ? "Exportujem..." : "Exportovat osobne udaje"}
              </Button>

              {/* Export preview */}
              {exportData && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Nahlad exportovanych udajov</h3>
                    <Button variant="outline" size="sm" onClick={handleDownloadExport}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Stiahnut JSON
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                    {JSON.stringify(exportData.data, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Tab: Anonymizacia */}
        {/* ================================================================ */}
        <TabsContent value="anonymize">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Pravo na vymazanie - Anonymizacia osobnych udajov
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Dolezite upozornenie</p>
                    <ul className="mt-2 space-y-1 text-yellow-700 dark:text-yellow-300">
                      <li>Osobne udaje budu nahradene textom &quot;ANONYMIZOVANE&quot;</li>
                      <li>Uctovne zaznamy budu zachovane podla zakona o uctovnictve</li>
                      <li>ICO, DIC a IC DPH sa zachovaju pre danove ucely</li>
                      <li>Anonymizacia je nevratna operacia</li>
                      <li>System skontroluje retencne lehoty pred anonymizaciou</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Typ osoby</Label>
                  <Select value={anonPersonType} onValueChange={(v) => { setAnonPersonType(v); setAnonPersonId(""); setAnonPersonSearch(""); setAnonPersonOptions([]); setAnonResult(null) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" /> Kontakt
                        </span>
                      </SelectItem>
                      <SelectItem value="employee">
                        <span className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" /> Zamestnanec
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block">Hladanie osoby</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Hladajte podla mena..."
                      className="pl-9"
                      value={anonPersonSearch}
                      onChange={(e) => setAnonPersonSearch(e.target.value)}
                      disabled={!anonPersonType}
                    />
                  </div>
                  {anonPersonOptions.length > 0 && (
                    <div className="mt-1 border rounded-md bg-popover shadow-sm max-h-40 overflow-auto">
                      {anonPersonOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setAnonPersonId(opt.id)
                            setAnonPersonSearch(opt.name)
                            setAnonPersonOptions([])
                          }}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="destructive"
                onClick={() => setAnonConfirmOpen(true)}
                disabled={!anonPersonId}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Anonymizovat udaje
              </Button>

              {/* Confirmation dialog */}
              <Dialog open={anonConfirmOpen} onOpenChange={setAnonConfirmOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Potvrdenie anonymizacie</DialogTitle>
                    <DialogDescription>
                      Tato akcia je nevratna. Osobne udaje budu trvalo nahradene.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <p className="text-sm">
                      Pre potvrdenie zadajte <strong>ANONYMIZOVAT</strong> do pola nizsie:
                    </p>
                    <Input
                      value={anonConfirmText}
                      onChange={(e) => setAnonConfirmText(e.target.value)}
                      placeholder="ANONYMIZOVAT"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setAnonConfirmOpen(false); setAnonConfirmText("") }}>
                      Zrusit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleAnonymize}
                      disabled={anonConfirmText !== "ANONYMIZOVAT" || anonLoading}
                    >
                      {anonLoading ? "Anonymizujem..." : "Potvrdit anonymizaciu"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Anonymize result */}
              {anonResult && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  {anonResult.success ? (
                    <Card className="border-green-300 dark:border-green-800">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-200">Anonymizacia uspesna</p>
                            <div className="mt-2 text-sm space-y-1">
                              <p className="text-muted-foreground">Anonymizovane polia:</p>
                              <ul className="list-disc pl-5 text-muted-foreground">
                                {anonResult.anonymized_fields.map((f) => (
                                  <li key={f}>{f}</li>
                                ))}
                              </ul>
                              <p className="text-muted-foreground mt-2">Zachovane zaznamy:</p>
                              <ul className="list-disc pl-5 text-muted-foreground">
                                {anonResult.preserved_records.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-red-300 dark:border-red-800">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-200">Anonymizacia zlyhala</p>
                            <p className="text-sm text-muted-foreground mt-1">{anonResult.error}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Tab: Evidencia spracovania */}
        {/* ================================================================ */}
        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Evidencia spracovatelskych cinnosti (Clanok 30 GDPR)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Kategoria udajov</th>
                      <th className="h-10 px-4 text-left font-medium">Ucel spracovania</th>
                      <th className="h-10 px-4 text-left font-medium">Pravny zaklad</th>
                      <th className="h-10 px-4 text-left font-medium">Lehota uchovávania</th>
                      <th className="h-10 px-4 text-left font-medium">Prijemcovia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center text-muted-foreground">
                          Nacitavam...
                        </td>
                      </tr>
                    ) : processingRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center text-muted-foreground">
                          Ziadne zaznamy
                        </td>
                      </tr>
                    ) : (
                      processingRecords.map((record) => (
                        <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{record.category}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[250px]">
                            {record.purpose}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[250px] text-xs">
                            {record.legal_basis}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {record.retention_period}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                            {record.recipients}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
