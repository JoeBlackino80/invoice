"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react"

interface Account {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
}

interface Predkontacia {
  id: string
  name: string
  document_type: string
  description: string | null
  lines: {
    account_synteticky: string
    account_analyticky?: string
    side: "MD" | "D"
    is_amount_field: boolean
    fixed_amount?: number
    percentage?: number
    description?: string
  }[]
}

interface EntryLine {
  account_id: string
  account_label: string
  side: "MD" | "D"
  amount: number
  amount_currency: number | undefined
  currency: string
  exchange_rate: number | undefined
  cost_center_id: string | undefined
  project_id: string | undefined
  description: string
}

const documentTypes = [
  { value: "FA", label: "FA - Faktura vydana" },
  { value: "PFA", label: "PFA - Prijata faktura" },
  { value: "ID", label: "ID - Interny doklad" },
  { value: "BV", label: "BV - Bankovy vypis" },
  { value: "PPD", label: "PPD - Prijmovy pokl. doklad" },
  { value: "VPD", label: "VPD - Vydavkovy pokl. doklad" },
]

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function createEmptyLine(): EntryLine {
  return {
    account_id: "",
    account_label: "",
    side: "MD",
    amount: 0,
    amount_currency: undefined,
    currency: "EUR",
    exchange_rate: undefined,
    cost_center_id: undefined,
    project_id: undefined,
    description: "",
  }
}

