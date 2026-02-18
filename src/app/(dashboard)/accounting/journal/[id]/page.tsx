"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
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
  RotateCcw,
  Loader2,
  Lock,
} from "lucide-react"

interface Account {
  id: string
  synteticky_ucet: string
  analyticky_ucet: string | null
  nazov: string
}

interface EntryLine {
  id?: string
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

interface JournalEntry {
  id: string
  number: string
  document_type: string
  date: string
  description: string
  status: string
  total_md: number
  total_d: number
  source_document_id: string | null
  source_invoice_id: string | null
  posted_at: string | null
  lines: {
    id: string
    position: number
    account_id: string
    side: string
    amount: number
    amount_currency: number | null
    currency: string
    exchange_rate: number | null
    cost_center_id: string | null
    project_id: string | null
    description: string | null
    account: {
      id: string
      synteticky_ucet: string
      analyticky_ucet: string | null
      nazov: string
    } | null
  }[]
}

const documentTypes = [
  { value: "FA", label: "FA - Faktura vydana" },
  { value: "PFA", label: "PFA - Prijata faktura" },
  { value: "ID", label: "ID - Interny doklad" },
  { value: "BV", label: "BV - Bankovy vypis" },
  { value: "PPD", label: "PPD - Prijmovy pokl. doklad" },
  { value: "VPD", label: "VPD - Vydavkovy pokl. doklad" },
]

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  posted: { label: "Zauctovane", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
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

export default function JournalEntryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const [documentType, setDocumentType] = useState("ID")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState<EntryLine[]>([])

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountSearch, setAccountSearch] = useState<Record<number, string>>({})
  const [activeAccountDropdown, setActiveAccountDropdown] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const isPosted = entry?.status === "posted"
  const isDraft = entry?.status === "draft"

  // Fetch the journal entry
  const fetchEntry = useCallback(async () => {
    try {
      const res = await fetch(`/api/journal-entries/${params.id}`)
      if (res.ok) {
        const data: JournalEntry = await res.json()
        setEntry(data)
        setDocumentType(data.document_type)
        setDate(data.date)
        setDescription(data.description)

        // Map lines
        const mappedLines: EntryLine[] = (data.lines || []).map((l) => {
          const accountLabel = l.account
            ? l.account.analyticky_ucet
              ? `${l.account.synteticky_ucet}.${l.account.analyticky_ucet} - ${l.account.nazov}`
              : `${l.account.synteticky_ucet} - ${l.account.nazov}`
            : ""

          return {
            id: l.id,
            account_id: l.account_id,
            account_label: accountLabel,
            side: l.side as "MD" | "D",
            amount: Number(l.amount),
            amount_currency: l.amount_currency ? Number(l.amount_currency) : undefined,
            currency: l.currency || "EUR",
            exchange_rate: l.exchange_rate ? Number(l.exchange_rate) : undefined,
            cost_center_id: l.cost_center_id || undefined,
            project_id: l.project_id || undefined,
            description: l.description || "",
          }
        })

        setLines(mappedLines.length > 0 ? mappedLines : [createEmptyLine()])
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Uctovny zapis nebol najdeny" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat uctovny zapis" })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast])

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

  useEffect(() => {
    fetchEntry()
    fetchAccounts()
  }, [fetchEntry, fetchAccounts])

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

  const handleSave = async () => {
    if (!entry || isPosted) return

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
      toast({ variant: "destructive", title: "Chyba", description: "Uctovny zapis nie je vyrovnany" })
      return
    }

