"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  RotateCcw,
  FileText,
  Plus,
  Trash2,
} from "lucide-react"

interface OcrItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number
}

interface OcrData {
  supplier_name: string
  supplier_ico: string
  supplier_dic: string
  supplier_ic_dph: string
  supplier_street: string
  supplier_city: string
  supplier_zip: string
  supplier_iban: string
  document_number: string
  document_type: string
  issue_date: string
  delivery_date: string
  due_date: string
  variable_symbol: string
  currency: string
  items: OcrItem[]
  subtotal: number
  vat_amount: number
  total: number
  confidence?: Record<string, number>
}

interface DocumentDetail {
  id: string
  name: string
  mime_type: string
  file_url: string
  ocr_status: string
  ocr_data: OcrData | null
}

function ConfidenceBadge({ field, confidence }: { field: string; confidence?: Record<string, number> }) {
  if (!confidence || confidence[field] === undefined) return null
  const value = confidence[field]
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
  if (value >= 0.8) {
    colorClass = "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
  } else if (value >= 0.5) {
    colorClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
  }
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ml-2 ${colorClass}`}>
      {Math.round(value * 100)}%
    </span>
  )
}

const emptyOcrData: OcrData = {
  supplier_name: "",
  supplier_ico: "",
  supplier_dic: "",
  supplier_ic_dph: "",
  supplier_street: "",
  supplier_city: "",
  supplier_zip: "",
  supplier_iban: "",
  document_number: "",
  document_type: "prijata",
  issue_date: "",
  delivery_date: "",
  due_date: "",
  variable_symbol: "",
  currency: "EUR",
  items: [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 20 }],
  subtotal: 0,
  vat_amount: 0,
  total: 0,
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState<OcrData>(emptyOcrData)

  const documentId = params.id as string

  const fetchDocument = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      if (!res.ok) throw new Error("Dokument sa nepodarilo nacitat")
      const json = await res.json()
      setDocument(json)
      if (json.ocr_data) {
        setFormData({
          ...emptyOcrData,
          ...json.ocr_data,
          items: json.ocr_data.items?.length > 0
            ? json.ocr_data.items
            : [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 20 }],
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat dokument" })
    } finally {
      setLoading(false)
    }
  }, [documentId, toast])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handleReprocessOcr = async () => {
    setOcrProcessing(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/ocr`, { method: "POST" })
      if (res.ok) {
        toast({ title: "OCR spustene", description: "Dokument sa znovu spracovava..." })
        // Poll for completion
        setTimeout(() => fetchDocument(), 3000)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa spustit OCR" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa spustit OCR" })
    } finally {
      setOcrProcessing(false)
    }
  }

  const handleCreateInvoice = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: "Faktura vytvorena" })
        router.push(`/invoices/${data.id}/edit`)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit fakturu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit fakturu" })
    } finally {
      setCreating(false)
    }
  }

  const updateField = (field: keyof OcrData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateItem = (index: number, field: keyof OcrItem, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 20 }],
    }))
  }

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div>
        <Breadcrumb />
        <div className="flex flex-col items-center justify-center h-64 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Dokument nebol najdeny</p>
        </div>
      </div>
    )
  }

  const confidence = formData.confidence

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{document.name}</h1>
          <p className="text-muted-foreground">OCR spracovanie dokumentu</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReprocessOcr} disabled={ocrProcessing}>
            {ocrProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Znovu spracovat OCR
          </Button>
          <Button onClick={handleCreateInvoice} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Vytvorit fakturu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LAVA STRANA - Nahladka dokumentu */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Nahladka dokumentu</CardTitle>
            </CardHeader>
            <CardContent>
              {document.mime_type === "application/pdf" ? (
                <iframe
                  src={document.file_url}
                  className="w-full h-[700px] rounded border"
                  title="Nahladka PDF"
                />
              ) : (
                <img
                  src={document.file_url}
                  alt={document.name}
                  className="w-full h-auto rounded border"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* PRAVA STRANA - Extrahovane OCR udaje */}
        <div className="space-y-6">
          {/* Dodavatel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dodavatel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier_name">
                    Nazov
                    <ConfidenceBadge field="supplier_name" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_name"
                    value={formData.supplier_name}
                    onChange={(e) => updateField("supplier_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_ico">
                    ICO
                    <ConfidenceBadge field="supplier_ico" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_ico"
                    value={formData.supplier_ico}
                    onChange={(e) => updateField("supplier_ico", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_dic">
                    DIC
                    <ConfidenceBadge field="supplier_dic" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_dic"
                    value={formData.supplier_dic}
                    onChange={(e) => updateField("supplier_dic", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_ic_dph">
                    IC DPH
                    <ConfidenceBadge field="supplier_ic_dph" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_ic_dph"
                    value={formData.supplier_ic_dph}
                    onChange={(e) => updateField("supplier_ic_dph", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_street">
                    Ulica
                    <ConfidenceBadge field="supplier_street" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_street"
                    value={formData.supplier_street}
                    onChange={(e) => updateField("supplier_street", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_city">
                    Mesto
                    <ConfidenceBadge field="supplier_city" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_city"
                    value={formData.supplier_city}
                    onChange={(e) => updateField("supplier_city", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_zip">
                    PSC
                    <ConfidenceBadge field="supplier_zip" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_zip"
                    value={formData.supplier_zip}
                    onChange={(e) => updateField("supplier_zip", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_iban">
                    IBAN
                    <ConfidenceBadge field="supplier_iban" confidence={confidence} />
                  </Label>
                  <Input
                    id="supplier_iban"
                    value={formData.supplier_iban}
                    onChange={(e) => updateField("supplier_iban", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Doklad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Doklad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="document_number">
                    Cislo dokladu
                    <ConfidenceBadge field="document_number" confidence={confidence} />
                  </Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => updateField("document_number", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="document_type">
                    Typ dokladu
                    <ConfidenceBadge field="document_type" confidence={confidence} />
                  </Label>
                  <select
                    id="document_type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.document_type}
                    onChange={(e) => updateField("document_type", e.target.value)}
                  >
                    <option value="prijata">Prijata faktura</option>
                    <option value="vydana">Vydana faktura</option>
                    <option value="zalohova">Zalohova faktura</option>
                    <option value="dobropis">Dobropis</option>
                    <option value="proforma">Proforma</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="issue_date">
                    Datum vystavenia
                    <ConfidenceBadge field="issue_date" confidence={confidence} />
                  </Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => updateField("issue_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_date">
                    Datum dodania
                    <ConfidenceBadge field="delivery_date" confidence={confidence} />
                  </Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => updateField("delivery_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="due_date">
                    Datum splatnosti
                    <ConfidenceBadge field="due_date" confidence={confidence} />
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => updateField("due_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="variable_symbol">
                    Variabilny symbol
                    <ConfidenceBadge field="variable_symbol" confidence={confidence} />
                  </Label>
                  <Input
                    id="variable_symbol"
                    value={formData.variable_symbol}
                    onChange={(e) => updateField("variable_symbol", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">
                    Mena
                    <ConfidenceBadge field="currency" confidence={confidence} />
                  </Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => updateField("currency", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Polozky */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Polozky</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-4 w-4" />
                Pridat polozku
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-9 px-2 text-left font-medium">Popis</th>
                      <th className="h-9 px-2 text-left font-medium w-20">Mnozstvo</th>
                      <th className="h-9 px-2 text-left font-medium w-20">Jednotka</th>
                      <th className="h-9 px-2 text-left font-medium w-28">Cena/j.</th>
                      <th className="h-9 px-2 text-left font-medium w-20">DPH %</th>
                      <th className="h-9 px-2 text-right font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => updateItem(index, "unit", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.vat_rate}
                            onChange={(e) => updateItem(index, "vat_rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formData.items.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Sumy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sumy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="subtotal">
                    Zaklad
                    <ConfidenceBadge field="subtotal" confidence={confidence} />
                  </Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={formData.subtotal}
                    onChange={(e) => updateField("subtotal", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="vat_amount">
                    DPH
                    <ConfidenceBadge field="vat_amount" confidence={confidence} />
                  </Label>
                  <Input
                    id="vat_amount"
                    type="number"
                    step="0.01"
                    value={formData.vat_amount}
                    onChange={(e) => updateField("vat_amount", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="total">
                    Celkom
                    <ConfidenceBadge field="total" confidence={confidence} />
                  </Label>
                  <Input
                    id="total"
                    type="number"
                    step="0.01"
                    value={formData.total}
                    onChange={(e) => updateField("total", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
