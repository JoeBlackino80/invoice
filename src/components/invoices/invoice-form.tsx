"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCompany } from "@/hooks/use-company"
import { invoiceSchema, type InvoiceInput } from "@/lib/validations/invoice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, FileDown } from "lucide-react"
import { addDays, format } from "date-fns"

interface InvoiceFormProps {
  invoice?: any
  items?: any[]
  mode: "create" | "edit"
  defaultType?: string
  parentInvoice?: any
}

interface Contact {
  id: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  zip: string | null
  country: string
}

export function InvoiceForm({ invoice, items: existingItems, mode, defaultType, parentInvoice }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { activeCompanyId, activeCompany } = useCompany()

  const today = format(new Date(), "yyyy-MM-dd")
  const defaultDue = format(addDays(new Date(), 14), "yyyy-MM-dd")

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: invoice
      ? {
          type: invoice.type,
          contact_id: invoice.contact_id || "",
          issue_date: invoice.issue_date,
          delivery_date: invoice.delivery_date,
          due_date: invoice.due_date,
          currency: invoice.currency || "EUR",
          exchange_rate: invoice.exchange_rate || 1,
          variable_symbol: invoice.variable_symbol || "",
          constant_symbol: invoice.constant_symbol || "",
          specific_symbol: invoice.specific_symbol || "",
          reverse_charge: invoice.reverse_charge || false,
          notes: invoice.notes || "",
          internal_notes: invoice.internal_notes || "",
          items: existingItems?.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
          })) || [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 }],
        }
      : {
          type: (defaultType as any) || "vydana",
          issue_date: today,
          delivery_date: today,
          due_date: defaultDue,
          currency: "EUR",
          exchange_rate: 1,
          reverse_charge: false,
          items: [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 }],
        },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const watchItems = watch("items")
  const watchType = watch("type")

  // Výpočet súm
  const calculateItem = (item: any) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    const vatRate = Number(item.vat_rate) || 0
    const subtotal = Math.round(qty * price * 100) / 100
    const vat = Math.round(subtotal * vatRate / 100 * 100) / 100
    return { subtotal, vat, total: subtotal + vat }
  }

  const totals = (watchItems || []).reduce(
    (acc, item) => {
      const calc = calculateItem(item)
      return {
        subtotal: acc.subtotal + calc.subtotal,
        vat: acc.vat + calc.vat,
        total: acc.total + calc.total,
      }
    },
    { subtotal: 0, vat: 0, total: 0 }
  )

  // Načítať kontakty cez API
  useEffect(() => {
    if (!activeCompanyId) return
    const fetchContacts = async () => {
      try {
        const res = await fetch(`/api/contacts?company_id=${activeCompanyId}&limit=1000`)
        const json = await res.json()
        if (res.ok) {
          setContacts(json.data || [])
        }
      } catch {
        // silent - contacts list will be empty
      }
    }
    fetchContacts()
  }, [activeCompanyId])

  // Načítať ďalšie číslo faktúry (len v režime vytvárania)
  const fetchNextNumber = useCallback(async (type: string) => {
    if (!activeCompanyId || mode !== "create") return
    try {
      const res = await fetch(`/api/invoices/next-number?company_id=${activeCompanyId}&type=${type}`)
      const json = await res.json()
      if (res.ok) {
        setInvoiceNumber(json.number)
      } else {
        setInvoiceNumber(null)
      }
    } catch {
      setInvoiceNumber(null)
    }
  }, [activeCompanyId, mode])

  // Načítať číslo pri prvom renderovaní a pri zmene typu
  useEffect(() => {
    if (watchType) {
      fetchNextNumber(watchType)
    }
  }, [watchType, fetchNextNumber])

  const onSubmit = async (data: InvoiceInput) => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/invoices" : `/api/invoices/${invoice.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          company_id: activeCompanyId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Chyba pri ukladaní")
      }

      toast({
        title: mode === "create" ? "Faktúra vytvorená" : "Faktúra aktualizovaná",
      })
      router.push("/invoices")
      router.refresh()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Číslo faktúry */}
      {mode === "create" && invoiceNumber && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Číslo faktúry:</span>
          <Badge variant="secondary" className="text-base font-mono px-3 py-1">
            {invoiceNumber}
          </Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Základné údaje */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Základné údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Typ faktúry</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("type")}
                >
                  <option value="vydana">Vydaná faktúra</option>
                  <option value="prijata">Prijatá faktúra</option>
                  <option value="zalohova">Zálohová faktúra</option>
                  <option value="dobropis">Dobropis</option>
                  <option value="proforma">Proforma</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Odberateľ / Dodávateľ</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("contact_id")}
                >
                  <option value="">-- Vyberte kontakt --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.ico ? `(${c.ico})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {parentInvoice && (
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Väzba na doklad: </span>
                  <span className="font-medium font-mono">{parentInvoice.number}</span>
                </p>
                <input type="hidden" {...register("parent_invoice_id")} value={parentInvoice.id} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Dátum vystavenia</Label>
                <Input type="date" {...register("issue_date")} />
                {errors.issue_date && <p className="text-sm text-destructive">{errors.issue_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Dátum dodania</Label>
                <Input type="date" {...register("delivery_date")} />
              </div>
              <div className="space-y-2">
                <Label>Dátum splatnosti</Label>
                <Input type="date" {...register("due_date")} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Variabilný symbol</Label>
                <Input maxLength={10} {...register("variable_symbol")} />
              </div>
              <div className="space-y-2">
                <Label>Konštantný symbol</Label>
                <Input maxLength={4} {...register("constant_symbol")} />
              </div>
              <div className="space-y-2">
                <Label>Špecifický symbol</Label>
                <Input maxLength={10} {...register("specific_symbol")} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="reverse_charge" {...register("reverse_charge")} className="h-4 w-4 rounded border-input" />
                <Label htmlFor="reverse_charge">Prenesenie daňovej povinnosti</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Súhrn */}
        <Card>
          <CardHeader>
            <CardTitle>Súhrn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Základ dane:</span>
              <span className="font-mono">{totals.subtotal.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">DPH:</span>
              <span className="font-mono">{totals.vat.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <span>Celkom:</span>
              <span className="text-primary font-mono">{totals.total.toFixed(2)} EUR</span>
            </div>

            {mode === "edit" && invoice?.id && (
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                className="inline-flex items-center gap-2 mt-4"
              >
                <Button type="button" variant="outline" className="w-full">
                  <FileDown className="mr-2 h-4 w-4" />
                  Stiahnuť PDF
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Položky faktúry */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Položky</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 })}
          >
            <Plus className="mr-1 h-4 w-4" />
            Pridať položku
          </Button>
        </CardHeader>
        <CardContent>
          {errors.items && typeof errors.items === "object" && "message" in errors.items && (
            <p className="text-sm text-destructive mb-4">{errors.items.message as string}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-8 px-2 text-left font-medium w-[35%]">Popis</th>
                  <th className="h-8 px-2 text-right font-medium w-[10%]">Množstvo</th>
                  <th className="h-8 px-2 text-center font-medium w-[8%]">MJ</th>
                  <th className="h-8 px-2 text-right font-medium w-[15%]">Cena/MJ</th>
                  <th className="h-8 px-2 text-right font-medium w-[8%]">DPH %</th>
                  <th className="h-8 px-2 text-right font-medium w-[12%]">Základ</th>
                  <th className="h-8 px-2 text-right font-medium w-[12%]">Celkom</th>
                  <th className="h-8 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const item = watchItems?.[index]
                  const calc = item ? calculateItem(item) : { subtotal: 0, total: 0 }
                  return (
                    <tr key={field.id} className="border-b">
                      <td className="px-1 py-2">
                        <Input
                          placeholder="Popis položky"
                          className="h-9"
                          {...register(`items.${index}.description`)}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          className="h-9 text-center"
                          {...register(`items.${index}.unit`)}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          {...register(`items.${index}.vat_rate`, { valueAsNumber: true })}
                        >
                          <option value={23}>23%</option>
                          <option value={19}>19%</option>
                          <option value={5}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-muted-foreground">
                        {calc.subtotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-medium">
                        {calc.total.toFixed(2)}
                      </td>
                      <td className="px-1 py-2">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Poznámky */}
      <Card>
        <CardHeader>
          <CardTitle>Poznámky</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Poznámka na faktúre</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Zobrazí sa na faktúre..."
                {...register("notes")}
              />
            </div>
            <div className="space-y-2">
              <Label>Interná poznámka</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Len pre interné účely..."
                {...register("internal_notes")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tlačidlá */}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Vytvoriť faktúru" : "Uložiť zmeny"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/invoices")}>
          Zrušiť
        </Button>
      </div>
    </form>
  )
}
