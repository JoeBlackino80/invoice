"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCompany } from "@/hooks/use-company"
import { contactSchema, type ContactInput } from "@/lib/validations/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface ContactFormProps {
  contact?: any
  mode: "create" | "edit"
}

export function ContactForm({ contact, mode }: ContactFormProps) {
  const [loading, setLoading] = useState(false)
  const [icoLoading, setIcoLoading] = useState(false)
  const [viesResult, setViesResult] = useState<{ valid: boolean; message?: string } | null>(null)
  const [insolvencyWarning, setInsolvencyWarning] = useState<string | null>(null)
  const [vatWarning, setVatWarning] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { activeCompanyId } = useCompany()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          type: contact.type,
          name: contact.name,
          ico: contact.ico || "",
          dic: contact.dic || "",
          ic_dph: contact.ic_dph || "",
          street: contact.street || "",
          city: contact.city || "",
          zip: contact.zip || "",
          country: contact.country || "SK",
          email: contact.email || "",
          phone: contact.phone || "",
          web: contact.web || "",
          notes: contact.notes || "",
          tags: contact.tags || [],
        }
      : {
          type: "odberatel",
          country: "SK",
          tags: [],
        },
  })

  const ico = watch("ico")
  const icDph = watch("ic_dph")

  const checkInsolvency = async (icoValue: string) => {
    try {
      const res = await fetch(`/api/lookup/insolvency?ico=${icoValue}`)
      const data = await res.json()
      if (data.is_insolvent) {
        setInsolvencyWarning(data.details || "Subjekt je evidovaný v Registri úpadcov")
      } else {
        setInsolvencyWarning(null)
      }
    } catch {
      // Silently fail - not critical
    }
  }

  const checkVatStatus = async (icDphValue: string) => {
    if (!icDphValue || icDphValue.length < 4) return
    try {
      const res = await fetch(`/api/lookup/vat-status?ic_dph=${icDphValue}`)
      const data = await res.json()
      if (data.is_active === false) {
        setVatWarning("IČ DPH nie je aktívne podľa systému VIES")
      } else {
        setVatWarning(null)
      }
    } catch {
      // Silently fail - not critical
    }
  }

  const lookupICO = async () => {
    if (!ico || ico.length < 6) {
      toast({ variant: "destructive", title: "IČO musí mať aspoň 6 číslic" })
      return
    }
    setIcoLoading(true)
    try {
      const res = await fetch(`/api/lookup/ico?ico=${ico}`)
      const data = await res.json()
      if (data.name) {
        setValue("name", data.name)
        if (data.dic) setValue("dic", data.dic)
        if (data.ic_dph) setValue("ic_dph", data.ic_dph)
        if (data.street) setValue("street", data.street)
        if (data.city) setValue("city", data.city)
        if (data.zip) setValue("zip", data.zip)
        toast({
          title: "Údaje doplnené z registra",
          description: `Firma: ${data.name}`,
          className: "border-green-500 bg-green-50 dark:bg-green-950",
        })
        // Trigger insolvency check in background
        checkInsolvency(ico)
        // If IČ DPH was set, check VAT status
        if (data.ic_dph) {
          checkVatStatus(data.ic_dph)
        }
      } else {
        toast({ variant: "destructive", title: "Firma nenájdená", description: data.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba pri vyhľadávaní" })
    } finally {
      setIcoLoading(false)
    }
  }

  const verifyVIES = async () => {
    if (!icDph || icDph.length < 4) {
      toast({ variant: "destructive", title: "Zadajte IČ DPH" })
      return
    }
    try {
      const res = await fetch(`/api/lookup/vies?vat_number=${icDph}`)
      const data = await res.json()
      setViesResult({ valid: data.valid })
      if (data.valid) {
        toast({ title: "IČ DPH platné", description: data.name || "" })
        if (data.name && !watch("name")) {
          setValue("name", data.name)
        }
        setVatWarning(null)
      } else {
        toast({ variant: "destructive", title: "IČ DPH neplatné" })
        setVatWarning("IČ DPH nie je aktívne podľa systému VIES")
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba pri overovaní VIES" })
    }
    // Also trigger background VAT status check
    checkVatStatus(icDph)
  }

  const onSubmit = async (data: ContactInput) => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/contacts" : `/api/contacts/${contact.id}`
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
        title: mode === "create" ? "Kontakt vytvorený" : "Kontakt aktualizovaný",
      })
      router.push("/contacts")
      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Upozornenia - insolvencia a DPH */}
      {insolvencyWarning && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium">Upozornenie - Insolvenčný register</p>
            <p>{insolvencyWarning}</p>
          </div>
        </div>
      )}
      {vatWarning && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="font-medium">Upozornenie - DPH status</p>
            <p>{vatWarning}</p>
          </div>
        </div>
      )}

      {/* Základné údaje */}
      <Card>
        <CardHeader>
          <CardTitle>Základné údaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Typ kontaktu</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register("type")}
            >
              <option value="odberatel">Odberateľ</option>
              <option value="dodavatel">Dodávateľ</option>
              <option value="oba">Odberateľ aj dodávateľ</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ico">IČO</Label>
            <div className="flex gap-2">
              <Input id="ico" placeholder="12345678" maxLength={8} {...register("ico")} />
              <Button type="button" variant="outline" onClick={lookupICO} disabled={icoLoading}>
                {icoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Doplniť</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Názov firmy / Meno *</Label>
            <Input id="name" placeholder="Firma s.r.o." {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dic">DIČ</Label>
              <Input id="dic" placeholder="1234567890" {...register("dic")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ic_dph">IČ DPH</Label>
              <div className="flex gap-2">
                <Input id="ic_dph" placeholder="SK1234567890" {...register("ic_dph")} />
                <Button type="button" variant="outline" size="icon" onClick={verifyVIES} title="Overiť cez VIES">
                  {viesResult?.valid === true ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : viesResult?.valid === false ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adresa */}
      <Card>
        <CardHeader>
          <CardTitle>Adresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Ulica a číslo</Label>
            <Input id="street" placeholder="Hlavná 1" {...register("street")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Mesto</Label>
              <Input id="city" placeholder="Bratislava" {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">PSČ</Label>
              <Input id="zip" placeholder="811 01" {...register("zip")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Krajina</Label>
            <Input id="country" placeholder="SK" maxLength={2} {...register("country")} />
          </div>
        </CardContent>
      </Card>

      {/* Kontaktné údaje */}
      <Card>
        <CardHeader>
          <CardTitle>Kontaktné údaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="info@firma.sk" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefón</Label>
              <Input id="phone" placeholder="+421 900 000 000" {...register("phone")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="web">Web</Label>
            <Input id="web" placeholder="https://www.firma.sk" {...register("web")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Poznámky</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Interné poznámky..."
              {...register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tlačidlá */}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Vytvoriť kontakt" : "Uložiť zmeny"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/contacts")}>
          Zrušiť
        </Button>
      </div>
    </form>
  )
}
