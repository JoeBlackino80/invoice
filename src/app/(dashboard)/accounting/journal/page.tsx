"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  RotateCcw,
  BookOpen,
} from "lucide-react"

interface JournalEntryLine {
  id: string
  side: string
  amount: number
  account?: {
    id: string
    synteticky_ucet: string
    analyticky_ucet: string | null
    nazov: string
  } | null
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
  lines: JournalEntryLine[]
  created_at: string
}

const documentTypeLabels: Record<string, string> = {
  FA: "Faktura vydana",
  PFA: "Prijata faktura",
  ID: "Interny doklad",
  BV: "Bankovy vypis",
  PPD: "Prijmovy pokl. dokl.",
  VPD: "Vydavkovy pokl. dokl.",
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  posted: { label: "Zauctovane", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
}

const documentTypeFilters = [
  { value: "", label: "Vsetky typy" },
  { value: "FA", label: "FA" },
  { value: "PFA", label: "PFA" },
  { value: "ID", label: "ID" },
  { value: "BV", label: "BV" },
  { value: "PPD", label: "PPD" },
  { value: "VPD", label: "VPD" },
]

const statusFilters = [
  { value: "", label: "Vsetky stavy" },
  { value: "draft", label: "Koncept" },
  { value: "posted", label: "Zauctovane" },
]

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function JournalEntriesPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [documentTypeFilter, setDocumentTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (documentTypeFilter) params.set("document_type", documentTypeFilter)
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/journal-entries?${params}`)
      const json = await res.json()

      if (res.ok) {
        setEntries(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat uctovne zapisy" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, documentTypeFilter, statusFilter, search, dateFrom, dateTo, pagination.page, toast])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento uctovny zapis?")) return
    const res = await fetch(`/api/journal-entries/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Uctovny zapis odstraneny" })
      fetchEntries()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handlePost = async (id: string) => {
    if (!confirm("Naozaj chcete zauctovat tento zapis? Po zauctovani ho nebude mozne upravit.")) return
    const res = await fetch(`/api/journal-entries/${id}/post`, { method: "POST" })
    if (res.ok) {
      toast({ title: "Uctovny zapis zauctovany" })
      fetchEntries()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleReverse = async (id: string) => {
    if (!confirm("Naozaj chcete stornovat tento zapis? Vytvori sa novy stornovaci zapis.")) return
    const res = await fetch(`/api/journal-entries/${id}/reverse`, { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      toast({ title: "Storno zapis vytvoreny" })
      fetchEntries()
      router.push(`/accounting/journal/${data.id}`)
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uctovny dennik</h1>
          <p className="text-muted-foreground">Sprava uctovnych zapisov</p>
        </div>
        <Link href="/accounting/journal/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy zapis
          </Button>
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hladat podla cisla, popisu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={documentTypeFilter}
          onChange={(e) => {
            setDocumentTypeFilter(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          {documentTypeFilters.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          {statusFilters.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <Input
          type="date"
          placeholder="Datum od"
          className="w-40"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        />
        <Input
          type="date"
          placeholder="Datum do"
          className="w-40"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        />
      </div>

      {/* Tabulka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">C. dokladu</th>
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-left font-medium">Popis</th>
                  <th className="h-10 px-4 text-right font-medium">Suma (MD)</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">Nacitavam...</td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatial nemate ziadne uctovne zapisy.</p>
                        <Link href="/accounting/journal/new" className="text-primary hover:underline text-sm">
                          Vytvorit prvy zapis
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/accounting/journal/${entry.id}`} className="font-medium hover:text-primary font-mono">
                          {entry.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {entry.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{entry.description}</td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {formatMoney(Number(entry.total_md) || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[entry.status]?.class || ""
                        }`}>
                          {statusLabels[entry.status]?.label || entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === entry.id ? null : entry.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === entry.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/accounting/journal/${entry.id}`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Zobrazit
                                </Link>
                                {entry.status === "draft" && (
                                  <>
                                    <Link
                                      href={`/accounting/journal/${entry.id}`}
                                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => setMenuOpen(null)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Upravit
                                    </Link>
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => handlePost(entry.id)}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Zauctovat
                                    </button>
                                    <div className="border-t my-1" />
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                      onClick={() => handleDelete(entry.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Odstranit
                                    </button>
                                  </>
                                )}
                                {entry.status === "posted" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleReverse(entry.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Stornovat
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} zapisov celkovo
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                  Predchadzajuca
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                  Dalsia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
