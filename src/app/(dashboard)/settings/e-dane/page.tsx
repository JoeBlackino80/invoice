"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// ===================== Types =====================

interface Submission {
  id: string
  company_id: string
  type: string
  period: string
  status: string
  submitted_at: string | null
  response_message: string | null
  reference_number: string | null
  created_at: string
  xml_content?: string
}

interface ValidationError {
  line?: number
  message: string
  element?: string
}

interface ValidationWarning {
  line?: number
  message: string
  element?: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface EKasaImport {
  id: string
  date: string
  total_receipts: number
  total_amount: number
  total_vat: number
  receipts_data: EKasaReceipt[]
  created_at: string
}

interface EKasaReceipt {
  id: string
  receipt_number: string
  amount: number
  vat_amount: number
  date: string
  okp: string
  uid: string
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    total_price: number
    vat_rate: number
    vat_amount: number
  }>
}

// ===================== Constants =====================

const SUBMISSION_TYPES: Array<{ value: string; label: string }> = [
  { value: "dph_priznanie", label: "Priznanie k DPH" },
  { value: "kontrolny_vykaz", label: "Kontrolny vykaz DPH" },
  { value: "suhrnny_vykaz", label: "Suhrnny vykaz" },
  { value: "dppo", label: "Dan z prijmov pravnickych osob" },
  { value: "dpfo", label: "Dan z prijmov fyzickych osob" },
  { value: "mesacny_prehlad", label: "Mesacny prehlad o zrazkach dane" },
  { value: "rocne_hlasenie", label: "Rocne hlasenie o zrazkach dane" },
]

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Koncept", variant: "secondary" },
  validated: { label: "Validovane", variant: "outline" },
  submitted: { label: "Odoslane", variant: "default" },
  accepted: { label: "Prijate", variant: "default" },
  rejected: { label: "Zamietnute", variant: "destructive" },
}

const MONTHLY_TYPES = [
  "dph_priznanie",
  "kontrolny_vykaz",
  "suhrnny_vykaz",
  "mesacny_prehlad",
]

const SCHEMA_TYPE_MAP: Record<string, string> = {
  dph_priznanie: "dph",
  kontrolny_vykaz: "kvdph",
  suhrnny_vykaz: "sv",
  dppo: "dppo",
  dpfo: "dpfo",
  mesacny_prehlad: "mvp_sp",
  rocne_hlasenie: "mvp_sp",
}

