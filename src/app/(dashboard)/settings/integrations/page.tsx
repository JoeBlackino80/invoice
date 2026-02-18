"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

// ============ Types ============

interface ColumnMappingItem {
  csvColumn: string
  csvIndex: number
  targetField: string
  autoMapped?: boolean
}

interface WebhookConfigItem {
  id: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
  created_at: string
  description?: string
}

interface WebhookDeliveryItem {
  id: string
  event: string
  status_code: number | null
  response_time_ms: number | null
  success: boolean
  error_message: string | null
  delivered_at: string
  retry_count: number
}

interface ExchangeRateItem {
  currency_from: string
  currency_to: string
  rate: number
  date: string
  source: string
}

interface RevaluationResultItem {
  invoice_number: string
  contact_name: string
  type: string
  currency: string
  foreign_amount: number
  original_rate: number
  closing_rate: number
  original_eur: number
  new_eur: number
  difference: number
  result_type: string
  entry: {
    debit_account: string
    credit_account: string
    amount: number
    description: string
  }
}

const ENTITY_TYPES = [
  { value: "invoices", label: "Faktury" },
  { value: "contacts", label: "Kontakty" },
  { value: "products", label: "Produkty" },
  { value: "journal_entries", label: "Uctovne zapisy" },
  { value: "employees", label: "Zamestnanci" },
]

const IMPORT_TYPES = [
  { value: "pohoda_xml", label: "Pohoda XML" },
  { value: "csv", label: "CSV" },
]

const EXPORT_FORMATS = [
  { value: "pohoda_xml", label: "Pohoda XML" },
  { value: "csv", label: "CSV" },
  { value: "ubl", label: "UBL 2.1" },
]

const WEBHOOK_EVENT_OPTIONS = [
  { value: "invoice.created", label: "Faktura vytvorena" },
  { value: "invoice.paid", label: "Faktura uhradena" },
  { value: "invoice.cancelled", label: "Faktura stornovana" },
  { value: "payment.received", label: "Platba prijata" },
  { value: "payment.sent", label: "Platba odoslana" },
  { value: "journal.posted", label: "Uctovny zapis zauctovany" },
  { value: "tax.generated", label: "Danove priznanie vygenerovane" },
  { value: "contact.created", label: "Kontakt vytvoreny" },
  { value: "contact.updated", label: "Kontakt aktualizovany" },
]

const ENTITY_FIELD_OPTIONS: Record<string, Array<{ field: string; label: string }>> = {
  invoices: [
    { field: "number", label: "Cislo faktury" },
    { field: "type", label: "Typ" },
    { field: "issue_date", label: "Datum vystavenia" },
    { field: "due_date", label: "Datum splatnosti" },
    { field: "tax_date", label: "Datum DPH" },
    { field: "variable_symbol", label: "Variabilny symbol" },
    { field: "constant_symbol", label: "Konstantny symbol" },
    { field: "contact_name", label: "Odberatel" },
    { field: "contact_ico", label: "ICO odberatela" },
    { field: "description", label: "Popis" },
    { field: "total_without_vat", label: "Suma bez DPH" },
    { field: "total_vat", label: "DPH" },
    { field: "total_with_vat", label: "Suma s DPH" },
    { field: "currency", label: "Mena" },
    { field: "payment_method", label: "Sposob platby" },
    { field: "note", label: "Poznamka" },
  ],
  contacts: [
    { field: "name", label: "Nazov" },
    { field: "ico", label: "ICO" },
    { field: "dic", label: "DIC" },
    { field: "ic_dph", label: "IC DPH" },
    { field: "street", label: "Ulica" },
    { field: "city", label: "Mesto" },
    { field: "zip", label: "PSC" },
    { field: "country", label: "Krajina" },
    { field: "email", label: "Email" },
    { field: "phone", label: "Telefon" },
    { field: "web", label: "Web" },
    { field: "bank_account", label: "Cislo uctu" },
    { field: "iban", label: "IBAN" },
    { field: "note", label: "Poznamka" },
    { field: "type", label: "Typ" },
  ],
  products: [
    { field: "code", label: "Kod" },
    { field: "name", label: "Nazov" },
    { field: "description", label: "Popis" },
    { field: "unit", label: "Jednotka" },
    { field: "unit_price", label: "Cena" },
    { field: "vat_rate", label: "DPH %" },
    { field: "ean", label: "EAN" },
    { field: "sku", label: "SKU" },
    { field: "category", label: "Kategoria" },
    { field: "stock_quantity", label: "Mnozstvo" },
  ],
  journal_entries: [
    { field: "number", label: "Cislo dokladu" },
    { field: "date", label: "Datum" },
    { field: "description", label: "Popis" },
    { field: "debit_account", label: "Ucet MD" },
    { field: "credit_account", label: "Ucet DAL" },
    { field: "amount", label: "Suma" },
    { field: "variable_symbol", label: "VS" },
    { field: "document_type", label: "Typ dokladu" },
  ],
  employees: [
    { field: "first_name", label: "Meno" },
    { field: "last_name", label: "Priezvisko" },
    { field: "personal_number", label: "Osobne cislo" },
    { field: "date_of_birth", label: "Datum narodenia" },
    { field: "email", label: "Email" },
    { field: "phone", label: "Telefon" },
    { field: "street", label: "Ulica" },
    { field: "city", label: "Mesto" },
    { field: "zip", label: "PSC" },
    { field: "position", label: "Pozicia" },
    { field: "department", label: "Oddelenie" },
    { field: "hire_date", label: "Datum nastupu" },
    { field: "gross_salary", label: "Hruba mzda" },
    { field: "bank_account", label: "Cislo uctu" },
    { field: "iban", label: "IBAN" },
  ],
}

