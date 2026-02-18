"use client"

import { Suspense, useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  currency: string
  bank_name: string | null
}

interface PreviewTransaction {
  date: string
  amount: number
  type: "credit" | "debit"
  counterparty_name: string
  counterparty_iban: string
  variable_symbol: string
  description: string
}

interface ParseError {
  row: number
  message: string
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function ImportStatementPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [step, setStep] = useState(1)
  const [importing, setImporting] = useState(false)

  // Step 1: select bank account
  const [selectedAccountId, setSelectedAccountId] = useState(searchParams.get("bank_account_id") || "")
  const [bankPreset, setBankPreset] = useState("")
  const [statementNumber, setStatementNumber] = useState("")
  const [statementDate, setStatementDate] = useState("")

  // Step 2: file upload
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 3: preview
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([])
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [parsing, setParsing] = useState(false)

  // Step 4: result
  const [importResult, setImportResult] = useState<{
    imported_count: number
    total_rows: number
    parse_errors: ParseError[]
    insert_errors: ParseError[]
  } | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/bank-accounts?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setAccounts(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast({ variant: "destructive", title: "Chyba", description: "Prosim vyberte CSV subor" })
      return
    }
    setFile(selectedFile)
    setPreviewTransactions([])
    setParseErrors([])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  // Parse file for preview (client-side)
  const handlePreview = async () => {
    if (!file) return

    setParsing(true)
    try {
      const text = await file.text()

      // We'll use a simplified client-side parse for preview
      // The full parse happens server-side during import
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim())

      if (lines.length < 2) {
        setParseErrors([{ row: 0, message: "Subor musi obsahovat hlavicku a aspon jeden riadok dat" }])
        setParsing(false)
        return
      }

      // Detect delimiter
      const firstLines = lines.slice(0, 5).join("\n")
      const semicolonCount = (firstLines.match(/;/g) || []).length
      const commaCount = (firstLines.match(/,/g) || []).length
      const tabCount = (firstLines.match(/\t/g) || []).length

      let delimiter = ","
      if (tabCount > semicolonCount && tabCount > commaCount) delimiter = "\t"
      else if (semicolonCount > commaCount) delimiter = ";"

      // Parse CSV line with quote handling
      const parseLine = (line: string): string[] => {
        const result: string[] = []
        let current = ""
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (inQuotes) {
            if (char === '"') {
              if (i + 1 < line.length && line[i + 1] === '"') {
                current += '"'
                i++
              } else {
                inQuotes = false
              }
            } else {
              current += char
            }
          } else {
            if (char === '"') {
              inQuotes = true
            } else if (char === delimiter) {
              result.push(current.trim())
              current = ""
            } else {
              current += char
            }
          }
        }
        result.push(current.trim())
        return result
      }

      const headers = parseLine(lines[0])

      // Normalize for matching
      const normalize = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

      const normalizedHeaders = headers.map(normalize)

      // Find column indices
      const findCol = (variants: string[]): number => {
        for (const v of variants) {
          const nv = normalize(v)
          const idx = normalizedHeaders.findIndex((h) => h === nv || h.includes(nv))
          if (idx !== -1) return idx
        }
        return -1
      }

      const dateCol = findCol(["datum", "date", "datum zauctovani", "datum zaúčtovania", "datum spracovania"])
      const amountCol = findCol(["suma", "amount", "ciastka", "čiastka", "celkova suma"])
      const nameCol = findCol(["nazov protiuctu", "meno protistrany", "nazov uctu prijemcu", "protiucet nazov", "counterparty", "meno"])
      const ibanCol = findCol(["protiucet", "iban protistrany", "cislo uctu prijemcu", "iban", "číslo účtu"])
      const vsCol = findCol(["variabilny symbol", "vs", "variable symbol"])
      const descCol = findCol(["popis", "popis transakcie", "sprava pre prijemcu", "sprava", "description", "poznamka"])

      if (dateCol === -1) {
        setParseErrors([{ row: 0, message: "Nepodarilo sa najst stlpec s datumom" }])
        setParsing(false)
        return
      }

      if (amountCol === -1) {
        setParseErrors([{ row: 0, message: "Nepodarilo sa najst stlpec so sumou" }])
        setParsing(false)
        return
      }

      const transactions: PreviewTransaction[] = []
      const errors: ParseError[] = []

