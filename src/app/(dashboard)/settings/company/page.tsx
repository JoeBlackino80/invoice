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
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

export default function CompanySettingsPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)

  const [form, setForm] = useState({
    name: "",
    ico: "",
    dic: "",
    ic_dph: "",
    business_type: "sro",
    accounting_type: "podvojne",
    street: "",
    city: "",
    zip: "",
    country: "SK",
    is_vat_payer: false,
    vat_period: "" as string,
    bank_account_iban: "",
    bank_bic: "",
    email: "",
    phone: "",
    web: "",
    logo_url: "",
    stamp_url: "",
    signature_url: "",
  })

  const fetchCompany = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/company?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        setForm({
          name: data.name || "",
          ico: data.ico || "",
          dic: data.dic || "",
          ic_dph: data.ic_dph || "",
          business_type: data.business_type || "sro",
          accounting_type: data.accounting_type || "podvojne",
          street: data.street || "",
          city: data.city || "",
          zip: data.zip || "",
          country: data.country || "SK",
          is_vat_payer: data.is_vat_payer || false,
          vat_period: data.vat_period || "",
          bank_account_iban: data.iban || "",
          bank_bic: data.bic || "",
          email: data.email || "",
          phone: data.phone || "",
          web: data.web || "",
          logo_url: data.logo_url || "",
          stamp_url: data.stamp_url || "",
          signature_url: data.signature_url || "",
        })
      }
    } catch {
      toast({ title: "Chyba pri nacitani dat", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  const handleSave = async () => {
    if (!activeCompanyId) return
    setSaving(true)
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          name: form.name,
          ico: form.ico,
          dic: form.dic,
          ic_dph: form.ic_dph,
          address: {
            street: form.street,
            city: form.city,
            zip: form.zip,
            country: form.country,
          },
          business_type: form.business_type,
          accounting_type: form.accounting_type,
          is_vat_payer: form.is_vat_payer,
          vat_period: form.vat_period || null,
          bank_account_iban: form.bank_account_iban,
          bank_bic: form.bank_bic,
          email: form.email,
          phone: form.phone,
          web: form.web,
          logo_url: form.logo_url,
          stamp_url: form.stamp_url,
          signature_url: form.signature_url,
        }),
      })
      if (res.ok) {
        toast({ title: "Nastavenia boli ulozene" })
      } else {
        const err = await res.json()
        toast({ title: "Chyba pri ukladani", description: err.error?.toString(), variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri ukladani", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeCompanyId) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("company_id", activeCompanyId)
      formData.append("type", "logo")

      const res = await fetch("/api/settings/company", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setForm((prev) => ({ ...prev, logo_url: data.logo_url }))
        toast({ title: "Logo bolo nahrane" })
      } else {
        toast({ title: "Chyba pri nahravani loga", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri nahravani loga", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeCompanyId) return

    setUploadingStamp(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("company_id", activeCompanyId)
      formData.append("type", "stamp")

      const res = await fetch("/api/settings/company", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setForm((prev) => ({ ...prev, stamp_url: data.stamp_url }))
        toast({ title: "Peciatka bola nahrana" })
      } else {
        toast({ title: "Chyba pri nahravani peciatky", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri nahravani peciatky", variant: "destructive" })
    } finally {
      setUploadingStamp(false)
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeCompanyId) return

    setUploadingSignature(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("company_id", activeCompanyId)
      formData.append("type", "signature")

      const res = await fetch("/api/settings/company", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setForm((prev) => ({ ...prev, signature_url: data.signature_url }))
        toast({ title: "Podpis bol nahrany" })
      } else {
        toast({ title: "Chyba pri nahravani podpisu", variant: "destructive" })
      }
    } catch {
      toast({ title: "Chyba pri nahravani podpisu", variant: "destructive" })
    } finally {
      setUploadingSignature(false)
    }
  }

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nastavenia firmy</h1>
        <p className="text-muted-foreground">
          Zakladne udaje, adresa, danove a bankove informacie
        </p>
      </div>

      {/* Zakladne udaje */}
      <Card>
        <CardHeader>
          <CardTitle>Zakladne udaje</CardTitle>
          <CardDescription>Obchodne meno a identifikacne cisla</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nazov firmy *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Nazov s.r.o."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_type">Typ podnikania</Label>
              <Select
                value={form.business_type}
                onValueChange={(v) => updateField("business_type", v)}
              >
                <SelectTrigger id="business_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sro">s.r.o.</SelectItem>
                  <SelectItem value="as">a.s.</SelectItem>
                  <SelectItem value="szco">SZCO</SelectItem>
                  <SelectItem value="druzstvo">Druzstvo</SelectItem>
                  <SelectItem value="ine">Ine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ico">ICO</Label>
              <Input
                id="ico"
                value={form.ico}
                onChange={(e) => updateField("ico", e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dic">DIC</Label>
              <Input
                id="dic"
                value={form.dic}
                onChange={(e) => updateField("dic", e.target.value)}
                placeholder="2012345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ic_dph">IC DPH</Label>
              <Input
                id="ic_dph"
                value={form.ic_dph}
                onChange={(e) => updateField("ic_dph", e.target.value)}
                placeholder="SK2012345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accounting_type">Typ uctovnictva</Label>
            <Select
              value={form.accounting_type}
              onValueChange={(v) => updateField("accounting_type", v)}
            >
              <SelectTrigger id="accounting_type" className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="podvojne">Podvojne uctovnictvo</SelectItem>
                <SelectItem value="jednoduche">Jednoduche uctovnictvo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Adresa */}
      <Card>
        <CardHeader>
          <CardTitle>Adresa</CardTitle>
          <CardDescription>Sidlo firmy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Ulica a cislo</Label>
            <Input
              id="street"
              value={form.street}
              onChange={(e) => updateField("street", e.target.value)}
              placeholder="Hlavna 1"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">Mesto</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Bratislava"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">PSC</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => updateField("zip", e.target.value)}
                placeholder="81101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Krajina</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                placeholder="SK"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DPH */}
      <Card>
        <CardHeader>
          <CardTitle>DPH</CardTitle>
          <CardDescription>Nastavenia dane z pridanej hodnoty</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_vat_payer"
              checked={form.is_vat_payer}
              onCheckedChange={(checked) =>
                updateField("is_vat_payer", checked === true)
              }
            />
            <Label htmlFor="is_vat_payer">Platca DPH</Label>
          </div>

          {form.is_vat_payer && (
            <div className="space-y-2">
              <Label htmlFor="vat_period">Zdanovacie obdobie DPH</Label>
              <Select
                value={form.vat_period}
                onValueChange={(v) => updateField("vat_period", v)}
              >
                <SelectTrigger id="vat_period" className="w-[280px]">
                  <SelectValue placeholder="Vyberte obdobie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mesacne">Mesacne</SelectItem>
                  <SelectItem value="stvrtrocne">Stvrtrocne</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bankovy ucet */}
      <Card>
        <CardHeader>
          <CardTitle>Bankovy ucet</CardTitle>
          <CardDescription>Hlavny bankovy ucet firmy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={form.bank_account_iban}
                onChange={(e) => updateField("bank_account_iban", e.target.value)}
                placeholder="SK31 1200 0000 1987 4263 7541"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic">BIC / SWIFT</Label>
              <Input
                id="bic"
                value={form.bank_bic}
                onChange={(e) => updateField("bank_bic", e.target.value)}
                placeholder="TATRSKBX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kontakt */}
      <Card>
        <CardHeader>
          <CardTitle>Kontakt</CardTitle>
          <CardDescription>Kontaktne udaje firmy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="info@firma.sk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+421 900 123 456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="web">Web</Label>
              <Input
                id="web"
                value={form.web}
                onChange={(e) => updateField("web", e.target.value)}
                placeholder="www.firma.sk"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Logo firmy pre faktury a doklady</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.logo_url && (
            <div className="mb-4">
              <img
                src={form.logo_url}
                alt="Logo firmy"
                className="h-24 w-auto rounded border object-contain p-2"
              />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label
              htmlFor="logo-upload"
              className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50"
            >
              {uploading ? "Nahravam..." : "Kliknite alebo pretiahnite logo sem"}
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Peciatka */}
      <Card>
        <CardHeader>
          <CardTitle>Peciatka</CardTitle>
          <CardDescription>Peciatka firmy pre faktury a doklady</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.stamp_url && (
            <div className="mb-4">
              <img
                src={form.stamp_url}
                alt="Peciatka firmy"
                className="h-24 w-auto rounded border object-contain p-2"
              />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label
              htmlFor="stamp-upload"
              className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50"
            >
              {uploadingStamp ? "Nahravam..." : "Kliknite alebo pretiahnite peciatku sem"}
              <input
                id="stamp-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStampUpload}
                disabled={uploadingStamp}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Podpis */}
      <Card>
        <CardHeader>
          <CardTitle>Podpis</CardTitle>
          <CardDescription>Podpis opravnenej osoby pre faktury a doklady</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.signature_url && (
            <div className="mb-4">
              <img
                src={form.signature_url}
                alt="Podpis"
                className="h-24 w-auto rounded border object-contain p-2"
              />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label
              htmlFor="signature-upload"
              className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50"
            >
              {uploadingSignature ? "Nahravam..." : "Kliknite alebo pretiahnite podpis sem"}
              <input
                id="signature-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSignatureUpload}
                disabled={uploadingSignature}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Ukladam..." : "Ulozit nastavenia"}
        </Button>
      </div>
    </div>
  )
}
