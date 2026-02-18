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

export default function NewCashRegisterPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    currency: "EUR",
    initial_balance: 0,
    account_number: "211",
  })

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Nazov pokladne je povinny" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/cash-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          initial_balance: Number(form.initial_balance),
          company_id: activeCompanyId,
        }),
      })

      if (res.ok) {
        toast({ title: "Pokladna vytvorena", description: `Pokladna "${form.name}" bola uspesne vytvorena.` })
        router.push("/cash-register")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit pokladnu" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit pokladnu" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nova pokladna</h1>
        <p className="text-muted-foreground">Vytvorte novu pokladnu pre hotovostne operacie</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Udaje pokladne</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nazov pokladne *</Label>
              <Input
                id="name"
                placeholder="napr. Hlavna pokladna"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
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
                <Label htmlFor="initial_balance">Pociatocny zostatok</Label>
                <Input
                  id="initial_balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.initial_balance}
                  onChange={(e) => handleChange("initial_balance", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Synteticky ucet</Label>
              <Input
                id="account_number"
                placeholder="211"
                value={form.account_number}
                onChange={(e) => handleChange("account_number", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cislo syntetickeho uctu v uctovnej osnove (predvolene 211 - Pokladnica)
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
                    Vytvorit pokladnu
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/cash-register")}>
                Zrusit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