export default function NewJournalEntryPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [documentType, setDocumentType] = useState("ID")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState<EntryLine[]>([createEmptyLine(), createEmptyLine()])

  const [accounts, setAccounts] = useState<Account[]>([])
  const [predkontacie, setPredkontacie] = useState<Predkontacia[]>([])
  const [selectedPredkontacia, setSelectedPredkontacia] = useState("")
  const [accountSearch, setAccountSearch] = useState<Record<number, string>>({})
  const [activeAccountDropdown, setActiveAccountDropdown] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/accounting/chart-of-accounts?company_id=${activeCompanyId}&limit=500`)
      const json = await res.json()
      if (res.ok) {
        setAccounts(json.data || [])
      }
    } catch {
      // silently fail
    }
  }, [activeCompanyId])

  // Fetch predkontacie
  const fetchPredkontacie = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/predkontacie?company_id=${activeCompanyId}&limit=100`)
      const json = await res.json()
      if (res.ok) {
        setPredkontacie(json.data || [])
      }
    } catch {
      // silently fail
    }
  }, [activeCompanyId])

  useEffect(() => {
    fetchAccounts()
    fetchPredkontacie()
  }, [fetchAccounts, fetchPredkontacie])

  // Calculate totals
  const mdSum = lines
    .filter((l) => l.side === "MD" && l.amount > 0)
    .reduce((sum, l) => sum + l.amount, 0)
  const dSum = lines
    .filter((l) => l.side === "D" && l.amount > 0)
    .reduce((sum, l) => sum + l.amount, 0)
  const difference = mdSum - dSum
  const isBalanced = Math.abs(difference) < 0.005

  const updateLine = (index: number, field: keyof EntryLine, value: any) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
  }

  const selectAccount = (index: number, account: Account) => {
    const label = account.analyticky_ucet
      ? `${account.synteticky_ucet}.${account.analyticky_ucet} - ${account.nazov}`
      : `${account.synteticky_ucet} - ${account.nazov}`
    updateLine(index, "account_id", account.id)
    updateLine(index, "account_label", label)
    setActiveAccountDropdown(null)
    setAccountSearch((prev) => ({ ...prev, [index]: "" }))
  }

  const getFilteredAccounts = (index: number) => {
    const searchTerm = accountSearch[index] || ""
    if (!searchTerm) return accounts.slice(0, 20)
    const lower = searchTerm.toLowerCase()
    return accounts.filter(
      (a) =>
        a.synteticky_ucet.includes(lower) ||
        (a.analyticky_ucet && a.analyticky_ucet.includes(lower)) ||
        a.nazov.toLowerCase().includes(lower)
    ).slice(0, 20)
  }

  // Apply predkontacia
  const applyPredkontacia = (predkontaciaId: string) => {
    const pk = predkontacie.find((p) => p.id === predkontaciaId)
    if (!pk) return

    setDocumentType(pk.document_type)

    const newLines: EntryLine[] = pk.lines.map((pl) => {
      // Try to find matching account
      const matchedAccount = accounts.find(
        (a) => a.synteticky_ucet === pl.account_synteticky &&
          (!pl.account_analyticky || a.analyticky_ucet === pl.account_analyticky)
      )

      const label = matchedAccount
        ? matchedAccount.analyticky_ucet
          ? `${matchedAccount.synteticky_ucet}.${matchedAccount.analyticky_ucet} - ${matchedAccount.nazov}`
          : `${matchedAccount.synteticky_ucet} - ${matchedAccount.nazov}`
        : `${pl.account_synteticky} - (ucet nenajdeny)`

      return {
        account_id: matchedAccount?.id || "",
        account_label: label,
        side: pl.side,
        amount: pl.fixed_amount || 0,
        amount_currency: undefined,
        currency: "EUR",
        exchange_rate: undefined,
        cost_center_id: undefined,
        project_id: undefined,
        description: pl.description || "",
      }
    })

    setLines(newLines)
    if (pk.description) {
      setDescription(pk.description)
    }
    setSelectedPredkontacia(predkontaciaId)
  }

  const handleSave = async (postImmediately: boolean) => {
    if (!activeCompanyId) {
      toast({ variant: "destructive", title: "Chyba", description: "Nie je vybrana firma" })
      return
    }

    if (!description.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Popis je povinny" })
      return
    }

    const validLines = lines.filter((l) => l.account_id && l.amount > 0)
    if (validLines.length === 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Pridajte aspon jeden riadok s uctom a sumou" })
      return
    }

    if (!isBalanced) {
      toast({ variant: "destructive", title: "Chyba", description: "Uctovny zapis nie je vyrovnany. Rozdiel: " + formatMoney(difference) })
      return
    }

    setSaving(true)
    try {
      // Create entry
      const entryBody = {
        company_id: activeCompanyId,
        document_type: documentType,
        date,
        description,
        lines: validLines.map((l) => ({
          account_id: l.account_id,
          side: l.side,
          amount: l.amount,
          amount_currency: l.amount_currency,
          currency: l.currency,
          exchange_rate: l.exchange_rate,
          cost_center_id: l.cost_center_id,
          project_id: l.project_id,
          description: l.description || undefined,
        })),
      }

      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      })

      if (!res.ok) {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error || "Nepodarilo sa ulozit zapis" })
        return
      }

      const created = await res.json()

      // If post immediately
      if (postImmediately) {
        const postRes = await fetch(`/api/journal-entries/${created.id}/post`, { method: "POST" })
        if (!postRes.ok) {
          const postErr = await postRes.json()
          toast({ variant: "destructive", title: "Zapis ulozeny, ale nepodarilo sa zauctovat", description: postErr.error })
          router.push(`/accounting/journal/${created.id}`)
          return
        }
        toast({ title: "Uctovny zapis vytvoreny a zauctovany" })
      } else {
        toast({ title: "Uctovny zapis ulozeny ako koncept" })
      }

      router.push("/accounting/journal")
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit uctovny zapis" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novy uctovny zapis</h1>
          <p className="text-muted-foreground">Vytvorte novy zapis do uctovneho dennika</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/accounting/journal")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Spat
        </Button>
      </div>

      {/* Predkontacia selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Predkontacia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <select
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={selectedPredkontacia}
              onChange={(e) => {
                if (e.target.value) {
                  applyPredkontacia(e.target.value)
                }
              }}
            >
              <option value="">-- Vyberte predkontaciu --</option>
              {predkontacie.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.document_type})
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Vyberte predkontaciu pre automaticke vyplnenie riadkov
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Header form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Hlavicka dokladu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Typ dokladu</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {documentTypes.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Datum uctovania</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Popis</label>
              <Input
                placeholder="Popis uctovneho zapisu..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Riadky uctovania</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-4 w-4" />
              Pridat riadok
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left font-medium w-80">Ucet</th>
                  <th className="h-10 px-3 text-center font-medium w-24">Strana</th>
                  <th className="h-10 px-3 text-right font-medium w-36">Suma</th>
                  <th className="h-10 px-3 text-left font-medium w-36">Mena</th>
                  <th className="h-10 px-3 text-left font-medium">Popis</th>
                  <th className="h-10 px-3 text-center font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-b">
                    {/* Account selection */}
                    <td className="px-3 py-2">
                      <div className="relative">
                        {line.account_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">{line.account_label}</span>
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                updateLine(index, "account_id", "")
                                updateLine(index, "account_label", "")
                                setActiveAccountDropdown(index)
                              }}
                            >
                              x
                            </button>
                          </div>
                        ) : (
                          <div>
                            <Input
                              placeholder="Hladat ucet (cislo alebo nazov)..."
                              className="h-8 text-sm"
                              value={accountSearch[index] || ""}
                              onChange={(e) => {
                                setAccountSearch((prev) => ({ ...prev, [index]: e.target.value }))
                                setActiveAccountDropdown(index)
                              }}
                              onFocus={() => setActiveAccountDropdown(index)}
                            />
                            {activeAccountDropdown === index && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setActiveAccountDropdown(null)} />
                                <div className="absolute top-full left-0 z-40 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                                  {getFilteredAccounts(index).map((account) => (
                                    <button
                                      key={account.id}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                                      onClick={() => selectAccount(index, account)}
                                    >
                                      <span className="font-mono font-medium">
                                        {account.synteticky_ucet}
                                        {account.analyticky_ucet ? `.${account.analyticky_ucet}` : ""}
                                      </span>
                                      <span className="text-muted-foreground truncate">{account.nazov}</span>
                                    </button>
                                  ))}
                                  {getFilteredAccounts(index).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">Ziadne ucty nenajdene</div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Side toggle */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            line.side === "MD"
                              ? "bg-blue-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "side", "MD")}
                        >
                          MD
                        </button>
                        <button
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            line.side === "D"
                              ? "bg-orange-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          onClick={() => updateLine(index, "side", "D")}
                        >
                          D
                        </button>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm text-right"
                        value={line.amount || ""}
                        onChange={(e) => updateLine(index, "amount", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Currency */}
                    <td className="px-3 py-2">
                      <select
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={line.currency}
                        onChange={(e) => updateLine(index, "currency", e.target.value)}
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="CZK">CZK</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Popis riadku..."
                        value={line.description}
                        onChange={(e) => updateLine(index, "description", e.target.value)}
                      />
                    </td>

                    {/* Remove button */}
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-end gap-8">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Ma dat (MD)</p>
                <p className="text-lg font-bold font-mono text-blue-600">{formatMoney(mdSum)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Dal (D)</p>
                <p className="text-lg font-bold font-mono text-orange-600">{formatMoney(dSum)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Rozdiel</p>
                <p className={`text-lg font-bold font-mono ${isBalanced ? "text-green-600" : "text-destructive"}`}>
                  {formatMoney(difference)}
                </p>
              </div>
            </div>
            {!isBalanced && (
              <div className="flex items-center gap-2 mt-2 justify-end text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Uctovny zapis nie je vyrovnany!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/accounting/journal")} disabled={saving}>
          Zrusit
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving || !isBalanced}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Ukladam..." : "Ulozit ako koncept"}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving || !isBalanced}>
          <CheckCircle className="mr-2 h-4 w-4" />
          {saving ? "Ukladam..." : "Ulozit a zauctovat"}
        </Button>
      </div>
    </div>
  )
}