const CURRENCIES = [
  "EUR", "USD", "GBP", "CZK", "HUF", "PLN", "CHF",
  "SEK", "NOK", "DKK", "RON", "BGN", "HRK", "JPY",
  "CAD", "AUD", "CNY", "TRY",
]

// ============ Main Component ============

export default function IntegrationsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integracie</h1>
        <p className="text-muted-foreground">
          Import, export, webhooky a multi-mena
        </p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooky</TabsTrigger>
          <TabsTrigger value="currency">Multi-mena</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <ImportTab companyId={activeCompanyId} toast={toast} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab companyId={activeCompanyId} toast={toast} />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab companyId={activeCompanyId} toast={toast} />
        </TabsContent>

        <TabsContent value="currency">
          <CurrencyTab companyId={activeCompanyId} toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============ Import Tab ============

function ImportTab({ companyId, toast }: { companyId: string | null; toast: any }) {
  const [importType, setImportType] = useState("csv")
  const [entityType, setEntityType] = useState("invoices")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parse result state
  const [parseResult, setParseResult] = useState<{
    headers: string[]
    rows: string[][]
    total_rows: number
    column_mapping: ColumnMappingItem[]
    preview_rows: string[][]
  } | null>(null)

  const [columnMapping, setColumnMapping] = useState<ColumnMappingItem[]>([])
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    errors: Array<{ row: number; column: string; message: string }>
  } | null>(null)

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setParseResult(null)
    setImportResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  const handleUpload = async () => {
    if (!file || !companyId) return
    setUploading(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("import_type", importType)
      formData.append("entity_type", entityType)

      const res = await fetch("/api/integrations/import", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error, variant: "destructive" })
        return
      }

      const data = await res.json()
      setParseResult(data)
      setColumnMapping(data.column_mapping || [])
      toast({ title: "Subor spracovany", description: `Najdenych ${data.total_rows} zaznamov` })
    } catch {
      toast({ title: "Chyba pri nahravani suboru", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleMappingChange = (csvIndex: number, targetField: string) => {
    setColumnMapping((prev) =>
      prev.map((m) =>
        m.csvIndex === csvIndex ? { ...m, targetField, autoMapped: false } : m
      )
    )
  }

  const handleImport = async () => {
    if (!parseResult || !companyId) return
    setImporting(true)

    try {
      const res = await fetch("/api/integrations/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parseResult.rows,
          mapping: columnMapping,
          entity_type: entityType,
          company_id: companyId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Chyba pri importe", description: data.error, variant: "destructive" })
        return
      }

      setImportResult({
        success: data.success,
        failed: data.failed,
        errors: data.errors || [],
      })

      toast({
        title: "Import dokonceny",
        description: `Uspesne: ${data.success}, Chyby: ${data.failed}`,
      })
    } catch {
      toast({ title: "Chyba pri importe", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  const fieldOptions = ENTITY_FIELD_OPTIONS[entityType] || []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import dat</CardTitle>
          <CardDescription>
            Nahrajte subor a namapujte stlpce na cielove polia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Typ importu</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Typ entity</Label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setParseResult(null); setImportResult(null) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={importType === "pohoda_xml" ? ".xml" : ".csv,.txt"}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Pretiahni subor sem</p>
                <p className="text-sm text-muted-foreground">
                  alebo klikni pre vyber suboru ({importType === "pohoda_xml" ? ".xml" : ".csv"})
                </p>
              </div>
            )}
          </div>

          {file && !parseResult && (
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Spracovavam..." : "Nahrat a spracovat"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Column Mapping Wizard */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle>Mapovanie stlpcov</CardTitle>
            <CardDescription>
              Priradte stlpce zo suboru k cielovym poliam. Automaticky namapovane stlpce su zvyraznene.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stlpec v subore</TableHead>
                  <TableHead>Ukazka dat</TableHead>
                  <TableHead>Cielove pole</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columnMapping.map((m) => {
                  const sampleValues = parseResult.preview_rows
                    .slice(0, 3)
                    .map((row) => row[m.csvIndex] || "")
                    .filter(Boolean)
                    .join(", ")

                  return (
                    <TableRow
                      key={m.csvIndex}
                      className={m.autoMapped && m.targetField ? "bg-green-50 dark:bg-green-950/20" : ""}
                    >
                      <TableCell className="font-medium">{m.csvColumn}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {sampleValues || "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.targetField || "skip"}
                          onValueChange={(v) => handleMappingChange(m.csvIndex, v === "skip" ? "" : v)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Preskocit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">-- Preskocit --</SelectItem>
                            {fieldOptions.map((f) => (
                              <SelectItem key={f.field} value={f.field}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {m.autoMapped && m.targetField ? (
                          <Badge variant="default">Automaticky</Badge>
                        ) : m.targetField ? (
                          <Badge variant="outline">Manualne</Badge>
                        ) : (
                          <Badge variant="secondary">Preskocene</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <Separator />

            {/* Preview */}
            <div>
              <h4 className="font-medium mb-2">Nahlad dat (prvih 5 riadkov)</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      {columnMapping
                        .filter((m) => m.targetField)
                        .map((m) => (
                          <TableHead key={m.csvIndex}>
                            {fieldOptions.find((f) => f.field === m.targetField)?.label || m.targetField}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.preview_rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        {columnMapping
                          .filter((m) => m.targetField)
                          .map((m) => (
                            <TableCell key={m.csvIndex} className="max-w-[150px] truncate">
                              {row[m.csvIndex] || "-"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importujem..." : "Importovat"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setParseResult(null); setImportResult(null); setFile(null) }}
              >
                Zrusit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Vysledok importu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                <p className="text-sm text-muted-foreground">Uspesne importovanych</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                <p className="text-sm text-muted-foreground">Chybnych zaznamov</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Chyby</h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Riadok</TableHead>
                        <TableHead>Stlpec</TableHead>
                        <TableHead>Chyba</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.column || "-"}</TableCell>
                          <TableCell>{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Export Tab ============

function ExportTab({ companyId, toast }: { companyId: string | null; toast: any }) {
  const [format, setFormat] = useState("csv")
  const [entityType, setEntityType] = useState("invoices")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!companyId) return
    setExporting(true)

    try {
      const res = await fetch("/api/integrations/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          entity_type: entityType,
          company_id: companyId,
          filters: {
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ title: "Chyba pri exporte", description: err.error, variant: "destructive" })
        return
      }

      // Download file
      const blob = await res.blob()
      const contentDisposition = res.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch
        ? filenameMatch[1]
        : `export_${entityType}_${new Date().toISOString().split("T")[0]}.${format === "csv" ? "csv" : "xml"}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({ title: "Export dokonceny" })
    } catch {
      toast({ title: "Chyba pri exporte", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export dat</CardTitle>
        <CardDescription>
          Exportujte data v roznych formatoch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Typ entity</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.filter((t) =>
                  format === "ubl" ? t.value === "invoices" : true
                ).map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <Button onClick={handleExport} disabled={exporting || !companyId}>
          {exporting ? "Exportujem..." : "Exportovat"}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============ Webhooks Tab ============

function WebhooksTab({ companyId, toast }: { companyId: string | null; toast: any }) {
  const [webhooks, setWebhooks] = useState<WebhookConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    events: [] as string[],
    description: "",
  })
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfigItem | null>(null)
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const fetchWebhooks = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/webhooks?company_id=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data)
      }
    } catch {
      toast({ title: "Chyba pri nacitani webhookov", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  const handleCreate = async () => {
    if (!companyId) return
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          url: newWebhook.url,
          events: newWebhook.events,
          description: newWebhook.description,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error, variant: "destructive" })
        return
      }

      toast({ title: "Webhook vytvoreny" })
      setDialogOpen(false)
      setNewWebhook({ url: "", events: [], description: "" })
      fetchWebhooks()
    } catch {
      toast({ title: "Chyba pri vytvarani webhooku", variant: "destructive" })
    }
  }

  const handleToggle = async (webhook: WebhookConfigItem) => {
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: webhook.id,
          is_active: !webhook.is_active,
        }),
      })

      if (res.ok) {
        fetchWebhooks()
      }
    } catch {
      toast({ title: "Chyba pri aktualizacii", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/webhooks?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({ title: "Webhook vymazany" })
        fetchWebhooks()
        if (selectedWebhook?.id === id) setSelectedWebhook(null)
      }
    } catch {
      toast({ title: "Chyba pri mazani", variant: "destructive" })
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}/test`, {
        method: "POST",
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: "Test uspesny", description: `Status: ${data.status_code}, Cas: ${data.response_time_ms}ms` })
      } else {
        toast({
          title: "Test neuspesny",
          description: data.error_message || `Status: ${data.status_code}`,
          variant: "destructive",
        })
      }

      // Refresh deliveries if viewing this webhook
      if (selectedWebhook?.id === id) {
        fetchDeliveries(id)
      }
    } catch {
      toast({ title: "Chyba pri testovani", variant: "destructive" })
    } finally {
      setTestingId(null)
    }
  }

  const fetchDeliveries = async (webhookId: string) => {
    setDeliveriesLoading(true)
    try {
      const res = await fetch(`/api/integrations/webhooks/${webhookId}/deliveries`)
      if (res.ok) {
        const data = await res.json()
        setDeliveries(data.deliveries || [])
      }
    } catch {
      // Ignore delivery fetch errors
    } finally {
      setDeliveriesLoading(false)
    }
  }

  const handleSelectWebhook = (webhook: WebhookConfigItem) => {
    setSelectedWebhook(webhook)
    fetchDeliveries(webhook.id)
  }

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret)
    toast({ title: "Secret skopirovan do schranky" })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooky</CardTitle>
              <CardDescription>
                Konfigurujte webhooky pre notifikacie o udalostiach
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>Novy webhook</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Nacitavam...</p>
          ) : webhooks.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ziadne webhooky. Kliknite na &quot;Novy webhook&quot; pre vytvorenie.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Udalosti</TableHead>
                  <TableHead>Aktivny</TableHead>
                  <TableHead>Vytvoreny</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow
                    key={wh.id}
                    className="cursor-pointer"
                    onClick={() => handleSelectWebhook(wh)}
                  >
                    <TableCell className="font-mono text-sm max-w-[250px] truncate">
                      {wh.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.slice(0, 3).map((ev) => (
                          <Badge key={ev} variant="secondary" className="text-xs">
                            {ev}
                          </Badge>
                        ))}
                        {wh.events.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{wh.events.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={wh.is_active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleToggle(wh) }}
                      >
                        {wh.is_active ? "Aktivny" : "Neaktivny"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(wh.created_at).toLocaleDateString("sk-SK")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(wh.id)}
                          disabled={testingId === wh.id}
                        >
                          {testingId === wh.id ? "..." : "Test"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copySecret(wh.secret)}
                        >
                          Secret
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(wh.id)}
                        >
                          Zmazat
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delivery Log */}
      {selectedWebhook && (
        <Card>
          <CardHeader>
            <CardTitle>Historia doruceni: {selectedWebhook.url}</CardTitle>
            <CardDescription>
              Poslednych 100 doruceni pre tento webhook
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deliveriesLoading ? (
              <p className="py-4 text-center text-muted-foreground">Nacitavam...</p>
            ) : deliveries.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">Ziadne dorucenia</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cas</TableHead>
                    <TableHead>Udalost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cas odpovede</TableHead>
                    <TableHead>Opakovanie</TableHead>
                    <TableHead>Chyba</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">
                        {new Date(d.delivered_at).toLocaleString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.event}</Badge>
                      </TableCell>
                      <TableCell>
                        {d.status_code ? (
                          <Badge
                            variant={
                              d.status_code >= 200 && d.status_code < 300
                                ? "default"
                                : "destructive"
                            }
                          >
                            {d.status_code}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Chyba</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.response_time_ms ? `${d.response_time_ms}ms` : "-"}
                      </TableCell>
                      <TableCell>{d.retry_count}</TableCell>
                      <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                        {d.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Webhook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novy webhook</DialogTitle>
            <DialogDescription>
              Konfigurujte URL a udalosti pre webhook notifikacie
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={newWebhook.url}
                onChange={(e) => setNewWebhook((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Popis (volitelne)</Label>
              <Input
                value={newWebhook.description}
                onChange={(e) => setNewWebhook((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Webhook pre..."
              />
            </div>
            <div className="space-y-2">
              <Label>Udalosti</Label>
              <div className="grid grid-cols-1 gap-2">
                {WEBHOOK_EVENT_OPTIONS.map((evt) => (
                  <div key={evt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${evt.value}`}
                      checked={newWebhook.events.includes(evt.value)}
                      onCheckedChange={(checked) => {
                        setNewWebhook((prev) => ({
                          ...prev,
                          events: checked
                            ? [...prev.events, evt.value]
                            : prev.events.filter((e) => e !== evt.value),
                        }))
                      }}
                    />
                    <Label htmlFor={`event-${evt.value}`} className="text-sm font-normal">
                      {evt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrusit
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newWebhook.url || newWebhook.events.length === 0}
            >
              Vytvorit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Currency Tab ============

function CurrencyTab({ companyId, toast }: { companyId: string | null; toast: any }) {
  const [rates, setRates] = useState<ExchangeRateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  // Converter state
  const [convertAmount, setConvertAmount] = useState("")
  const [convertFrom, setConvertFrom] = useState("EUR")
  const [convertTo, setConvertTo] = useState("USD")
  const [convertResult, setConvertResult] = useState<{
    result: number
    rate: number
  } | null>(null)
  const [converting, setConverting] = useState(false)

  // Revaluation state
  const [revalDate, setRevalDate] = useState("")
  const [revalLoading, setRevalLoading] = useState(false)
  const [revalConfirming, setRevalConfirming] = useState(false)
  const [revalResult, setRevalResult] = useState<{
    preview: boolean
    items_count: number
    revaluation_count: number
    total_gain: number
    total_loss: number
    results: RevaluationResultItem[]
  } | null>(null)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    try {
      let url = "/api/currency/rates?"
      if (companyId) url += `company_id=${companyId}&`
      url += `date=${new Date().toISOString().split("T")[0]}`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setRates(data)
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const handleFetchRates = async () => {
    if (!companyId) return
    setFetching(true)
    try {
      const res = await fetch("/api/currency/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          date: new Date().toISOString().split("T")[0],
        }),
      })

      if (res.ok) {
        toast({ title: "Kurzy boli aktualizovane" })
        fetchRates()
      } else {
        toast({ title: "Chyba pri aktualizacii kurzov", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri aktualizacii kurzov", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  const handleConvert = async () => {
    if (!convertAmount) return
    setConverting(true)
    setConvertResult(null)

    try {
      const res = await fetch("/api/currency/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(convertAmount),
          from: convertFrom,
          to: convertTo,
          company_id: companyId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setConvertResult({ result: data.result, rate: data.rate || data.cross_rate })
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri konverzii", variant: "destructive" })
    } finally {
      setConverting(false)
    }
  }

  const handleRevaluation = async (confirm: boolean) => {
    if (!companyId || !revalDate) return
    if (confirm) {
      setRevalConfirming(true)
    } else {
      setRevalLoading(true)
    }

    try {
      const res = await fetch("/api/currency/revaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          date: revalDate,
          confirm,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setRevalResult(data)

        if (confirm) {
          toast({
            title: "Precenenie dokoncene",
            description: `Vytvorene uctovne zapisy: ${data.entries_created || data.revaluation_count}`,
          })
        }
      } else {
        const err = await res.json()
        toast({ title: "Chyba", description: err.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri preceneni", variant: "destructive" })
    } finally {
      setRevalLoading(false)
      setRevalConfirming(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kurzovy listok</CardTitle>
              <CardDescription>Aktualne kurzy ECB voci EUR</CardDescription>
            </div>
            <Button onClick={handleFetchRates} disabled={fetching}>
              {fetching ? "Aktualizujem..." : "Aktualizovat kurzy"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-4 text-center text-muted-foreground">Nacitavam...</p>
          ) : rates.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              Ziadne kurzy. Kliknite na &quot;Aktualizovat kurzy&quot;.
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mena</TableHead>
                    <TableHead>Kurz (1 EUR = X)</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Zdroj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r, i) => (
                    <TableRow key={`${r.currency_to}-${i}`}>
                      <TableCell className="font-medium">{r.currency_to}</TableCell>
                      <TableCell className="font-mono">{r.rate.toFixed(4)}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        <Badge variant={r.source === "ECB" ? "default" : "outline"}>
                          {r.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency Converter */}
      <Card>
        <CardHeader>
          <CardTitle>Meny konvertor</CardTitle>
          <CardDescription>Prepocitajte sumy medzi menami</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Suma</Label>
              <Input
                type="number"
                step="0.01"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Z meny</Label>
              <Select value={convertFrom} onValueChange={setConvertFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Na menu</Label>
              <Select value={convertTo} onValueChange={setConvertTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConvert} disabled={converting || !convertAmount}>
              {converting ? "..." : "Prepocitat"}
            </Button>
          </div>

          {convertResult && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-lg font-medium">
                {parseFloat(convertAmount).toFixed(2)} {convertFrom} ={" "}
                <span className="text-2xl font-bold">{convertResult.result.toFixed(2)} {convertTo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Kurz: {convertResult.rate?.toFixed(4) || "-"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year-End Revaluation */}
      <Card>
        <CardHeader>
          <CardTitle>Kurzove precenenie k 31.12.</CardTitle>
          <CardDescription>
            Precenenie ottvorenych pohladavok a zavazkov v cudzej mene uzavieracim kurzom ECB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Datum precenenia</Label>
              <Input
                type="date"
                value={revalDate}
                onChange={(e) => setRevalDate(e.target.value)}
                placeholder="2025-12-31"
              />
            </div>
            <Button
              onClick={() => handleRevaluation(false)}
              disabled={revalLoading || !revalDate || !companyId}
            >
              {revalLoading ? "Nacitavam..." : "Spustit precenenie"}
            </Button>
          </div>

          {revalResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{revalResult.items_count}</p>
                  <p className="text-sm text-muted-foreground">Otvorenych poloziek</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {revalResult.total_gain.toFixed(2)} EUR
                  </p>
                  <p className="text-sm text-muted-foreground">Kurzovy zisk (663)</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {revalResult.total_loss.toFixed(2)} EUR
                  </p>
                  <p className="text-sm text-muted-foreground">Kurzova strata (563)</p>
                </div>
              </div>

              {revalResult.results.length > 0 && (
                <>
                  <h4 className="font-medium">Nahlad uctovnych zapisov</h4>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Faktura</TableHead>
                          <TableHead>Kontakt</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Mena</TableHead>
                          <TableHead>Suma cudzej meny</TableHead>
                          <TableHead>Povodny kurz</TableHead>
                          <TableHead>Uzavieraci kurz</TableHead>
                          <TableHead>Rozdiel EUR</TableHead>
                          <TableHead>Ucet MD</TableHead>
                          <TableHead>Ucet DAL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revalResult.results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.invoice_number}</TableCell>
                            <TableCell>{r.contact_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {r.type === "receivable" ? "Pohladavka" : "Zavazok"}
                              </Badge>
                            </TableCell>
                            <TableCell>{r.currency}</TableCell>
                            <TableCell className="font-mono">
                              {r.foreign_amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {r.original_rate.toFixed(4)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {r.closing_rate.toFixed(4)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  r.result_type === "kurzovy_zisk"
                                    ? "text-green-600 font-medium"
                                    : "text-red-600 font-medium"
                                }
                              >
                                {r.difference > 0 ? "+" : ""}{r.difference.toFixed(2)} EUR
                              </span>
                            </TableCell>
                            <TableCell className="font-mono">{r.entry.debit_account}</TableCell>
                            <TableCell className="font-mono">{r.entry.credit_account}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {revalResult.preview && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRevaluation(true)}
                        disabled={revalConfirming}
                      >
                        {revalConfirming ? "Ukladam..." : "Potvrdit a zauctovat"}
                      </Button>
                      <Button variant="outline" onClick={() => setRevalResult(null)}>
                        Zrusit
                      </Button>
                    </div>
                  )}

                  {!revalResult.preview && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="font-medium text-green-600">
                        Precenenie bolo zauctovane. Uctovne zapisy boli vytvorene.
                      </p>
                    </div>
                  )}
                </>
              )}

              {revalResult.results.length === 0 && (
                <p className="py-4 text-center text-muted-foreground">
                  Ziadne polozky na precenenie. Vsetky otvorene polozky su v EUR alebo nemaju kurzovy rozdiel.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
