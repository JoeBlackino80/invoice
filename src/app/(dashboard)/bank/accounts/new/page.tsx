"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save } from "lucide-react"

export default function NewBankAccountPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    iban: "",
    bic: "",
    bank_name: "",
    currency: "EUR",
    account_number: "221",
    opening_balance: 0,
  })

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const formatIBAN = (value: string) => {
    // Remove spaces and uppercase
    const clean = value.replace(/\s/g, "").toUpperCase()
    // Add space every 4 characters
    return clean.replace(/(.{4})/g, "$1 ").trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov uctu je povinny" })
      return
    }

    if (!form.iban.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "IBAN je povinny" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          iban: form.iban.replace(/\s/g, ""), // store without spaces
          opening_balance: Number(form.opening_balance),
          company_id: activeCompanyId,
        }),
      })

      if (res.ok) {
        toast({ title: "Bankovy ucet vytvoreny", description: `Ucet "${form.name}" bol uspesne vytvoreny.` })
        router.push("/bank")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit bankovy ucet" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit bankovy ucet" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Novy bankovy ucet</h1>
        <p className="text-muted-foreground">Pridajte bankovy ucet pre evidenciu bankovych pohybov</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Udaje bankoveho uctu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nazov uctu *</Label>
              <Input
                id="name"
                placeholder="napr. Hlavny podnikatelsky ucet"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN *</Label>
              <Input
                id="iban"
                placeholder="SK89 0200 0000 0012 3456 7890"
                value={form.iban}
                onChange={(e) => handleChange("iban", formatIBAN(e.target.value))}
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Medzinarodne cislo bankoveho uctu
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bic">BIC / SWIFT</Label>
                <Input
                  id="bic"
                  placeholder="napr. SUBASKBX"
                  value={form.bic}
                  onChange={(e) => handleChange("bic", e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Nazov banky</Label>
                <Input
                  id="bank_name"
                  placeholder="napr. Tatra banka"
                  value={form.bank_name}
                  onChange={(e) => handleChange("bank_name", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Mena</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                >
                  <option value="EUR">EUR - Euro</option>
                  <option value="CZK">CZK - Ceska koruna</option>
                  <option value="USD">USD - Americky dolar</option>
                  <option value="GBP">GBP - Britska libra</option>
                  <option value="PLN">PLN - Polsky zloty</option>
                  <option value="HUF">HUF - Madarsky forint</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening_balance">Pociatocny zostatok</Label>
                <Input
                  id="opening_balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.opening_balance}
                  onChange={(e) => handleChange("opening_balance", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Synteticky ucet</Label>
              <Input
                id="account_number"
                placeholder="221"
                value={form.account_number}
                onChange={(e) => handleChange("account_number", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cislo syntetickeho uctu v uctovnej osnove (predvolene 221 - Bankove ucty)
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uklada sa...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Vytvorit bankovy ucet
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/bank")}>
                Zrusit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
