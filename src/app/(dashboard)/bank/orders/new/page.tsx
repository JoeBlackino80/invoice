"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Building2,
  FileText,
  Send,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  bic: string | null
  currency: string
}

interface Invoice {
  id: string
  number: string
  type: string
  status: string
  total_amount: number
  paid_amount: number
  currency: string
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  due_date: string | null
  issue_date: string
  contact: {
    id: string
    name: string
  } | null
  supplier_name: string | null
}

interface InvoiceWithIban extends Invoice {
  creditor_iban: string
  creditor_bic: string
  has_iban: boolean
  remaining_amount: number
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function isOverdue(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false
  return new Date(dueDateStr) < new Date()
}

export default function NewPaymentOrderPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Bank account selection
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("")

  // Step 2: Invoice selection
  const [invoices, setInvoices] = useState<InvoiceWithIban[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [overdueOnly, setOverdueOnly] = useState(false)

  // Step 3: Review
  const [requestedDate, setRequestedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  })
  const [notes, setNotes] = useState("")

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingAccounts(true)
    try {
      const res = await fetch(`/api/bank-accounts?company_id=${activeCompanyId}`)
      if (res.ok) {
        const json = await res.json()
        setBankAccounts(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat bankove ucty" })
    } finally {
      setLoadingAccounts(false)
    }
  }, [activeCompanyId, toast])