    setSaving(true)
    try {
      const body = {
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

      const res = await fetch(`/api/journal-entries/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast({ title: "Uctovny zapis ulozeny" })
        fetchEntry()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa ulozit" })
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async () => {
    if (!entry || isPosted) return
    if (!confirm("Naozaj chcete zauctovat tento zapis? Po zauctovani ho nebude mozne upravit.")) return

    setSaving(true)
    try {
      // Save first if there are changes
      const validLines = lines.filter((l) => l.account_id && l.amount > 0)
      if (validLines.length > 0 && isBalanced) {
        const body = {
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

        const saveRes = await fetch(`/api/journal-entries/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!saveRes.ok) {
          const saveErr = await saveRes.json()
          toast({ variant: "destructive", title: "Chyba pri ukladani", description: saveErr.error })
          return
        }
      }

      const res = await fetch(`/api/journal-entries/${params.id}/post`, { method: "POST" })
      if (res.ok) {
        toast({ title: "Uctovny zapis zauctovany" })
        fetchEntry()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa zauctovat" })
    } finally {
      setSaving(false)
    }
  }

  const handleReverse = async () => {
    if (!entry || !isPosted) return
    if (!confirm("Naozaj chcete stornovat tento zapis? Vytvori sa novy stornovaci zapis.")) return

    setSaving(true)
    try {
      const res = await fetch(`/api/journal-entries/${params.id}/reverse`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        toast({ title: "Storno zapis vytvoreny" })
        router.push(`/accounting/journal/${data.id}`)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stornovat" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Uctovny zapis nebol najdeny</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {isPosted ? "Detail" : "Upravit"} uctovny zapis
            </h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusLabels[entry.status]?.class || ""
            }`}>
              {statusLabels[entry.status]?.label || entry.status}
            </span>
          </div>
          <p className="text-muted-foreground">
            {entry.number} | {formatDate(entry.date)}
            {isPosted && entry.posted_at && ` | Zauctovane: ${formatDate(entry.posted_at)}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/accounting/journal")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Spat
        </Button>
      </div>

      {isPosted && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
          <Lock className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Tento zapis je zauctovany a nie je mozne ho upravit. Ak potrebujete zmenu, pouzite stornovanie.
          </span>
        </div>
      )}

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
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={isPosted}
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
                disabled={isPosted}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Popis</label>
              <Input
                placeholder="Popis uctovneho zapisu..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPosted}
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
            {isDraft && (
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Pridat riadok
              </Button>
            )}
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
                  {isDraft && <th className="h-10 px-3 text-center font-medium w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-b">
                    {/* Account */}
                    <td className="px-3 py-2">
                      {isPosted ? (
                        <span className="text-sm font-mono">{line.account_label || "-"}</span>
                      ) : (
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
                                placeholder="Hladat ucet..."
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
                      )}
                    </td>

                    {/* Side */}
                    <td className="px-3 py-2 text-center">
                      {isPosted ? (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          line.side === "MD"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                        }`}>
                          {line.side}
                        </span>
                      ) : (
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
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2">
                      {isPosted ? (
                        <span className="text-sm font-mono text-right block">{formatMoney(line.amount, line.currency)}</span>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-sm text-right"
                          value={line.amount || ""}
                          onChange={(e) => updateLine(index, "amount", parseFloat(e.target.value) || 0)}
                        />
                      )}
                    </td>

                    {/* Currency */}
                    <td className="px-3 py-2">
                      {isPosted ? (
                        <span className="text-sm">{line.currency}</span>
                      ) : (
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
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2">
                      {isPosted ? (
                        <span className="text-sm text-muted-foreground">{line.description || "-"}</span>
                      ) : (
                        <Input
                          className="h-8 text-sm"
                          placeholder="Popis riadku..."
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                        />
                      )}
                    </td>

                    {/* Remove */}
                    {isDraft && (
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
                    )}
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
            {!isBalanced && isDraft && (
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
        {isDraft && (
          <>
            <Button variant="outline" onClick={() => router.push("/accounting/journal")} disabled={saving}>
              Zrusit
            </Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving || !isBalanced}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Ukladam..." : "Ulozit"}
            </Button>
            <Button onClick={handlePost} disabled={saving || !isBalanced}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {saving ? "Zauctovavam..." : "Zauctovat"}
            </Button>
          </>
        )}
        {isPosted && (
          <Button variant="destructive" onClick={handleReverse} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {saving ? "Stornujem..." : "Stornovat"}
          </Button>
        )}
      </div>
    </div>
  )
}
