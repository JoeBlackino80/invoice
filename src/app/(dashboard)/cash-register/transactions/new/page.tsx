"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Save,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Wallet,
} from "lucide-react"

interface CashRegister {
  id: string
  name: string
  currency: string
  current_balance: number
}

interface Invoice {
  id: string
  number: string
  type: string
  total_amount: number
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function NewCashTransactionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false)

  const [form, setForm] = useState({
    cash_register_id: "",
    type: searchParams.get("type") || "prijem",
    date: new Date().toISOString().split("T")[0],
    amount: "",
    purpose: "",
    person: "",
    invoice_id: "",
    invoice_number: "",
    notes: "",
  })

  const selectedRegister = registers.find((r) => r.id === form.cash_register_id)
  const currentBalance = selectedRegister?.current_balance ?? 0
  const currency = selectedRegister?.currency || "EUR"
  const amount = parseFloat(form.amount) || 0
  const insufficientBalance = form.type === "vydaj" && amount > currentBalance

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Fetch cash registers
  const fetchRegisters = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/cash-registers?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setRegisters(json.data)
        // Auto-select if there's only one register
        if (json.data.length === 1) {
          setForm((prev) => ({ ...prev, cash_register_id: json.data[0].id }))
        }
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  // Search invoices for linking
  const searchInvoices = useCallback(async (query: string) => {
    if (!activeCompanyId || !query || query.length < 2) {
      setInvoices([])
      return
    }
    setLoadingInvoices(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        search: query,
        limit: "10",
      })
      const res = await fetch(`/api/invoices?${params}`)
      const json = await res.json()
      if (res.ok) {
        setInvoices(json.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingInvoices(false)
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (invoiceSearch.length >= 2) {
        searchInvoices(invoiceSearch)
        setShowInvoiceDropdown(true)
      } else {
        setInvoices([])
        setShowInvoiceDropdown(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [invoiceSearch, searchInvoices])

  const selectInvoice = (invoice: Invoice) => {
    setForm((prev) => ({
      ...prev,
      invoice_id: invoice.id,
      invoice_number: invoice.number,
    }))
    setInvoiceSearch(invoice.number)
    setShowInvoiceDropdown(false)
  }

  const clearInvoice = () => {
    setForm((prev) => ({
      ...prev,
      invoice_id: "",
      invoice_number: "",
    }))
    setInvoiceSearch("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    if (!form.cash_register_id) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyberte pokladnu" })
      return
    }

    if (!form.purpose.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Ucel je povinny" })
      return
    }

    if (amount <= 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Suma musi byt kladne cislo" })
      return
    }

    if (insufficientBalance) {
      toast({
        variant: "destructive",
        title: "Nedostatocny zostatok",
        description: `Aktualny zostatok: ${formatMoney(currentBalance, currency)}. Pozadovana suma: ${formatMoney(amount, currency)}.`,
      })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        company_id: activeCompanyId,
        cash_register_id: form.cash_register_id,
        type: form.type,
        date: form.date,
        amount,
        purpose: form.purpose,
      }

      if (form.person.trim()) payload.person = form.person.trim()
      if (form.invoice_id) payload.invoice_id = form.invoice_id
      if (form.notes.trim()) payload.notes = form.notes.trim()

      const res = await fetch("/api/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        toast({
          title: "Doklad vytvoreny",
          description: `${data.document_number} bol uspesne vytvoreny.`,
        })
        router.push("/cash-register/transactions")
      } else {
        const err = await res.json()
        toast({
          variant: "destructive",
          title: "Chyba",
          description: typeof err.error === "string" ? err.error : "Nepodarilo sa vytvorit doklad",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit doklad" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Novy pokladnicny doklad</h1>
        <p className="text-muted-foreground">Vytvorte prijmovy (PPD) alebo vydavkovy (VPD) pokladnicny doklad</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Udaje dokladu</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cash register selector */}
                <div className="space-y-2">
                  <Label htmlFor="cash_register_id">Pokladna *</Label>
                  <select
                    id="cash_register_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.cash_register_id}
                    onChange={(e) => handleChange("cash_register_id", e.target.value)}
                    required
                  >
                    <option value="">Vyberte pokladnu</option>
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type selector */}
                <div className="space-y-2">
                  <Label>Typ dokladu *</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                        form.type === "prijem"
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "border-input hover:border-green-300"
                      }`}
                      onClick={() => handleChange("type", "prijem")}
                    >
                      <ArrowDownCircle className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-semibold">Prijem (PPD)</div>
                        <div className="text-xs opacity-75">Prijmovy pokladnicny doklad</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                        form.type === "vydaj"
                          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : "border-input hover:border-red-300"
                      }`}
                      onClick={() => handleChange("type", "vydaj")}
                    >
                      <ArrowUpCircle className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-semibold">Vydaj (VPD)</div>
                        <div className="text-xs opacity-75">Vydavkovy pokladnicny doklad</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Date and Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Datum *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(e) => handleChange("date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Suma *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => handleChange("amount", e.target.value)}
                      required
                    />
                    {insufficientBalance && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Nedostatocny zostatok v pokladni!
                      </p>
                    )}
                  </div>
                </div>

                {/* Purpose */}
                <div className="space-y-2">
                  <Label htmlFor="purpose">Ucel platby *</Label>
                  <Input
                    id="purpose"
                    placeholder="napr. Nakup kancelarskeho materialu"
                    value={form.purpose}
                    onChange={(e) => handleChange("purpose", e.target.value)}
                    required
                  />
                </div>

                {/* Person */}
                <div className="space-y-2">
                  <Label htmlFor="person">Osoba</Label>
                  <Input
                    id="person"
                    placeholder="Meno osoby"
                    value={form.person}
                    onChange={(e) => handleChange("person", e.target.value)}
                  />
                </div>

                {/* Invoice link */}
                <div className="space-y-2">
                  <Label htmlFor="invoice_search">Prepojenie na fakturu</Label>
                  <div className="relative">
                    <Input
                      id="invoice_search"
                      placeholder="Hladajte podla cisla faktury..."
                      value={invoiceSearch}
                      onChange={(e) => {
                        setInvoiceSearch(e.target.value)
                        if (form.invoice_id) {
                          clearInvoice()
                        }
                      }}
                      onFocus={() => {
                        if (invoices.length > 0) setShowInvoiceDropdown(true)
                      }}
                    />
                    {form.invoice_id && (
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <span className="text-green-600">Prepojena faktura: {form.invoice_number}</span>
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:underline"
                          onClick={clearInvoice}
                        >
                          Zrusit
                        </button>
                      </div>
                    )}
                    {showInvoiceDropdown && invoices.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowInvoiceDropdown(false)} />
                        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                          {loadingInvoices ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Hladam...</div>
                          ) : (
                            invoices.map((inv) => (
                              <button
                                key={inv.id}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => selectInvoice(inv)}
                              >
                                <span className="font-medium">{inv.number}</span>
                                <span className="text-muted-foreground">
                                  {formatMoney(inv.total_amount)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Poznamky</Label>
                  <textarea
                    id="notes"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Interne poznamky..."
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving || insufficientBalance}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uklada sa...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Vytvorit doklad
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/cash-register/transactions")}>
                    Zrusit
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Balance sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Stav pokladne
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedRegister ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pokladna</p>
                    <p className="font-semibold">{selectedRegister.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aktualny zostatok</p>
                    <p className={`text-2xl font-bold ${
                      currentBalance >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatMoney(currentBalance, currency)}
                    </p>
                  </div>
                  {form.type === "vydaj" && amount > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Zostatok po transakcii</p>
                      <p className={`text-lg font-semibold ${
                        currentBalance - amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {formatMoney(currentBalance - amount, currency)}
                      </p>
                      {insufficientBalance && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-md p-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>Nedostatocny zostatok v pokladni!</span>
                        </div>
                      )}
                    </div>
                  )}
                  {form.type === "prijem" && amount > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Zostatok po transakcii</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatMoney(currentBalance + amount, currency)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Vyberte pokladnu pre zobrazenie zostatku</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NewCashTransactionPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <NewCashTransactionPageContent />
    </Suspense>
  )
}
