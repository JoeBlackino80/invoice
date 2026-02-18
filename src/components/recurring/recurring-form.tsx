"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCompany } from "@/hooks/use-company"
import { createClient } from "@/lib/supabase/client"
import { recurringInvoiceSchema, type RecurringInvoiceInput } from "@/lib/validations/recurring-invoice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { format, addMonths } from "date-fns"

interface RecurringFormProps {
  recurring?: any
  mode: "create" | "edit"
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

export function RecurringForm({ recurring, mode }: RecurringFormProps) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const router = useRouter()
  const { toast } = useToast()
  const { activeCompanyId } = useCompany()
  const supabase = createClient()

  const nextMonth = format(addMonths(new Date(), 1), "yyyy-MM-dd")

  // Parse items from existing recurring invoice
  const parseExistingItems = (rec: any) => {
    if (!rec) return [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 }]
    let items = rec.items
    if (typeof items === "string") {
      try { items = JSON.parse(items) } catch { items = [] }
    }
    if (!Array.isArray(items) || items.length === 0) {
      return [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 }]
    }
    return items.map((item: any) => ({
      description: item.description || "",
      quantity: item.quantity || 1,
      unit: item.unit || "ks",
      unit_price: item.unit_price || 0,
      vat_rate: item.vat_rate || 23,
    }))
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<RecurringInvoiceInput>({
    resolver: zodResolver(recurringInvoiceSchema),
    defaultValues: recurring
      ? {
          type: recurring.type || "vydana",
          contact_id: recurring.contact_id || "",
          interval: recurring.interval || "monthly",
          next_generation_date: recurring.next_generation_date || nextMonth,
          currency: recurring.currency || "EUR",
          exchange_rate: recurring.exchange_rate || 1,
          variable_symbol: recurring.variable_symbol || "",
          reverse_charge: recurring.reverse_charge || false,
          notes: recurring.notes || "",
          is_active: recurring.is_active !== undefined ? recurring.is_active : true,
          items: parseExistingItems(recurring),
        }
      : {
          type: "vydana",
          interval: "monthly",
          next_generation_date: nextMonth,
          currency: "EUR",
          exchange_rate: 1,
          reverse_charge: false,
          is_active: true,
          items: [{ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 }],
        },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const watchItems = watch("items")

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

  // Načítať kontakty
  useEffect(() => {
    if (!activeCompanyId) return
    const fetchContacts = async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, ico, dic, ic_dph, street, city, zip, country")
        .eq("company_id", activeCompanyId)
        .is("deleted_at", null)
        .order("name") as { data: Contact[] | null }
      setContacts(data || [])
    }
    fetchContacts()
  }, [activeCompanyId, supabase])

  const onSubmit = async (data: RecurringInvoiceInput) => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const url = mode === "create"
        ? "/api/recurring-invoices"
        : `/api/recurring-invoices/${recurring.id}`
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
        title: mode === "create" ? "Opakovaná faktúra vytvorená" : "Opakovaná faktúra aktualizovaná",
      })
      router.push("/recurring")
      router.refresh()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interval opakovania</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("interval")}
                >
                  <option value="monthly">Mesačne</option>
                  <option value="quarterly">Štvrťročne</option>
                  <option value="annually">Ročne</option>
                </select>
                {errors.interval && <p className="text-sm text-destructive">{errors.interval.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Dátum ďalšieho generovania</Label>
                <Input type="date" {...register("next_generation_date")} />
                {errors.next_generation_date && <p className="text-sm text-destructive">{errors.next_generation_date.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mena</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("currency")}
                >
                  <option value="EUR">EUR</option>
                  <option value="CZK">CZK</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Kurz</Label>
                <Input
                  type="number"
                  step="0.0001"
                  {...register("exchange_rate", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Variabilný symbol</Label>
                <Input maxLength={10} {...register("variable_symbol")} />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reverse_charge"
                  {...register("reverse_charge")}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="reverse_charge">Prenesenie daňovej povinnosti</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register("is_active")}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_active">Aktívna</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Súhrn */}
        <Card>
          <CardHeader>
            <CardTitle>Súhrn šablóny</CardTitle>
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

            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground space-y-1">
              <p>Táto suma sa bude opakovať podľa zvoleného intervalu.</p>
              {mode === "edit" && recurring?.last_generation_date && (
                <p>Posledné generovanie: {new Date(recurring.last_generation_date).toLocaleDateString("sk-SK")}</p>
              )}
            </div>
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
        <CardContent>
          <div className="space-y-2">
            <Label>Poznámka na faktúre</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Zobrazí sa na vygenerovanej faktúre..."
              {...register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tlačidlá */}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Vytvoriť opakovanú faktúru" : "Uložiť zmeny"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/recurring")}>
          Zrušiť
        </Button>
      </div>
    </form>
  )
}