      for (let i = 1; i < lines.length; i++) {
        const fields = parseLine(lines[i])

        try {
          // Parse date
          const dateRaw = fields[dateCol] || ""
          let parsedDate = ""
          const isoMatch = dateRaw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
          const skMatch = dateRaw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
          const skShortMatch = dateRaw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/)

          if (isoMatch) {
            parsedDate = dateRaw
          } else if (skMatch) {
            parsedDate = `${skMatch[3]}-${skMatch[2].padStart(2, "0")}-${skMatch[1].padStart(2, "0")}`
          } else if (skShortMatch) {
            const yr = parseInt(skShortMatch[3])
            const fullYear = yr >= 50 ? `19${skShortMatch[3]}` : `20${skShortMatch[3]}`
            parsedDate = `${fullYear}-${skShortMatch[2].padStart(2, "0")}-${skShortMatch[1].padStart(2, "0")}`
          } else {
            errors.push({ row: i + 1, message: `Neplatny format datumu: "${dateRaw}"` })
            continue
          }

          // Parse amount
          let amountStr = fields[amountCol] || ""
          amountStr = amountStr.replace(/[€$£\u00a0]/g, "").replace(/\s/g, "")
          if (amountStr.includes(",") && amountStr.includes(".")) {
            const lastComma = amountStr.lastIndexOf(",")
            const lastDot = amountStr.lastIndexOf(".")
            if (lastComma > lastDot) {
              amountStr = amountStr.replace(/\./g, "").replace(",", ".")
            } else {
              amountStr = amountStr.replace(/,/g, "")
            }
          } else if (amountStr.includes(",")) {
            amountStr = amountStr.replace(",", ".")
          }
          const amount = parseFloat(amountStr)

          if (isNaN(amount)) {
            errors.push({ row: i + 1, message: "Nepodarilo sa precitat sumu" })
            continue
          }

          transactions.push({
            date: parsedDate,
            amount,
            type: amount >= 0 ? "credit" : "debit",
            counterparty_name: nameCol !== -1 ? (fields[nameCol] || "") : "",
            counterparty_iban: ibanCol !== -1 ? (fields[ibanCol] || "") : "",
            variable_symbol: vsCol !== -1 ? (fields[vsCol] || "") : "",
            description: descCol !== -1 ? (fields[descCol] || "") : "",
          })
        } catch {
          errors.push({ row: i + 1, message: "Neocakavana chyba pri spracovani riadku" })
        }
      }

      setPreviewTransactions(transactions)
      setParseErrors(errors)

      if (transactions.length > 0) {
        setStep(3)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa precitat subor" })
    } finally {
      setParsing(false)
    }
  }

  // Confirm import
  const handleImport = async () => {
    if (!file || !selectedAccountId || !activeCompanyId) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bank_account_id", selectedAccountId)
      formData.append("company_id", activeCompanyId)
      if (bankPreset) formData.append("bank_preset", bankPreset)
      if (statementNumber) formData.append("statement_number", statementNumber)
      if (statementDate) formData.append("statement_date", statementDate)

      const res = await fetch("/api/bank-statements/import", {
        method: "POST",
        body: formData,
      })

      const json = await res.json()

      if (res.ok) {
        setImportResult(json)
        setStep(4)
        toast({
          title: "Import uspesny",
          description: `Importovanych ${json.imported_count} transakcii`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Chyba importu",
          description: json.error || "Nepodarilo sa importovat vypis",
        })
        if (json.details) {
          setParseErrors(json.details)
        }
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa importovat vypis" })
    } finally {
      setImporting(false)
    }
  }

  const totalCredit = previewTransactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0)
  const totalDebit = previewTransactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Import bankoveho vypisu</h1>
        <p className="text-muted-foreground">Importujte transakcie z CSV suboru</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { num: 1, label: "Bankovy ucet" },
          { num: 2, label: "Nahrat subor" },
          { num: 3, label: "Nahlad transakcii" },
          { num: 4, label: "Vysledok" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            {idx > 0 && <div className="w-8 h-0.5 bg-muted" />}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                step === s.num
                  ? "bg-primary text-primary-foreground"
                  : step > s.num
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.num ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span>{s.num}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Select bank account */}
      {step === 1 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Vyberte bankovy ucet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bankovy ucet *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="">-- Vyberte bankovy ucet --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.iban}) {a.bank_name ? `- ${a.bank_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Format banky (volitelne)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={bankPreset}
                onChange={(e) => setBankPreset(e.target.value)}
              >
                <option value="">Automaticka detekcia</option>
                <option value="tatra_banka">Tatra banka</option>
                <option value="vub">VUB</option>
                <option value="slsp">Slovenska sporitelna</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Vyberte banku pre presnejsie mapovanie stlpcov, alebo nechajte automaticku detekciu
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cislo vypisu (volitelne)</Label>
                <Input
                  placeholder="napr. 12/2026"
                  value={statementNumber}
                  onChange={(e) => setStatementNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Datum vypisu (volitelne)</Label>
                <Input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!selectedAccountId}
                onClick={() => setStep(2)}
              >
                Dalej
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload CSV */}
      {step === 2 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Nahrajte CSV subor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedAccount && (
              <div className="rounded-md border p-3 bg-muted/30 text-sm">
                <span className="font-medium">{selectedAccount.name}</span>
                <span className="text-muted-foreground ml-2">{selectedAccount.iban}</span>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelect(f)
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-green-600" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setPreviewTransactions([])
                      setParseErrors([])
                    }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Odstranit
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Pretiahite CSV subor sem</p>
                  <p className="text-sm text-muted-foreground">alebo kliknite pre vyber suboru</p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Spat
              </Button>
              <Button
                disabled={!file || parsing}
                onClick={handlePreview}
              >
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Spracovava sa...
                  </>
                ) : (
                  <>
                    Zobrazit nahlad
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview transactions */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Nahlad transakcii</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {previewTransactions.length} transakcii na import
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Pocet transakcii</p>
                  <p className="text-lg font-bold">{previewTransactions.length}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Celkovy prijem</p>
                  <p className="text-lg font-bold text-green-600">
                    +{formatMoney(totalCredit, selectedAccount?.currency)}
                  </p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Celkovy vydaj</p>
                  <p className="text-lg font-bold text-red-600">
                    -{formatMoney(totalDebit, selectedAccount?.currency)}
                  </p>
                </div>
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      {parseErrors.length} riadkov s chybami (preskocene)
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs text-yellow-700 dark:text-yellow-400">
                    {parseErrors.map((err, idx) => (
                      <p key={idx}>Riadok {err.row}: {err.message}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-9 px-3 text-left font-medium text-xs">#</th>
                      <th className="h-9 px-3 text-left font-medium text-xs">Datum</th>
                      <th className="h-9 px-3 text-right font-medium text-xs">Suma</th>
                      <th className="h-9 px-3 text-left font-medium text-xs">Protiucet</th>
                      <th className="h-9 px-3 text-left font-medium text-xs">VS</th>
                      <th className="h-9 px-3 text-left font-medium text-xs">Popis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTransactions.slice(0, 50).map((tx, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs">{formatDate(tx.date)}</td>
                        <td className={`px-3 py-2 text-right font-medium text-xs ${
                          tx.type === "credit" ? "text-green-600" : "text-red-600"
                        }`}>
                          {tx.amount >= 0 ? "+" : ""}{formatMoney(tx.amount, selectedAccount?.currency)}
                        </td>
                        <td className="px-3 py-2 text-xs max-w-[200px] truncate">
                          {tx.counterparty_name || tx.counterparty_iban || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono">{tx.variable_symbol || "-"}</td>
                        <td className="px-3 py-2 text-xs max-w-[200px] truncate">{tx.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewTransactions.length > 50 && (
                  <div className="text-center py-2 text-xs text-muted-foreground border-t">
                    ... a dalsich {previewTransactions.length - 50} transakcii
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Spat
            </Button>
            <Button
              disabled={importing || previewTransactions.length === 0}
              onClick={handleImport}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importuje sa...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importovat {previewTransactions.length} transakcii
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 4 && importResult && (
        <Card className="max-w-2xl">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            <h2 className="text-2xl font-bold">Import dokonceny</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Uspesne importovanych: <span className="font-bold text-foreground">{importResult.imported_count}</span> transakcii</p>
              <p>Celkovy pocet riadkov v subore: <span className="font-bold text-foreground">{importResult.total_rows}</span></p>
              {importResult.parse_errors.length > 0 && (
                <p className="text-yellow-600">Riadkov s chybami: {importResult.parse_errors.length}</p>
              )}
              {importResult.insert_errors.length > 0 && (
                <p className="text-red-600">Chyby pri ukladani: {importResult.insert_errors.length}</p>
              )}
            </div>

            {(importResult.parse_errors.length > 0 || importResult.insert_errors.length > 0) && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 p-3 text-left max-h-40 overflow-y-auto">
                <div className="text-xs text-yellow-700 dark:text-yellow-400">
                  {importResult.parse_errors.map((err, idx) => (
                    <p key={`p-${idx}`}>Riadok {err.row}: {err.message}</p>
                  ))}
                  {importResult.insert_errors.map((err, idx) => (
                    <p key={`i-${idx}`} className="text-red-600">Chyba ukladania (riadok {err.row}): {err.message}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={() => router.push("/bank/transactions?status=neparovana")}>
                Zobrazit nesparovane transakcie
              </Button>
              <Button variant="outline" onClick={() => router.push("/bank/statements")}>
                Bankove vypisy
              </Button>
              <Button variant="outline" onClick={() => {
                setStep(1)
                setFile(null)
                setPreviewTransactions([])
                setParseErrors([])
                setImportResult(null)
              }}>
                Importovat dalsi vypis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ImportStatementPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <ImportStatementPageContent />
    </Suspense>
  )
}
