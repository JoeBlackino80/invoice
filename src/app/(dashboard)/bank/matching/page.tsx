"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Play,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  BookOpen,
  Unlink,
  FileText,
  Settings,
  Loader2,
  Banknote,
} from "lucide-react"

interface BankAccount {
  id: string
  name: string
  iban: string
  currency: string
}

interface BankTransaction {
  id: string
  date: string
  amount: number
  counterparty_name: string | null
  counterparty_iban: string | null
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  description: string | null
  status: string
  matched_invoice_id: string | null
  journal_entry_id: string | null
  matched_invoice?: {
    id: string
    number: string
    total: number
    contact?: { name: string } | null
  } | null
}

interface MatchCandidate {
  invoice_id: string
  invoice_number: string
  contact_name: string
  total: number
  remaining: number
  confidence: number
  match_reason: string
}

interface MatchResult {
  transaction_id: string
  candidates: MatchCandidate[]
  best_match: MatchCandidate | null
  auto_match: boolean
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function BankMatchingPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccount, setSelectedBankAccount] = useState("")
  const [unmatchedTransactions, setUnmatchedTransactions] = useState<BankTransaction[]>([])
  const [pairedTransactions, setPairedTransactions] = useState<BankTransaction[]>([])
  const [postedTransactions, setPostedTransactions] = useState<BankTransaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [selectedMatchResult, setSelectedMatchResult] = useState<MatchResult | null>(null)

  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [pairing, setPairing] = useState<string | null>(null)
  const [unpairing, setUnpairing] = useState<string | null>(null)
  const [posting, setPosting] = useState<string | null>(null)

  // Summary counts
  const unmatchedCount = unmatchedTransactions.length
  const pairedCount = pairedTransactions.length
  const postedCount = postedTransactions.length

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const res = await fetch(`/api/bank-accounts?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setBankAccounts(json.data || [])
      }
    } catch {
      // silent
    }
  }, [activeCompanyId])

  // Fetch transactions grouped by status
  const fetchTransactions = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        limit: "200",
      })
      if (selectedBankAccount) {
        params.set("bank_account_id", selectedBankAccount)
      }

      // Fetch all transactions for this bank account
      const res = await fetch(`/api/bank-transactions?${params}`)
      const json = await res.json()

      if (res.ok) {
        const all = json.data || []
        setUnmatchedTransactions(all.filter((tx: BankTransaction) => tx.status === "neparovana"))
        setPairedTransactions(all.filter((tx: BankTransaction) => tx.status === "parovana"))
        setPostedTransactions(all.filter((tx: BankTransaction) => tx.status === "zauctovana"))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat transakcie" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, selectedBankAccount, toast])

  useEffect(() => {
    fetchBankAccounts()
  }, [fetchBankAccounts])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Run automatic matching
  const handleAutoMatch = async () => {
    if (!activeCompanyId) return
    setMatching(true)
    try {
      const res = await fetch("/api/bank-transactions/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          bank_account_id: selectedBankAccount || undefined,
          auto_pair: true,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setMatchResults(json.results || [])
        toast({
          title: "Automaticke parovanie dokoncene",
          description: `Sparovanych: ${json.matched}, Nesparovanych: ${json.unmatched}`,
        })
        // Refresh transactions
        fetchTransactions()
        setSelectedTransaction(null)
        setSelectedMatchResult(null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa spustit parovanie" })
    } finally {
      setMatching(false)
    }
  }

  // Run matching without auto-pair (just to get candidates)
  const handleFindMatches = async () => {
    if (!activeCompanyId) return
    setMatching(true)
    try {
      const res = await fetch("/api/bank-transactions/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          bank_account_id: selectedBankAccount || undefined,
          auto_pair: false,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setMatchResults(json.results || [])
        toast({
          title: "Analyza dokoncena",
          description: `Najdene zhody pre ${json.matched} transakcii, bez zhody: ${json.unmatched}`,
        })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa spustit analyzu" })
    } finally {
      setMatching(false)
    }
  }

  // Select a transaction and show match candidates
  const handleSelectTransaction = (tx: BankTransaction) => {
    setSelectedTransaction(tx)
    const result = matchResults.find((r) => r.transaction_id === tx.id)
    setSelectedMatchResult(result || null)
  }

  // Manually pair a transaction
  const handlePair = async (transactionId: string, invoiceId: string) => {
    setPairing(invoiceId)
    try {
      const res = await fetch(`/api/bank-transactions/${transactionId}/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })

      if (res.ok) {
        toast({ title: "Transakcia bola sparovana" })
        fetchTransactions()
        setSelectedTransaction(null)
        setSelectedMatchResult(null)
        // Remove from match results
        setMatchResults((prev) => prev.filter((r) => r.transaction_id !== transactionId))
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa sparovat transakciu" })
    } finally {
      setPairing(null)
    }
  }

  // Unpair a transaction
  const handleUnpair = async (transactionId: string) => {
    if (!confirm("Naozaj chcete odparovat tuto transakciu?")) return
    setUnpairing(transactionId)
    try {
      const res = await fetch(`/api/bank-transactions/${transactionId}/unpair`, {
        method: "POST",
      })

      if (res.ok) {
        toast({ title: "Transakcia bola odparovana" })
        fetchTransactions()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odparovat transakciu" })
    } finally {
      setUnpairing(null)
    }
  }

  // Post a transaction to accounting
  const handlePost = async (transactionId: string) => {
    setPosting(transactionId)
    try {
      const res = await fetch(`/api/bank-transactions/${transactionId}/post`, {
        method: "POST",
      })

      if (res.ok) {
        toast({ title: "Transakcia bola zauctovana" })
        fetchTransactions()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa zauctovat transakciu" })
    } finally {
      setPosting(null)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-500"
    if (confidence >= 0.6) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getConfidenceTextColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600"
    if (confidence >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parovanie platieb</h1>
          <p className="text-muted-foreground">Priradenie bankovych transakcii k fakturam</p>
        </div>
        <div className="flex gap-2">
          <Link href="/bank/matching/rules">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Pravidla
            </Button>
          </Link>
          <Button onClick={handleFindMatches} disabled={matching} variant="outline">
            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
            Analyzovat zhody
          </Button>
          <Button onClick={handleAutoMatch} disabled={matching}>
            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Spustit automaticke parovanie
          </Button>
        </div>
      </div>

      {/* Bank account selector */}
      <div className="flex items-end gap-4 mb-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Bankovy ucet</label>
          <select
            className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedBankAccount}
            onChange={(e) => {
              setSelectedBankAccount(e.target.value)
              setSelectedTransaction(null)
              setSelectedMatchResult(null)
            }}
          >
            <option value="">Vsetky ucty</option>
            {bankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.name} ({ba.iban})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nesparovane</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unmatchedCount}</div>
            <p className="text-xs text-muted-foreground">transakcii caka na sparovanie</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sparovane</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pairedCount}</div>
            <p className="text-xs text-muted-foreground">transakcii pripravenych na zauctovanie</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zauctovane</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{postedCount}</div>
            <p className="text-xs text-muted-foreground">transakcii zauctovanych</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Panel Layout: Unmatched Transactions + Match Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LEFT: Unmatched Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nesparovane transakcie</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Datum</th>
                    <th className="h-10 px-4 text-right font-medium">Suma</th>
                    <th className="h-10 px-4 text-left font-medium">Protistrana</th>
                    <th className="h-10 px-4 text-left font-medium">VS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nacitavam...
                      </td>
                    </tr>
                  ) : unmatchedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-muted-foreground">
                        <div>
                          <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Ziadne nesparovane transakcie.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unmatchedTransactions.map((tx) => {
                      const isSelected = selectedTransaction?.id === tx.id
                      const hasMatch = matchResults.some(
                        (r) => r.transaction_id === tx.id && r.candidates.length > 0
                      )
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10"
                              : hasMatch
                              ? "bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                              : "hover:bg-muted/30"
                          }`}
                          onClick={() => handleSelectTransaction(tx)}
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.date)}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                            tx.amount > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {tx.amount > 0 ? "+" : ""}{formatMoney(tx.amount)}
                          </td>
                          <td className="px-4 py-3 max-w-[150px] truncate" title={tx.counterparty_name || ""}>
                            {tx.counterparty_name || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {tx.variable_symbol || "-"}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Match Candidates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kandidati na sparovanie</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTransaction ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ArrowLeftRight className="h-8 w-8 mb-2 opacity-50" />
                <p>Vyberte transakciu z laveho panelu</p>
                <p className="text-xs mt-1">alebo spustite analyzu zhod</p>
              </div>
            ) : !selectedMatchResult || selectedMatchResult.candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <XCircle className="h-8 w-8 mb-2 opacity-50" />
                <p>Pre tuto transakciu neboli najdene zhody</p>
                <p className="text-xs mt-1">
                  Skuste spustit analyzu zhod alebo sparujte manualne
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selected transaction summary */}
                <div className="p-3 rounded-lg bg-muted/50 mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selectedTransaction.counterparty_name || "Neznamy"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedTransaction.date)}
                        {selectedTransaction.variable_symbol && ` | VS: ${selectedTransaction.variable_symbol}`}
                      </p>
                    </div>
                    <p className={`font-bold ${
                      selectedTransaction.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {selectedTransaction.amount > 0 ? "+" : ""}{formatMoney(selectedTransaction.amount)}
                    </p>
                  </div>
                  {selectedTransaction.description && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedTransaction.description}</p>
                  )}
                </div>

                {/* Candidates list */}
                {selectedMatchResult.candidates.map((candidate) => (
                  <div
                    key={candidate.invoice_id}
                    className="p-3 rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{candidate.invoice_number}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{candidate.contact_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatMoney(candidate.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          Zostava: {formatMoney(candidate.remaining)}
                        </p>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Zhoda</span>
                        <span className={`text-xs font-medium ${getConfidenceTextColor(candidate.confidence)}`}>
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getConfidenceColor(candidate.confidence)}`}
                          style={{ width: `${Math.round(candidate.confidence * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{candidate.match_reason}</span>
                      <Button
                        size="sm"
                        onClick={() => handlePair(selectedTransaction.id, candidate.invoice_id)}
                        disabled={pairing === candidate.invoice_id}
                      >
                        {pairing === candidate.invoice_id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        Sparovat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Paired Transactions Table */}
      {pairedTransactions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sparovane transakcie</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Datum</th>
                    <th className="h-10 px-4 text-right font-medium">Suma</th>
                    <th className="h-10 px-4 text-left font-medium">Protistrana</th>
                    <th className="h-10 px-4 text-left font-medium">VS</th>
                    <th className="h-10 px-4 text-left font-medium">Popis</th>
                    <th className="h-10 px-4 text-right font-medium">Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {pairedTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{formatMoney(tx.amount)}
                      </td>
                      <td className="px-4 py-3">{tx.counterparty_name || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.variable_symbol || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {tx.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnpair(tx.id)}
                            disabled={unpairing === tx.id}
                          >
                            {unpairing === tx.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Unlink className="mr-1 h-3 w-3" />
                            )}
                            Odparovat
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handlePost(tx.id)}
                            disabled={posting === tx.id}
                          >
                            {posting === tx.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <BookOpen className="mr-1 h-3 w-3" />
                            )}
                            Zauctovat
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posted Transactions Table */}
      {postedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zauctovane transakcie</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Datum</th>
                    <th className="h-10 px-4 text-right font-medium">Suma</th>
                    <th className="h-10 px-4 text-left font-medium">Protistrana</th>
                    <th className="h-10 px-4 text-left font-medium">VS</th>
                    <th className="h-10 px-4 text-left font-medium">Popis</th>
                    <th className="h-10 px-4 text-left font-medium">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {postedTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{formatMoney(tx.amount)}
                      </td>
                      <td className="px-4 py-3">{tx.counterparty_name || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.variable_symbol || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {tx.description || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Zauctovana
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
