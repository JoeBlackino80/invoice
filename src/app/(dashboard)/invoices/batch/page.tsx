"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"

interface BatchInvoiceRow {
  id: string
  contact_name: string
  contact_id: string
  type: string
  issue_date: string
  due_date: string
  currency: string
  items: Array<{
    description: string
    quantity: number
    unit: string
    unit_price: number
    vat_rate: number
  }>
}

interface BatchResult {
  index: number
  success: boolean
  invoice_id?: string
  number?: string
  error?: string
}

function createEmptyRow(): BatchInvoiceRow {
  const today = new Date().toISOString().split("T")[0]
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  return {
    id: crypto.randomUUID(),
    contact_name: "",
    contact_id: "",
    type: "vydana",
    issue_date: today,
    due_date: dueDate,
    currency: "EUR",
    items: [
      { description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 },
    ],
  }
}

export default function BatchInvoicePage() {
  const router = useRouter()
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()

  const [rows, setRows] = useState<BatchInvoiceRow[]>([createEmptyRow()])
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([])
  const [contactsLoaded, setContactsLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<BatchResult[] | null>(null)

  // Load contacts
  const loadContacts = useCallback(async () => {
    if (!activeCompanyId || contactsLoaded) return
    const res = await fetch(`/api/contacts?company_id=${activeCompanyId}&limit=200`)
    if (res.ok) {
      const json = await res.json()
      setContacts(json.data?.map((c: any) => ({ id: c.id, name: c.name })) || [])
      setContactsLoaded(true)
    }
  }, [activeCompanyId, contactsLoaded])

  // Load on first interaction
  if (!contactsLoaded && activeCompanyId) {
    loadContacts()
  }

  const addRow = () => setRows([...rows, createEmptyRow()])

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    setRows(rows.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: keyof BatchInvoiceRow, value: any) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const updateItem = (
    rowId: string,
    itemIdx: number,
    field: string,
    value: any
  ) => {
    setRows(
      rows.map((r) => {
        if (r.id !== rowId) return r
        const newItems = [...r.items]
        newItems[itemIdx] = { ...newItems[itemIdx], [field]: value }
        return { ...r, items: newItems }
      })
    )
  }

  const addItem = (rowId: string) => {
    setRows(
      rows.map((r) => {
        if (r.id !== rowId) return r
        return {
          ...r,
          items: [
            ...r.items,
            { description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 },
          ],
        }
      })
    )
  }

  const removeItem = (rowId: string, itemIdx: number) => {
    setRows(
      rows.map((r) => {
        if (r.id !== rowId || r.items.length <= 1) return r
        return { ...r, items: r.items.filter((_, i) => i !== itemIdx) }
      })
    )
  }

  const handleSubmit = async () => {
    if (!activeCompanyId) return

    setSubmitting(true)
    setResults(null)

    try {
      const invoices = rows.map((r) => ({
        type: r.type,
        contact_id: r.contact_id || undefined,
        customer_name: r.contact_name,
        issue_date: r.issue_date,
        due_date: r.due_date,
        delivery_date: r.issue_date,
        currency: r.currency,
        payment_method: "prevod",
        items: r.items,
      }))

      const res = await fetch("/api/invoices/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompanyId, invoices }),
      })

      const data = await res.json()
      setResults(data.results)

      if (data.success) {
        toast({
          title: "Faktúry vytvorené",
          description: `Úspešne vytvorených ${data.created} faktúr.`,
        })
      } else {
        toast({
          title: "Čiastočný výsledok",
          description: `Vytvorených: ${data.created}, zlyhalo: ${data.failed}`,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa vytvoriť faktúry",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getRowTotal = (row: BatchInvoiceRow) => {
    return row.items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price
      return sum + base + base * (item.vat_rate / 100)
    }, 0)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hromadná fakturácia
          </h1>
          <p className="text-muted-foreground">
            Vytvorte viacero faktúr naraz
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Pridať riadok
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Vytvoriť {rows.length} {rows.length === 1 ? "faktúru" : rows.length < 5 ? "faktúry" : "faktúr"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((row, rowIdx) => {
          const result = results?.[rowIdx]
          const borderClass = result
            ? result.success
              ? "border-green-300 dark:border-green-700"
              : "border-red-300 dark:border-red-700"
            : ""

          return (
            <Card key={row.id} className={borderClass}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Faktúra #{rowIdx + 1}
                    {result && (
                      <span className="ml-2">
                        {result.success ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            {result.number}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {result.error}
                          </span>
                        )}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {getRowTotal(row).toFixed(2)} {row.currency}
                    </span>
                    {rows.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="text-xs text-muted-foreground">Typ</label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-900"
                      value={row.type}
                      onChange={(e) => updateRow(row.id, "type", e.target.value)}
                    >
                      <option value="vydana">Vydaná</option>
                      <option value="prijata">Prijatá</option>
                      <option value="zalohova">Zálohová</option>
                      <option value="proforma">Proforma</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Odberateľ</label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-900"
                      value={row.contact_id}
                      onChange={(e) => {
                        const contact = contacts.find((c) => c.id === e.target.value)
                        updateRow(row.id, "contact_id", e.target.value)
                        if (contact) updateRow(row.id, "contact_name", contact.name)
                      }}
                    >
                      <option value="">-- vyberte --</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Dátum vystavenia</label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={row.issue_date}
                      onChange={(e) => updateRow(row.id, "issue_date", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Dátum splatnosti</label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={row.due_date}
                      onChange={(e) => updateRow(row.id, "due_date", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mena</label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-900"
                      value={row.currency}
                      onChange={(e) => updateRow(row.id, "currency", e.target.value)}
                    >
                      <option value="EUR">EUR</option>
                      <option value="CZK">CZK</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                {/* Items */}
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Položky
                  </div>
                  {row.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="mb-1 grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-4">
                        {itemIdx === 0 && (
                          <label className="text-xs text-muted-foreground">Popis</label>
                        )}
                        <Input
                          placeholder="Popis"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(row.id, itemIdx, "description", e.target.value)
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        {itemIdx === 0 && (
                          <label className="text-xs text-muted-foreground">Množstvo</label>
                        )}
                        <Input
                          type="number"
                          placeholder="Mn."
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(row.id, itemIdx, "quantity", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        {itemIdx === 0 && (
                          <label className="text-xs text-muted-foreground">Cena/j.</label>
                        )}
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Cena"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(row.id, itemIdx, "unit_price", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        {itemIdx === 0 && (
                          <label className="text-xs text-muted-foreground">DPH %</label>
                        )}
                        <select
                          className="w-full rounded-md border px-3 py-2 text-sm dark:bg-gray-900"
                          value={item.vat_rate}
                          onChange={(e) =>
                            updateItem(row.id, itemIdx, "vat_rate", Number(e.target.value))
                          }
                        >
                          <option value={23}>23%</option>
                          <option value={19}>19%</option>
                          <option value={5}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9"
                          onClick={() => addItem(row.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {row.items.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9"
                            onClick={() => removeItem(row.id, itemIdx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Celkom: {rows.length} {rows.length === 1 ? "faktúra" : rows.length < 5 ? "faktúry" : "faktúr"}
            </div>
            <div className="text-lg font-bold">
              {rows
                .reduce((sum, r) => sum + getRowTotal(r), 0)
                .toFixed(2)}{" "}
              EUR
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
