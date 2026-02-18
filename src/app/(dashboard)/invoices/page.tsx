"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
  FileDown,
  FileText,
  Send,
  Eye,
  Check,
  CheckCircle,
  RotateCcw,
  ArrowRightLeft,
} from "lucide-react"
import { formatMoney as formatMoneyLib } from "@/lib/format"

interface Invoice {
  id: string
  type: string
  number: string
  contact: { id: string; name: string; ico: string | null } | null
  issue_date: string
  due_date: string
  total: number
  currency: string
  status: string
  paid_amount: number
}

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: "Koncept", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  odoslana: { label: "Odoslaná", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  uhradena: { label: "Uhradená", class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  ciastocne_uhradena: { label: "Čiastočne uhradená", class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  po_splatnosti: { label: "Po splatnosti", class: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  stornovana: { label: "Stornovaná", class: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
}

const typeLabels: Record<string, string> = {
  vydana: "Vydaná",
  prijata: "Prijatá",
  zalohova: "Zálohová",
  dobropis: "Dobropis",
  proforma: "Proforma",
}

const typeFilters = [
  { value: "", label: "Všetky" },
  { value: "vydana", label: "Vydané" },
  { value: "prijata", label: "Prijaté" },
  { value: "zalohova", label: "Zálohové" },
  { value: "dobropis", label: "Dobropisy" },
  { value: "proforma", label: "Proforma" },
]

const statusFilters = [
  { value: "", label: "Všetky stavy" },
  { value: "draft", label: "Koncept" },
  { value: "odoslana", label: "Odoslané" },
  { value: "uhradena", label: "Uhradené" },
  { value: "po_splatnosti", label: "Po splatnosti" },
  { value: "stornovana", label: "Stornované" },
]

function getOverdueLevel(invoice: any): "none" | "warning" | "orange" | "critical" {
  if (invoice.status === "uhradena" || invoice.status === "stornovana") return "none"
  if (!invoice.due_date) return "none"
  const now = new Date()
  const due = new Date(invoice.due_date)
  if (due >= now) return "none"
  const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (daysOverdue <= 7) return "warning"
  if (daysOverdue <= 30) return "orange"
  return "critical"
}

const overdueRowStyles: Record<string, string> = {
  none: "",
  warning: "bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-l-yellow-400",
  orange: "bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500",
  critical: "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-600",
}

const overdueDaysColor: Record<string, string> = {
  none: "",
  warning: "text-yellow-600 dark:text-yellow-400",
  orange: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function InvoicesPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "")
  const [statusFilter, setStatusFilter] = useState("")
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ total_subtotal: number; total_vat: number; total_with_vat: number; total_unpaid: number } | null>(null)

  const fetchInvoices = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })
      if (typeFilter) params.set("type", typeFilter)
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)

      const res = await fetch(`/api/invoices?${params}`)
      const json = await res.json()

      if (res.ok) {
        setInvoices(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
        if (json.summary) setSummary(json.summary)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať faktúry" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, typeFilter, statusFilter, search, pagination.page, toast])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť túto faktúru?")) return
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Faktúra odstránená" })
      fetchInvoices()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/invoices/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const statusName = statusLabels[status]?.label || status
      toast({ title: `Stav zmenený na: ${statusName}` })
      fetchInvoices()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleCreateCreditNote = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/credit-note`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        toast({ title: "Dobropis vytvorený" })
        router.push(`/invoices/${data.data?.id || data.id}/edit`)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch { toast({ variant: "destructive", title: "Chyba" }) }
    setMenuOpen(null)
  }

  const handleConvert = async (id: string) => {
    const res = await fetch(`/api/invoices/${id}/convert`, { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      toast({ title: "Faktúra vytvorená" })
      router.push(`/invoices/${data.id}/edit`)
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleSendEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" })
      if (res.ok) { toast({ title: "Email odoslaný" }); fetchInvoices() }
      else { const e = await res.json(); toast({ variant: "destructive", title: "Chyba", description: e.error }) }
    } catch { toast({ variant: "destructive", title: "Chyba odoslania" }) }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/status`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: "uhradena" }) })
      if (res.ok) { toast({ title: "Faktúra označená ako uhradená" }); fetchInvoices() }
      else { const e = await res.json(); toast({ variant: "destructive", title: "Chyba", description: e.error }) }
    } catch { toast({ variant: "destructive", title: "Chyba" }) }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fakturácia</h1>
          <p className="text-muted-foreground">Správa faktúr a dokladov</p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nová faktúra
          </Button>
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa čísla, kontaktu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTypeFilter(f.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              {f.label}
            </Button>
          ))}
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
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Kontakt</th>
                  <th className="h-10 px-4 text-left font-medium">Vystavená</th>
                  <th className="h-10 px-4 text-left font-medium">Splatnosť</th>
                  <th className="h-10 px-4 text-right font-medium">Suma</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">Načítavam...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatiaľ nemáte žiadne faktúry.</p>
                        <Link href="/invoices/new" className="text-primary hover:underline text-sm">
                          Vytvoriť prvú faktúru
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const overdueLevel = getOverdueLevel(inv)
                    const daysOverdue = inv.due_date && overdueLevel !== "none"
                      ? Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                    return (
                    <tr key={inv.id} className={`border-b hover:bg-muted/30 transition-colors ${overdueRowStyles[overdueLevel]}`}>
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}/edit`} className="font-medium hover:text-primary font-mono">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {typeLabels[inv.type] || inv.type}
                      </td>
                      <td className="px-4 py-3">
                        {inv.contact?.name || "–"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                      <td className={`px-4 py-3 ${overdueLevel !== "none" ? "font-medium" : "text-muted-foreground"}`}>
                        {formatDate(inv.due_date)}
                        {overdueLevel !== "none" && (
                          <span className={`ml-1 text-xs ${overdueDaysColor[overdueLevel]}`}>({daysOverdue} dní)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {formatMoney(inv.total, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusLabels[inv.status]?.class || ""
                        }`}>
                          {statusLabels[inv.status]?.label || inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Quick action: Send email */}
                          {inv.status !== "draft" && inv.status !== "stornovana" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Odoslať emailom" onClick={() => handleSendEmail(inv.id)}>
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Quick action: Download PDF */}
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Stiahnuť PDF">
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          {/* Quick action: Create credit note */}
                          {(inv.type === "vydana" || inv.type === "prijata") && inv.status !== "draft" && inv.status !== "stornovana" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Vytvoriť dobropis" onClick={() => handleCreateCreditNote(inv.id)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Quick action: Mark as paid */}
                          {(inv.status === "odoslana" || inv.status === "ciastocne_uhradena" || inv.status === "po_splatnosti") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Označiť ako uhradenú" onClick={() => handleMarkPaid(inv.id)}>
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === inv.id ? null : inv.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === inv.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/invoices/${inv.id}/edit`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upraviť
                                </Link>
                                <a
                                  href={`/api/invoices/${inv.id}/pdf`}
                                  target="_blank"
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                  Stiahnuť PDF
                                </a>
                                {/* Status transitions */}
                                {inv.status === "draft" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleStatusChange(inv.id, "odoslana")}
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    Odoslať
                                  </button>
                                )}
                                {(inv.status === "odoslana" || inv.status === "ciastocne_uhradena" || inv.status === "po_splatnosti") && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleStatusChange(inv.id, "uhradena")}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Uhradená
                                  </button>
                                )}
                                {/* Credit note */}
                                {(inv.type === "vydana" || inv.type === "prijata") && inv.status !== "draft" && inv.status !== "stornovana" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleCreateCreditNote(inv.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Vytvoriť dobropis
                                  </button>
                                )}
                                {/* Convert proforma/advance */}
                                {(inv.type === "proforma" || inv.type === "zalohova") && inv.status !== "stornovana" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleConvert(inv.id)}
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                    Konvertovať na faktúru
                                  </button>
                                )}
                                {/* Storno */}
                                {inv.status !== "uhradena" && inv.status !== "stornovana" && (
                                  <div className="border-t my-1" />
                                )}
                                {inv.status === "draft" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                    onClick={() => handleDelete(inv.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Odstrániť
                                  </button>
                                )}
                                {inv.status !== "draft" && inv.status !== "uhradena" && inv.status !== "stornovana" && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                    onClick={() => handleStatusChange(inv.id, "stornovana")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Stornovať
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-medium">
                    <td colSpan={5} className="px-4 py-3 text-right text-sm text-muted-foreground">Celkom (filtrované):</td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-y-0.5 text-xs">
                        <div>Základ: <span className="font-mono">{formatMoneyLib(summary.total_subtotal)}</span></div>
                        <div>DPH: <span className="font-mono">{formatMoneyLib(summary.total_vat)}</span></div>
                        <div className="text-sm font-bold">Spolu: <span className="font-mono">{formatMoneyLib(summary.total_with_vat)}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-destructive font-bold text-xs">Neuhradené: {formatMoneyLib(summary.total_unpaid)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pagination.total} faktúr celkovo
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

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div>Nacitavanie...</div>}>
      <InvoicesPageContent />
    </Suspense>
  )
}