  // Fetch unpaid received invoices
  const fetchInvoices = useCallback(async () => {
    if (!activeCompanyId) return
    setLoadingInvoices(true)
    try {
      const res = await fetch(
        `/api/invoices?company_id=${activeCompanyId}&type=prijata&limit=200`
      )
      if (res.ok) {
        const json = await res.json()
        const allInvoices: Invoice[] = json.data || []

        // Filter to unpaid only and enrich with IBAN data
        const unpaidInvoices = allInvoices.filter(
          (inv) => inv.status !== "uhradena"
        )

        // Fetch IBANs for all contacts
        const enriched: InvoiceWithIban[] = await Promise.all(
          unpaidInvoices.map(async (inv) => {
            let creditorIban = ""
            let creditorBic = ""
            let hasIban = false

            if (inv.contact?.id) {
              try {
                const contactRes = await fetch(`/api/contacts/${inv.contact.id}`)
                if (contactRes.ok) {
                  const contactData = await contactRes.json()
                  const bankAccts = contactData.contact_bank_accounts || []
                  if (bankAccts.length > 0) {
                    const defaultAcct = bankAccts.find((a: any) => a.is_default) || bankAccts[0]
                    creditorIban = defaultAcct.iban || ""
                    creditorBic = defaultAcct.bic || ""
                    hasIban = !!creditorIban
                  }
                }
              } catch {
                // silently fail for IBAN lookup
              }
            }

            const remaining = Number(inv.total_amount) - Number(inv.paid_amount || 0)

            return {
              ...inv,
              creditor_iban: creditorIban,
              creditor_bic: creditorBic,
              has_iban: hasIban,
              remaining_amount: remaining,
            }
          })
        )

        setInvoices(enriched)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat faktury" })
    } finally {
      setLoadingInvoices(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchBankAccounts()
  }, [fetchBankAccounts])

  useEffect(() => {
    if (step === 2) {
      fetchInvoices()
    }
  }, [step, fetchInvoices])

  // Filtered invoices
  const filteredInvoices = overdueOnly
    ? invoices.filter((inv) => isOverdue(inv.due_date))
    : invoices

  // Selected invoices data
  const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.has(inv.id))
  const totalSelectedAmount = selectedInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0)
  const hasInvoicesWithoutIban = selectedInvoices.some((inv) => !inv.has_iban)
  const selectedBankAccount = bankAccounts.find((ba) => ba.id === selectedBankAccountId)

  const toggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedInvoiceIds.size === filteredInvoices.length) {
      setSelectedInvoiceIds(new Set())
    } else {
      setSelectedInvoiceIds(new Set(filteredInvoices.map((inv) => inv.id)))
    }
  }

  const handleSubmit = async () => {
    if (!activeCompanyId || !selectedBankAccountId || selectedInvoiceIds.size === 0) return

    // Validate all selected invoices have IBAN
    const withoutIban = selectedInvoices.filter((inv) => !inv.has_iban)
    if (withoutIban.length > 0) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: `Nasledujuce faktury nemaju IBAN dodavatela: ${withoutIban.map((inv) => inv.number).join(", ")}`,
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/payment-orders/from-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          bank_account_id: selectedBankAccountId,
          invoice_ids: Array.from(selectedInvoiceIds),
          requested_date: requestedDate,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        const order = await res.json()
        toast({ title: "Platobny prikaz vytvoreny", description: `Prikaz s ${selectedInvoiceIds.size} platbami bol uspesne vytvoreny.` })
        router.push(`/bank/orders/${order.id}`)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa vytvorit prikaz" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa vytvorit platobny prikaz" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Novy platobny prikaz</h1>
        <p className="text-muted-foreground">Vytvorte platobny prikaz z nezaplatenych prijatych faktur</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { num: 1, label: "Bankovy ucet", icon: Building2 },
          { num: 2, label: "Vyber faktur", icon: FileText },
          { num: 3, label: "Kontrola a odoslanie", icon: Send },
        ].map(({ num, label, icon: Icon }) => (
          <div key={num} className="flex items-center gap-2">
            {num > 1 && (
              <div className={`h-px w-8 ${step >= num ? "bg-primary" : "bg-border"}`} />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === num
                  ? "bg-primary text-primary-foreground"
                  : step > num
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{num}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Select bank account */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Vyberte bankovy ucet</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-3">Nemate ziadne bankove ucty.</p>
                <p className="text-sm text-muted-foreground">
                  Najskor pridajte bankovy ucet v sekcii Banka &gt; Ucty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedBankAccountId === account.id
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedBankAccountId(account.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{account.name}</h3>
                      {selectedBankAccountId === account.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">{account.iban}</p>
                    {account.bic && (
                      <p className="text-xs text-muted-foreground mt-1">BIC: {account.bic}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Mena: {account.currency}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => router.push("/bank/orders")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Spat
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedBankAccountId}
              >
                Dalej
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select invoices */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Vyberte faktury na uhradu</CardTitle>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={(e) => setOverdueOnly(e.target.checked)}
                    className="rounded border-input"
                  />
                  Iba po splatnosti
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingInvoices ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 px-4">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  {overdueOnly
                    ? "Ziadne faktury po splatnosti."
                    : "Ziadne nezaplatene prijate faktury."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-center font-medium w-12">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                          onChange={selectAll}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="h-10 px-4 text-left font-medium">Cislo</th>
                      <th className="h-10 px-4 text-left font-medium">Dodavatel</th>
                      <th className="h-10 px-4 text-right font-medium">Suma</th>
                      <th className="h-10 px-4 text-right font-medium">Zostatok</th>
                      <th className="h-10 px-4 text-left font-medium">VS</th>
                      <th className="h-10 px-4 text-left font-medium">Splatnost</th>
                      <th className="h-10 px-4 text-center font-medium">IBAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const overdue = isOverdue(inv.due_date)
                      return (
                        <tr
                          key={inv.id}
                          className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                            selectedInvoiceIds.has(inv.id) ? "bg-primary/5" : ""
                          }`}
                          onClick={() => toggleInvoice(inv.id)}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.has(inv.id)}
                              onChange={() => toggleInvoice(inv.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-input"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">{inv.number}</td>
                          <td className="px-4 py-3">
                            {inv.contact?.name || inv.supplier_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(Number(inv.total_amount), inv.currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatMoney(inv.remaining_amount, inv.currency)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {inv.variable_symbol || "-"}
                          </td>
                          <td className={`px-4 py-3 ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {inv.due_date ? formatDate(inv.due_date) : "-"}
                            {overdue && " !"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {inv.has_iban ? (
                              <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selection summary */}
            {selectedInvoiceIds.size > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Vybranych: <strong>{selectedInvoiceIds.size}</strong> faktur |
                    Celkova suma: <strong>{formatMoney(totalSelectedAmount)}</strong>
                  </span>
                  {hasInvoicesWithoutIban && (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Niektore faktury nemaju IBAN dodavatela
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between px-4 py-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Spat
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedInvoiceIds.size === 0}
              >
                Dalej
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & confirm */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle>Suhrn platobneho prikazu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Bankovy ucet</p>
                  <p className="font-semibold">{selectedBankAccount?.name}</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {selectedBankAccount?.iban}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pocet platieb</p>
                  <p className="text-2xl font-bold">{selectedInvoices.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Celkova suma</p>
                  <p className="text-2xl font-bold">{formatMoney(totalSelectedAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="requested_date">Pozadovany datum platby</Label>
                  <Input
                    id="requested_date"
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Poznamky</Label>
                  <Input
                    id="notes"
                    placeholder="Volitelne poznamky k prikazu..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {hasInvoicesWithoutIban && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 mb-6">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Niektore vybrane faktury nemaju IBAN dodavatela. Tieto faktury nebude mozne zaplatit.
                    Doplnte prosim IBAN v kontaktoch pred vytvorenim prikazu.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments list */}
          <Card>
            <CardHeader>
              <CardTitle>Zoznam platieb</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Dodavatel</th>
                      <th className="h-10 px-4 text-left font-medium">IBAN</th>
                      <th className="h-10 px-4 text-right font-medium">Suma</th>
                      <th className="h-10 px-4 text-left font-medium">VS</th>
                      <th className="h-10 px-4 text-left font-medium">Faktura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b">
                        <td className="px-4 py-3">
                          {inv.contact?.name || inv.supplier_name || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {inv.has_iban ? (
                            inv.creditor_iban
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Chyba IBAN
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatMoney(inv.remaining_amount, inv.currency)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {inv.variable_symbol || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {inv.number}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Spat
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || hasInvoicesWithoutIban || selectedInvoiceIds.size === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vytvaram prikaz...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Vytvorit prikaz
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