const MONTHS = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "Marec" },
  { value: "04", label: "April" },
  { value: "05", label: "Maj" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

function getTypeLabel(type: string): string {
  const found = SUBMISSION_TYPES.find((t) => t.value === type)
  return found ? found.label : type
}

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status]
  if (!config) {
    return <Badge variant="secondary">{status}</Badge>
  }

  let className = ""
  switch (status) {
    case "draft":
      className = "bg-gray-100 text-gray-800 hover:bg-gray-100"
      break
    case "validated":
      className = "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      break
    case "submitted":
      className = "bg-blue-100 text-blue-800 hover:bg-blue-100"
      break
    case "accepted":
      className = "bg-green-100 text-green-800 hover:bg-green-100"
      break
    case "rejected":
      className = "bg-red-100 text-red-800 hover:bg-red-100"
      break
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

// ===================== Component =====================

export default function EDanePage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState("podania")

  // Submissions list state
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [filterType, setFilterType] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>(
    String(new Date().getFullYear())
  )
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // New submission state
  const [newType, setNewType] = useState<string>("")
  const [newYear, setNewYear] = useState<string>(
    String(new Date().getFullYear())
  )
  const [newMonth, setNewMonth] = useState<string>("01")
  const [xmlContent, setXmlContent] = useState<string>("")
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Detail view state
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // eKasa state
  const [ekasaImports, setEkasaImports] = useState<EKasaImport[]>([])
  const [loadingEkasa, setLoadingEkasa] = useState(false)
  const [ekasaDate, setEkasaDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [selectedImport, setSelectedImport] = useState<EKasaImport | null>(null)
  const [isImportingEkasa, setIsImportingEkasa] = useState(false)

  // ===================== Data Fetching =====================

  const fetchSubmissions = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingSubmissions(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
      })
      if (filterType && filterType !== "all") {
        params.set("type", filterType)
      }
      if (filterYear) {
        params.set("year", filterYear)
      }
      if (filterStatus && filterStatus !== "all") {
        params.set("status", filterStatus)
      }

      const res = await fetch(`/api/settings/e-dane?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setSubmissions(json.data || [])
      } else {
        toast({
          title: "Chyba pri nacitani podani",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba pri nacitani podani",
        variant: "destructive",
      })
    } finally {
      setLoadingSubmissions(false)
    }
  }, [activeCompanyId, filterType, filterYear, filterStatus, toast])

  const fetchSubmissionDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/settings/e-dane/${id}`)
        if (res.ok) {
          const data = await res.json()
          setSelectedSubmission(data)
        } else {
          toast({
            title: "Chyba pri nacitani detailu",
            variant: "destructive",
          })
        }
      } catch {
        toast({
          title: "Chyba pri nacitani detailu",
          variant: "destructive",
        })
      } finally {
        setLoadingDetail(false)
      }
    },
    [toast]
  )

  const fetchEkasaImports = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingEkasa(true)
    try {
      const res = await fetch(
        `/api/settings/ekasa?company_id=${activeCompanyId}`
      )
      if (res.ok) {
        const json = await res.json()
        setEkasaImports(json.data || [])
      }
    } catch {
      toast({
        title: "Chyba pri nacitani eKasa dat",
        variant: "destructive",
      })
    } finally {
      setLoadingEkasa(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    if (activeTab === "podania" || activeTab === "archiv") {
      fetchSubmissions()
    } else if (activeTab === "ekasa") {
      fetchEkasaImports()
    }
  }, [activeTab, fetchSubmissions, fetchEkasaImports])

  // ===================== Actions =====================

  const handleValidate = async () => {
    if (!xmlContent.trim()) {
      toast({
        title: "XML obsah je prazdny",
        variant: "destructive",
      })
      return
    }

    const schemaType = SCHEMA_TYPE_MAP[newType]
    if (!schemaType) {
      toast({
        title: "Vyberte typ podania",
        variant: "destructive",
      })
      return
    }

    setIsValidating(true)
    setValidationResult(null)
    try {
      const res = await fetch("/api/settings/e-dane/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml: xmlContent,
          schema_type: schemaType,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setValidationResult(result)

        if (result.valid) {
          toast({ title: "XML je validne" })
        } else {
          toast({
            title: "XML obsahuje chyby",
            variant: "destructive",
          })
        }
      } else {
        const err = await res.json()
        toast({
          title: "Chyba validacie",
          description: err.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba pri validacii",
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleCreateAndSubmit = async () => {
    if (!activeCompanyId || !newType || !xmlContent.trim()) {
      toast({
        title: "Vyplnte vsetky povinne polia",
        variant: "destructive",
      })
      return
    }

    const period = MONTHLY_TYPES.includes(newType)
      ? `${newYear}-${newMonth}`
      : newYear

    setIsSubmitting(true)
    try {
      // First create the submission
      const createRes = await fetch("/api/settings/e-dane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          type: newType,
          period,
          xml_content: xmlContent,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        toast({
          title: "Chyba pri vytvarani podania",
          description: err.error,
          variant: "destructive",
        })
        return
      }

      const created = await createRes.json()

      // Then submit to FS SR
      const submitRes = await fetch(
        `/api/settings/e-dane/${created.data.id}`,
        {
          method: "POST",
        }
      )

      if (submitRes.ok) {
        const submitResult = await submitRes.json()
        toast({
          title: "Podanie bolo odoslane",
          description: submitResult.message,
        })

        // Reset form
        setXmlContent("")
        setValidationResult(null)
        setNewType("")

        // Refresh submissions list
        setActiveTab("podania")
        fetchSubmissions()
      } else {
        const err = await submitRes.json()
        toast({
          title: "Chyba pri odosielani",
          description: err.message || err.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba pri odosielani podania",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubmission = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/e-dane/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Podanie bolo vymazane" })
        fetchSubmissions()
        setSelectedSubmission(null)
      } else {
        const err = await res.json()
        toast({
          title: "Chyba pri mazani",
          description: err.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba pri mazani podania",
        variant: "destructive",
      })
    }
  }

  const handleGenerateXml = async () => {
    if (!newType) {
      toast({
        title: "Vyberte typ podania",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      // Generate a sample XML based on the type
      // In production, this would call the existing tax XML generators
      const period = MONTHLY_TYPES.includes(newType)
        ? `${newYear}-${newMonth}`
        : newYear

      const xml = generateSampleXml(newType, period)
      setXmlContent(xml)
      setValidationResult(null)
      toast({ title: "XML bolo vygenerovane" })
    } catch {
      toast({
        title: "Chyba pri generovani XML",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleImportEkasa = async () => {
    if (!activeCompanyId || !ekasaDate) return

    setIsImportingEkasa(true)
    try {
      const res = await fetch("/api/settings/ekasa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          date: ekasaDate,
          generate_mock: true,
          mock_count: 8,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        toast({
          title: "eKasa data boli importovane",
          description: json.result?.message,
        })
        fetchEkasaImports()
      } else {
        const err = await res.json()
        toast({
          title: "Chyba pri importe",
          description: err.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba pri importe eKasa dat",
        variant: "destructive",
      })
    } finally {
      setIsImportingEkasa(false)
    }
  }

  const handleDownloadXml = (submission: Submission) => {
    if (!submission.xml_content) {
      toast({
        title: "XML obsah nie je dostupny",
        variant: "destructive",
      })
      return
    }
    const blob = new Blob([submission.xml_content], {
      type: "application/xml",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${submission.type}_${submission.period}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ===================== Render Helpers =====================

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) =>
    String(currentYear - i)
  )

  const isMonthlyType = MONTHLY_TYPES.includes(newType)
  const isValidated = validationResult?.valid === true

  // ===================== Render =====================

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">
          Vyberte firmu pre pristup k eDane
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">eDane Portal</h1>
        <p className="text-muted-foreground">
          Elektronicke podania na Financnu spravu SR, validacia XML a eKasa
          integracia
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="podania">Podania</TabsTrigger>
          <TabsTrigger value="nove_podanie">Nove podanie</TabsTrigger>
          <TabsTrigger value="archiv">Archiv</TabsTrigger>
          <TabsTrigger value="ekasa">eKasa</TabsTrigger>
        </TabsList>

        {/* ==================== TAB: Podania ==================== */}
        <TabsContent value="podania" className="space-y-4">
          {selectedSubmission ? (
            <SubmissionDetail
              submission={selectedSubmission}
              loading={loadingDetail}
              onBack={() => setSelectedSubmission(null)}
              onDelete={handleDeleteSubmission}
              onDownload={handleDownloadXml}
            />
          ) : (
            <>
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Typ podania</Label>
                      <Select
                        value={filterType}
                        onValueChange={setFilterType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vsetky typy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Vsetky typy</SelectItem>
                          {SUBMISSION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Rok</Label>
                      <Select
                        value={filterYear}
                        onValueChange={setFilterYear}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Stav</Label>
                      <Select
                        value={filterStatus}
                        onValueChange={setFilterStatus}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vsetky stavy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Vsetky stavy</SelectItem>
                          <SelectItem value="draft">Koncept</SelectItem>
                          <SelectItem value="validated">Validovane</SelectItem>
                          <SelectItem value="submitted">Odoslane</SelectItem>
                          <SelectItem value="accepted">Prijate</SelectItem>
                          <SelectItem value="rejected">Zamietnute</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button onClick={fetchSubmissions} variant="outline">
                        Filtrovat
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submissions Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Zoznam podani</CardTitle>
                    <CardDescription>
                      Vsetky elektronicke podania na FS SR
                    </CardDescription>
                  </div>
                  <Button onClick={() => setActiveTab("nove_podanie")}>
                    Nove podanie
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingSubmissions ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nacitavam...
                    </p>
                  ) : submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Ziadne podania
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Typ</TableHead>
                          <TableHead>Obdobie</TableHead>
                          <TableHead>Stav</TableHead>
                          <TableHead>Referencne cislo</TableHead>
                          <TableHead>Datum podania</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((sub) => (
                          <TableRow
                            key={sub.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => fetchSubmissionDetail(sub.id)}
                          >
                            <TableCell className="font-medium">
                              {getTypeLabel(sub.type)}
                            </TableCell>
                            <TableCell>{sub.period}</TableCell>
                            <TableCell>{getStatusBadge(sub.status)}</TableCell>
                            <TableCell>
                              {sub.reference_number || "-"}
                            </TableCell>
                            <TableCell>
                              {sub.submitted_at
                                ? new Date(
                                    sub.submitted_at
                                  ).toLocaleDateString("sk-SK")
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ==================== TAB: Nove podanie ==================== */}
        <TabsContent value="nove_podanie" className="space-y-4">
          {/* Type and Period Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Nove podanie</CardTitle>
              <CardDescription>
                Vytvorte a odoslite nove elektronicke podanie na Financnu spravu
                SR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Typ podania *</Label>
                  <Select value={newType} onValueChange={(v) => {
                    setNewType(v)
                    setValidationResult(null)
                    setXmlContent("")
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBMISSION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rok *</Label>
                  <Select value={newYear} onValueChange={setNewYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isMonthlyType && (
                  <div className="space-y-2">
                    <Label>Mesiac *</Label>
                    <Select value={newMonth} onValueChange={setNewMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateXml}
                  variant="outline"
                  disabled={!newType || isGenerating}
                >
                  {isGenerating
                    ? "Generujem..."
                    : "Automaticky generovat XML"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* XML Content */}
          <Card>
            <CardHeader>
              <CardTitle>XML Obsah</CardTitle>
              <CardDescription>
                Obsah XML dokumentu pre podanie. Mozete upravit manualne alebo
                vygenerovat automaticky.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {xmlContent ? (
                <div className="relative">
                  <pre className="max-h-96 overflow-auto rounded-lg border bg-slate-50 p-4 text-sm font-mono dark:bg-slate-900">
                    <XmlHighlight xml={xmlContent} />
                  </pre>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setXmlContent("")
                        setValidationResult(null)
                      }}
                    >
                      Vymazat
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                  <p className="text-muted-foreground">
                    Ziadny XML obsah. Pouzite tlacidlo &quot;Automaticky generovat
                    XML&quot; alebo vlozte XML manualne.
                  </p>
                  <textarea
                    className="mt-4 w-full min-h-[200px] rounded-md border bg-background p-3 font-mono text-sm"
                    placeholder="Vlozte XML obsah tu..."
                    value={xmlContent}
                    onChange={(e) => {
                      setXmlContent(e.target.value)
                      setValidationResult(null)
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validationResult && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Vysledok validacie
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validationResult.valid ? (
                  <div className="rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
                    <p className="font-medium">XML je validne</p>
                    <p className="text-sm mt-1">
                      Dokument splna vsetky poziadavky schemy. Mozete ho
                      odoslat na FS SR.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {validationResult.errors.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
                        <p className="font-medium text-red-800 dark:text-red-200">
                          Chyby ({validationResult.errors.length})
                        </p>
                        <ul className="mt-2 space-y-1">
                          {validationResult.errors.map((err, i) => (
                            <li
                              key={i}
                              className="text-sm text-red-700 dark:text-red-300"
                            >
                              {err.line && (
                                <span className="font-mono">
                                  [riadok {err.line}]{" "}
                                </span>
                              )}
                              {err.message}
                              {err.element && (
                                <span className="font-mono text-red-500">
                                  {" "}
                                  &lt;{err.element}&gt;
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Upozornenia ({validationResult.warnings.length})
                    </p>
                    <ul className="mt-2 space-y-1">
                      {validationResult.warnings.map((warn, i) => (
                        <li
                          key={i}
                          className="text-sm text-yellow-700 dark:text-yellow-300"
                        >
                          {warn.line && (
                            <span className="font-mono">
                              [riadok {warn.line}]{" "}
                            </span>
                          )}
                          {warn.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleValidate}
              variant="outline"
              disabled={!xmlContent.trim() || !newType || isValidating}
            >
              {isValidating ? "Validujem..." : "Validovat"}
            </Button>
            <Button
              onClick={handleCreateAndSubmit}
              disabled={
                !xmlContent.trim() ||
                !newType ||
                !isValidated ||
                isSubmitting
              }
            >
              {isSubmitting ? "Odosielam..." : "Odoslat na FS SR"}
            </Button>
          </div>
        </TabsContent>

        {/* ==================== TAB: Archiv ==================== */}
        <TabsContent value="archiv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Archiv podani</CardTitle>
              <CardDescription>
                Historicky prehlad vsetkych prijatych podani
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSubmissions ? (
                <p className="text-center text-muted-foreground py-8">
                  Nacitavam...
                </p>
              ) : (
                (() => {
                  const accepted = submissions.filter(
                    (s) =>
                      s.status === "accepted" || s.status === "submitted"
                  )
                  if (accepted.length === 0) {
                    return (
                      <p className="text-center text-muted-foreground py-8">
                        Ziadne archivovane podania
                      </p>
                    )
                  }
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Typ</TableHead>
                          <TableHead>Obdobie</TableHead>
                          <TableHead>Referencne cislo</TableHead>
                          <TableHead>Datum podania</TableHead>
                          <TableHead>Akcie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accepted.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">
                              {getTypeLabel(sub.type)}
                            </TableCell>
                            <TableCell>{sub.period}</TableCell>
                            <TableCell>
                              {sub.reference_number || "-"}
                            </TableCell>
                            <TableCell>
                              {sub.submitted_at
                                ? new Date(
                                    sub.submitted_at
                                  ).toLocaleDateString("sk-SK")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  fetchSubmissionDetail(sub.id)
                                  setActiveTab("podania")
                                }}
                              >
                                Detail
                              </Button>
                              {sub.xml_content && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="ml-2"
                                  onClick={() => handleDownloadXml(sub)}
                                >
                                  Stiahnut XML
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB: eKasa ==================== */}
        <TabsContent value="ekasa" className="space-y-4">
          {/* Import Controls */}
          <Card>
            <CardHeader>
              <CardTitle>eKasa Import</CardTitle>
              <CardDescription>
                Import dennej uzavierky z eKasa systemu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={ekasaDate}
                    onChange={(e) => setEkasaDate(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleImportEkasa}
                  disabled={isImportingEkasa}
                >
                  {isImportingEkasa ? "Importujem..." : "Importovat"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Selected Import Detail */}
          {selectedImport && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Pocet blockov</CardDescription>
                    <CardTitle className="text-2xl">
                      {selectedImport.total_receipts}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Celkova suma</CardDescription>
                    <CardTitle className="text-2xl">
                      {Number(selectedImport.total_amount).toFixed(2)} EUR
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>DPH</CardDescription>
                    <CardTitle className="text-2xl">
                      {Number(selectedImport.total_vat).toFixed(2)} EUR
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Receipts Table */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Blocky - {selectedImport.date}
                  </CardTitle>
                  <CardDescription>
                    Zoznam eKasa blockov z dennej uzavierky
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedImport.receipts_data &&
                  selectedImport.receipts_data.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cislo</TableHead>
                          <TableHead className="text-right">Suma</TableHead>
                          <TableHead className="text-right">DPH</TableHead>
                          <TableHead>OKP</TableHead>
                          <TableHead>UID</TableHead>
                          <TableHead>Parovanie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedImport.receipts_data.map(
                          (receipt: EKasaReceipt) => (
                            <TableRow key={receipt.id}>
                              <TableCell className="font-mono text-sm">
                                {receipt.receipt_number}
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(receipt.amount).toFixed(2)} EUR
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(receipt.vat_amount).toFixed(2)} EUR
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {receipt.okp}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[150px] truncate">
                                {receipt.uid}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-gray-50">
                                  Neparovane
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Ziadne blocky
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button
                variant="outline"
                onClick={() => setSelectedImport(null)}
              >
                Spat na zoznam
              </Button>
            </>
          )}

          {/* Imports List */}
          {!selectedImport && (
            <Card>
              <CardHeader>
                <CardTitle>Denne uzavierky</CardTitle>
                <CardDescription>
                  Prehlad importovanych dennych uzavierok z eKasa
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEkasa ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nacitavam...
                  </p>
                ) : ekasaImports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Ziadne importovane uzavierky
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">
                          Pocet blockov
                        </TableHead>
                        <TableHead className="text-right">
                          Celkova suma
                        </TableHead>
                        <TableHead className="text-right">DPH</TableHead>
                        <TableHead>Akcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ekasaImports.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-medium">
                            {imp.date}
                          </TableCell>
                          <TableCell className="text-right">
                            {imp.total_receipts}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(imp.total_amount).toFixed(2)} EUR
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(imp.total_vat).toFixed(2)} EUR
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedImport(imp)}
                            >
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===================== Sub-Components =====================

/**
 * Basic XML syntax highlighting component.
 */
function XmlHighlight({ xml }: { xml: string }) {
  const lines = xml.split("\n")

  return (
    <code>
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="select-none pr-4 text-right text-muted-foreground w-8 inline-block">
            {i + 1}
          </span>
          <span
            dangerouslySetInnerHTML={{
              __html: highlightXmlLine(line),
            }}
          />
        </div>
      ))}
    </code>
  )
}

function highlightXmlLine(line: string): string {
  // Escape HTML entities first
  let result = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Highlight XML declaration
  result = result.replace(
    /(&lt;\?xml.*?\?&gt;)/g,
    '<span class="text-purple-600 dark:text-purple-400">$1</span>'
  )

  // Highlight closing tags
  result = result.replace(
    /(&lt;\/)([\w.-]+)(&gt;)/g,
    '<span class="text-blue-600 dark:text-blue-400">$1$2$3</span>'
  )

  // Highlight opening tags with attributes
  result = result.replace(
    /(&lt;)([\w.-]+)([\s][^&]*?)?(\/?&gt;)/g,
    '<span class="text-blue-600 dark:text-blue-400">$1$2</span>$3<span class="text-blue-600 dark:text-blue-400">$4</span>'
  )

  // Highlight attribute names
  result = result.replace(
    /([\w-]+)(=)/g,
    '<span class="text-orange-600 dark:text-orange-400">$1</span>$2'
  )

  // Highlight attribute values
  result = result.replace(
    /(&quot;|")(.*?)(&quot;|")/g,
    '<span class="text-green-600 dark:text-green-400">&quot;$2&quot;</span>'
  )

  return result
}

/**
 * Submission detail view component.
 */
function SubmissionDetail({
  submission,
  loading,
  onBack,
  onDelete,
  onDownload,
}: {
  submission: Submission
  loading: boolean
  onBack: () => void
  onDelete: (id: string) => void
  onDownload: (s: Submission) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam detail...</p>
      </div>
    )
  }

  const canDelete =
    submission.status === "draft" || submission.status === "validated"

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        Spat na zoznam
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{getTypeLabel(submission.type)}</CardTitle>
              <CardDescription>
                Obdobie: {submission.period}
              </CardDescription>
            </div>
            {getStatusBadge(submission.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Referencne cislo</Label>
              <p className="font-mono">
                {submission.reference_number || "Zatial nepriradene"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Datum podania</Label>
              <p>
                {submission.submitted_at
                  ? new Date(submission.submitted_at).toLocaleString("sk-SK")
                  : "Neodoslane"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Vytvorene</Label>
              <p>
                {new Date(submission.created_at).toLocaleString("sk-SK")}
              </p>
            </div>
            {submission.response_message && (
              <div>
                <Label className="text-muted-foreground">
                  Odpoved FS SR
                </Label>
                <p className="text-sm">{submission.response_message}</p>
              </div>
            )}
          </div>

          {submission.xml_content && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground">XML Obsah</Label>
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg border bg-slate-50 p-4 text-sm font-mono dark:bg-slate-900">
                  <XmlHighlight xml={submission.xml_content} />
                </pre>
              </div>
            </>
          )}

          <Separator />

          <div className="flex gap-2">
            {submission.xml_content && (
              <Button
                variant="outline"
                onClick={() => onDownload(submission)}
              >
                Stiahnut XML
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => onDelete(submission.id)}
              >
                Vymazat podanie
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===================== XML Sample Generator =====================

/**
 * Generate sample XML for a given submission type.
 * Uses simplified structures matching the existing XML generators.
 */
function generateSampleXml(type: string, period: string): string {
  const year = period.substring(0, 4)
  const month = period.length > 4 ? period.substring(5, 7) : undefined
  const today = new Date().toISOString().split("T")[0]

  switch (type) {
    case "dph_priznanie":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<DPHPriznanie xmlns="http://www.financnasprava.sk/dph">',
        "  <Hlavicka>",
        "    <DruhPriznania>R</DruhPriznania>",
        `    <Rok>${year}</Rok>`,
        month ? `    <Mesiac>${month}</Mesiac>` : "",
        `    <DatumPodania>${today}</DatumPodania>`,
        "  </Hlavicka>",
        "  <Identifikacia>",
        "    <Nazov>Vasa firma s.r.o.</Nazov>",
        "    <ICO>12345678</ICO>",
        "    <DIC>2012345678</DIC>",
        "    <ICDPH>SK2012345678</ICDPH>",
        "  </Identifikacia>",
        "  <VystupnaDPH>",
        "    <Sadzba23>",
        "      <ZakladDane>10000.00</ZakladDane>",
        "      <Dan>2300.00</Dan>",
        "    </Sadzba23>",
        "    <Sadzba19>",
        "      <ZakladDane>0.00</ZakladDane>",
        "      <Dan>0.00</Dan>",
        "    </Sadzba19>",
        "    <Sadzba5>",
        "      <ZakladDane>0.00</ZakladDane>",
        "      <Dan>0.00</Dan>",
        "    </Sadzba5>",
        "    <DanCelkom>2300.00</DanCelkom>",
        "  </VystupnaDPH>",
        "  <VstupnaDPH>",
        "    <Sadzba23>",
        "      <ZakladDane>5000.00</ZakladDane>",
        "      <Dan>1150.00</Dan>",
        "    </Sadzba23>",
        "    <Sadzba19>",
        "      <ZakladDane>0.00</ZakladDane>",
        "      <Dan>0.00</Dan>",
        "    </Sadzba19>",
        "    <Sadzba5>",
        "      <ZakladDane>0.00</ZakladDane>",
        "      <Dan>0.00</Dan>",
        "    </Sadzba5>",
        "    <DanCelkom>1150.00</DanCelkom>",
        "  </VstupnaDPH>",
        "  <Vysledok>",
        "    <VlastnaDanovaPovinnost>1150.00</VlastnaDanovaPovinnost>",
        "    <NadmernyOdpocet>0.00</NadmernyOdpocet>",
        "  </Vysledok>",
        "  <Statistiky>",
        "    <PocetVydanychFaktur>15</PocetVydanychFaktur>",
        "    <PocetPrijatychFaktur>8</PocetPrijatychFaktur>",
        "  </Statistiky>",
        "</DPHPriznanie>",
      ]
        .filter(Boolean)
        .join("\n")

    case "kontrolny_vykaz":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<KontrolnyVykaz xmlns="http://www.financnasprava.sk/kvdph">',
        "  <Hlavicka>",
        "    <DruhVykazu>R</DruhVykazu>",
        `    <Rok>${year}</Rok>`,
        month ? `    <Mesiac>${month}</Mesiac>` : "",
        `    <DatumPodania>${today}</DatumPodania>`,
        "  </Hlavicka>",
        "  <Identifikacia>",
        "    <Nazov>Vasa firma s.r.o.</Nazov>",
        "    <ICO>12345678</ICO>",
        "    <DIC>2012345678</DIC>",
        "    <ICDPH>SK2012345678</ICDPH>",
        "  </Identifikacia>",
        "  <CastA1>",
        "    <PocetZaznamov>0</PocetZaznamov>",
        "  </CastA1>",
        "  <CastA2>",
        "    <PocetZaznamov>1</PocetZaznamov>",
        "    <Zaznam>",
        "      <ICDPH>SK2098765432</ICDPH>",
        "      <CisloFaktury>FV-2025-001</CisloFaktury>",
        `      <DatumFaktury>${today}</DatumFaktury>`,
        "      <ZakladDane>1000.00</ZakladDane>",
        "      <SumaDane>230.00</SumaDane>",
        "      <SadzbaDane>23</SadzbaDane>",
        "    </Zaznam>",
        "  </CastA2>",
        "  <CastB1>",
        "    <PocetZaznamov>0</PocetZaznamov>",
        "  </CastB1>",
        "  <CastB2>",
        "    <PocetZaznamov>0</PocetZaznamov>",
        "  </CastB2>",
        "  <CastB3>",
        "    <PocetZaznamov>0</PocetZaznamov>",
        "  </CastB3>",
        "</KontrolnyVykaz>",
      ]
        .filter(Boolean)
        .join("\n")

    case "suhrnny_vykaz":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dokument xmlns="http://www.financnasprava.sk/sv">',
        "  <hlavicka>",
        "    <dic>2012345678</dic>",
        "    <icDph>SK2012345678</icDph>",
        "    <nazovDanSubjektu>Vasa firma s.r.o.</nazovDanSubjektu>",
        "    <ulica>Hlavna 1</ulica>",
        "    <mesto>Bratislava</mesto>",
        "    <psc>81101</psc>",
        "    <stat>SK</stat>",
        `    <rok>${year}</rok>`,
        `    <obdobieTyp>M</obdobieTyp>`,
        `    <obdobie>${month || "01"}</obdobie>`,
        "    <druhPriznania>R</druhPriznania>",
        "  </hlavicka>",
        "  <telo>",
        "    <riadky>",
        "      <riadok>",
        "        <poradCislo>1</poradCislo>",
        "        <kodKrajiny>CZ</kodKrajiny>",
        "        <icDphOdberatela>CZ12345678</icDphOdberatela>",
        "        <hodnotaDodavok>5000</hodnotaDodavok>",
        "        <kodPlnenia>0</kodPlnenia>",
        "      </riadok>",
        "    </riadky>",
        "    <sucty>",
        "      <tovarSpolu>5000</tovarSpolu>",
        "      <sluzbySpolu>0</sluzbySpolu>",
        "      <trojstrannyObchodSpolu>0</trojstrannyObchodSpolu>",
        "      <celkovaSuma>5000</celkovaSuma>",
        "    </sucty>",
        "  </telo>",
        "</dokument>",
      ]
        .filter(Boolean)
        .join("\n")

    case "dppo":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dokument xmlns="http://www.financnasprava.sk/dppo">',
        "  <hlavicka>",
        "    <dic>2012345678</dic>",
        "    <ico>12345678</ico>",
        "    <pravnaForma>112</pravnaForma>",
        "    <nazovDanSubjektu>Vasa firma s.r.o.</nazovDanSubjektu>",
        "    <ulica>Hlavna 1</ulica>",
        "    <mesto>Bratislava</mesto>",
        "    <psc>81101</psc>",
        "    <stat>SK</stat>",
        `    <zdanovaciObdobieOd>01.01.${year}</zdanovaciObdobieOd>`,
        `    <zdanovaciObdobieDo>31.12.${year}</zdanovaciObdobieDo>`,
        "    <druhPriznania>R</druhPriznania>",
        "  </hlavicka>",
        "  <telo>",
        "    <castI>",
        "      <r100>100000.00</r100>",
        "      <r110>80000.00</r110>",
        "      <r200>20000.00</r200>",
        "    </castI>",
        "    <castII>",
        "      <r210>2000.00</r210>",
        "      <r220>0.00</r220>",
        "      <r230>0.00</r230>",
        "    </castII>",
        "    <castIII>",
        "      <r310>0.00</r310>",
        "    </castIII>",
        "    <castIV>",
        "      <r400>22000.00</r400>",
        "      <r410>0.00</r410>",
        "      <r420>22000.00</r420>",
        "    </castIV>",
        "    <castV>",
        "      <r500>21</r500>",
        "      <r510>4620.00</r510>",
        "      <r520>3000.00</r520>",
        "      <r530>1620.00</r530>",
        "    </castV>",
        "  </telo>",
        "</dokument>",
      ].join("\n")

    case "dpfo":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dokument xmlns="http://www.financnasprava.sk/dpfo-b">',
        "  <hlavicka>",
        "    <dic>2012345678</dic>",
        "    <nazovDanSubjektu>Jan Vzorovy</nazovDanSubjektu>",
        "    <ulica>Hlavna 1</ulica>",
        "    <mesto>Bratislava</mesto>",
        "    <psc>81101</psc>",
        "    <stat>SK</stat>",
        `    <zdanovaciObdobie>${year}</zdanovaciObdobie>`,
        "    <druhPriznania>R</druhPriznania>",
        "  </hlavicka>",
        "  <telo>",
        "    <castVI>",
        "      <r600>50000.00</r600>",
        "      <r601>S</r601>",
        "      <r610>30000.00</r610>",
        "      <r612>30000.00</r612>",
        "      <r620>20000.00</r620>",
        "    </castVI>",
        "    <castVII>",
        "      <r700>4922.82</r700>",
        "      <r710>0.00</r710>",
        "      <r720>0.00</r720>",
        "      <r730>4922.82</r730>",
        "    </castVII>",
        "    <castVIII>",
        "      <r800>15077.18</r800>",
        "      <r810>2864.66</r810>",
        "      <r820>0.00</r820>",
        "      <r830>2864.66</r830>",
        "    </castVIII>",
        "    <castIX>",
        "      <r900>0.00</r900>",
        "      <r910>0.00</r910>",
        "      <r920>2864.66</r920>",
        "      <r930>1500.00</r930>",
        "      <r940>1364.66</r940>",
        "    </castIX>",
        "  </telo>",
        "</dokument>",
      ].join("\n")

    case "mesacny_prehlad":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dokument xmlns="http://www.financnasprava.sk/mvp">',
        "  <hlavicka>",
        "    <dic>2012345678</dic>",
        "    <nazovDanSubjektu>Vasa firma s.r.o.</nazovDanSubjektu>",
        `    <obdobie>${month || "01"}</obdobie>`,
        `    <rok>${year}</rok>`,
        "  </hlavicka>",
        "  <telo>",
        "    <zamestnanci>",
        "      <pocet>5</pocet>",
        "      <hrubeMzdy>8500.00</hrubeMzdy>",
        "    </zamestnanci>",
        "    <odvody>",
        "      <socialnePoistenie>2380.00</socialnePoistenie>",
        "      <zdravotnePoistenie>850.00</zdravotnePoistenie>",
        "    </odvody>",
        "    <celkovaSuma>11730.00</celkovaSuma>",
        "  </telo>",
        "</dokument>",
      ].join("\n")

    case "rocne_hlasenie":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dokument xmlns="http://www.financnasprava.sk/mvp">',
        "  <hlavicka>",
        "    <dic>2012345678</dic>",
        "    <nazovDanSubjektu>Vasa firma s.r.o.</nazovDanSubjektu>",
        `    <obdobie>12</obdobie>`,
        `    <rok>${year}</rok>`,
        "  </hlavicka>",
        "  <telo>",
        "    <zamestnanci>",
        "      <pocet>5</pocet>",
        "      <hrubeMzdy>102000.00</hrubeMzdy>",
        "    </zamestnanci>",
        "    <odvody>",
        "      <socialnePoistenie>28560.00</socialnePoistenie>",
        "      <zdravotnePoistenie>10200.00</zdravotnePoistenie>",
        "    </odvody>",
        "    <celkovaSuma>140760.00</celkovaSuma>",
        "  </telo>",
        "</dokument>",
      ].join("\n")

    default:
      return '<?xml version="1.0" encoding="UTF-8"?>\n<dokument>\n</dokument>'
  }
}
