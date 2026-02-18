"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCompany } from "@/hooks/use-company"
import { createClient } from "@/lib/supabase/client"
import { quoteSchema, type QuoteInput } from "@/lib/validations/quote"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { addDays, format } from "date-fns"

interface QuoteFormProps {
  quote?: any
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

export function QuoteForm({ quote, mode }: QuoteFormProps) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const router = useRouter()
  const { toast } = useToast()
  const { activeCompanyId } = useCompany()
  const supabase = createClient()

  const today = format(new Date(), "yyyy-MM-dd")
  const defaultValidUntil = format(addDays(new Date(), 30), "yyyy-MM-dd")

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: quote
      ? {
          contact_id: quote.contact_id || "",
          issue_date: quote.issue_date,
          valid_until: quote.valid_until,
          currency: quote.currency || "EUR",
          notes: quote.notes || "",
          items: (quote.items || []).map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
          })),
        }
      : {
          issue_date: today,
          valid_until: defaultValidUntil,
          currency: "EUR",
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

  const onSubmit = async (data: QuoteInput) => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/quotes" : `/api/quotes/${quote.id}`
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
        title: mode === "create" ? "Cenová ponuka vytvorená" : "Cenová ponuka aktualizovaná",
      })
      router.push("/quotes")
      router.refresh()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const isReadOnly = quote?.status === "converted"

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
                <Label>Kontakt</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("contact_id")}
                  disabled={isReadOnly}
                >
                  <option value="">-- Vyberte kontakt --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.ico ? `(${c.ico})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Mena</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("currency")}
                  disabled={isReadOnly}
                >
                  <option value="EUR">EUR</option>
                  <option value="CZK">CZK</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dátum vystavenia</Label>
                <Input type="date" {...register("issue_date")} disabled={isReadOnly} />
                {errors.issue_date && <p className="text-sm text-destructive">{errors.issue_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Platnosť do</Label>
                <Input type="date" {...register("valid_until")} disabled={isReadOnly} />
                {errors.valid_until && <p className="text-sm text-destructive">{errors.valid_until.message}</p>}
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
          </CardContent>
        </Card>
      </div>

      {/* Položky */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Položky</CardTitle>
          {!isReadOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", quantity: 1, unit: "ks", unit_price: 0, vat_rate: 23 })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Pridať položku
            </Button>
          )}
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
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          className="h-9 text-center"
                          {...register(`items.${index}.unit`)}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          {...register(`items.${index}.vat_rate`, { valueAsNumber: true })}
                          disabled={isReadOnly}
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
                        {fields.length > 1 && !isReadOnly && (
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
            <Label>Poznámka na ponuke</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Zobrazí sa na cenovej ponuke..."
              {...register("notes")}
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tlačidlá */}
      {!isReadOnly && (
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Vytvoriť ponuku" : "Uložiť zmeny"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/quotes")}>
            Zrušiť
          </Button>
        </div>
      )}
    </form>
  )
}
