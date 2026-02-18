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
  Pencil,
  Trash2,
  FileText,
  ArrowRightLeft,
} from "lucide-react"

interface Quote {
  id: string
  number: string
  contact: { id: string; name: string; ico: string | null } | null
  issue_date: string
  valid_until: string
  total: number
  currency: string
  status: string
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  odoslana: { label: "Odoslaná", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  schvalena: { label: "Schválená", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  zamietnuta: { label: "Zamietnutá", class: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  converted: { label: "Konvertovaná", class: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
}

const statusFilters = [
  { value: "", label: "Všetky stavy" },
  { value: "draft", label: "Koncept" },
  { value: "odoslana", label: "Odoslané" },
  { value: "schvalena", label: "Schválené" },
  { value: "zamietnuta", label: "Zamietnuté" },
  { value: "converted", label: "Konvertované" },
]

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function QuotesPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchQuotes = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)

      const res = await fetch(`/api/quotes?${params}`)
      const json = await res.json()

      if (res.ok) {
        setQuotes(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať cenové ponuky" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, statusFilter, search, pagination.page, toast])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť túto cenovú ponuku?")) return
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Cenová ponuka odstránená" })
      fetchQuotes()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleConvert = async (id: string) => {
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      toast({ title: "Faktúra vytvorená z cenovej ponuky" })
      router.push(`/invoices/${data.id}/edit`)
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const isExpired = (quote: Quote) => {
    if (quote.status === "schvalena" || quote.status === "converted") return false
    return new Date(quote.valid_until) < new Date()
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cenové ponuky</h1>
          <p className="text-muted-foreground">Správa cenových ponúk</p>
        </div>
        <Link href="/quotes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nová ponuka
          </Button>
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa čísla..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
      </div>

      {/* Tabuľka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Číslo</th>
                  <th className="h-10 px-4 text-left font-medium">Kontakt</th>
                  <th className="h-10 px-4 text-left font-medium">Dátum</th>
                  <th className="h-10 px-4 text-left font-medium">Platnosť do</th>
                  <th className="h-10 px-4 text-right font-medium">Suma</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">Načítavam...</td>
                  </tr>
                ) : quotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatiaľ nemáte žiadne cenové ponuky.</p>
                        <Link href="/quotes/new" className="text-primary hover:underline text-sm">
                          Vytvoriť prvú ponuku
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  quotes.map((q) => (
                    <tr key={q.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/quotes/${q.id}/edit`} className="font-medium hover:text-primary font-mono">
                          {q.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {q.contact?.name || "\u2013"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(q.issue_date)}</td>
                      <td className={`px-4 py-3 ${isExpired(q) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {formatDate(q.valid_until)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {formatMoney(q.total, q.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[q.status]?.class || ""
                        }`}>
                          {statusLabels[q.status]?.label || q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === q.id ? null : q.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === q.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/quotes/${q.id}/edit`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upraviť
                                </Link>
                                {q.status !== "converted" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleConvert(q.id)}
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                    Konvertovať na faktúru
                                  </button>
                                )}
                                {q.status !== "converted" && (
                                  <>
                                    <div className="border-t my-1" />
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                      onClick={() => handleDelete(q.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Odstrániť
                                    </button>
                                  </>
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
                {pagination.total} ponúk celkovo
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                  Predchádzajúca
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                  Ďalšia
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
