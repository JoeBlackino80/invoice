"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Repeat,
} from "lucide-react"

interface RecurringInvoice {
  id: string
  type: string
  contact: { id: string; name: string; ico: string | null } | null
  interval: string
  next_generation_date: string
  last_generation_date: string | null
  is_active: boolean
  currency: string
  items: any
}

const intervalLabels: Record<string, string> = {
  monthly: "Mesačne",
  quarterly: "Štvrťročne",
  annually: "Ročne",
}

const typeLabels: Record<string, string> = {
  vydana: "Vydaná",
  prijata: "Prijatá",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function calculateTotal(items: any, currency: string): string {
  let parsed = items
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return formatMoney(0, currency)
    }
  }
  if (!Array.isArray(parsed)) return formatMoney(0, currency)

  const total = parsed.reduce((sum: number, item: any) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    const vatRate = Number(item.vat_rate) || 0
    const subtotal = qty * price
    const vat = subtotal * vatRate / 100
    return sum + subtotal + vat
  }, 0)

  return formatMoney(total, currency)
}

export default function RecurringInvoicesPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchRecurring = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: pagination.page.toString(),
        limit: "25",
      })

      const res = await fetch(`/api/recurring-invoices?${params}`)
      const json = await res.json()

      if (res.ok) {
        setRecurring(json.data || [])
        setPagination((prev) => ({ ...prev, ...json.pagination }))
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať opakované faktúry" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, pagination.page, toast])

  useEffect(() => {
    fetchRecurring()
  }, [fetchRecurring])

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť túto opakovanú faktúru?")) return
    const res = await fetch(`/api/recurring-invoices/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Opakovaná faktúra odstránená" })
      fetchRecurring()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    const res = await fetch(`/api/recurring-invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...recurring.find((r) => r.id === id),
        is_active: !currentlyActive,
        items: (() => {
          const found = recurring.find((r) => r.id === id)
          if (!found) return []
          let items = found.items
          if (typeof items === "string") {
            try { items = JSON.parse(items) } catch { items = [] }
          }
          return items
        })(),
      }),
    })
    if (res.ok) {
      toast({ title: currentlyActive ? "Opakovaná faktúra deaktivovaná" : "Opakovaná faktúra aktivovaná" })
      fetchRecurring()
    } else {
      const err = await res.json()
      toast({ variant: "destructive", title: "Chyba", description: err.error })
    }
    setMenuOpen(null)
  }

  const handleGenerate = async (id: string) => {
    const res = await fetch(`/api/recurring-invoices/${id}/generate`, { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      toast({ title: "Faktúra vygenerovaná" })
      fetchRecurring()
      router.push(`/invoices/${data.id}/edit`)
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
          <h1 className="text-3xl font-bold tracking-tight">Opakované faktúry</h1>
          <p className="text-muted-foreground">Šablóny pre automatické generovanie faktúr</p>
        </div>
        <Link href="/recurring/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nová opakovaná faktúra
          </Button>
        </Link>
      </div>

      {/* Tabuľka */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Typ</th>
                  <th className="h-10 px-4 text-left font-medium">Kontakt</th>
                  <th className="h-10 px-4 text-left font-medium">Interval</th>
                  <th className="h-10 px-4 text-left font-medium">Ďalšie generovanie</th>
                  <th className="h-10 px-4 text-left font-medium">Posledné generovanie</th>
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
                ) : recurring.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <Repeat className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Zatiaľ nemáte žiadne opakované faktúry.</p>
                        <Link href="/recurring/new" className="text-primary hover:underline text-sm">
                          Vytvoriť prvú opakovanú faktúru
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recurring.map((rec) => (
                    <tr key={rec.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {typeLabels[rec.type] || rec.type}
                      </td>
                      <td className="px-4 py-3">
                        {rec.contact?.name || "–"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">
                          {intervalLabels[rec.interval] || rec.interval}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rec.next_generation_date ? formatDate(rec.next_generation_date) : "–"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rec.last_generation_date ? formatDate(rec.last_generation_date) : "–"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium font-mono">
                        {calculateTotal(rec.items, rec.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rec.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 text-xs font-medium">
                            Aktívna
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 px-2 py-0.5 text-xs font-medium">
                            Neaktívna
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMenuOpen(menuOpen === rec.id ? null : rec.id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {menuOpen === rec.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border bg-popover p-1 shadow-md">
                                <Link
                                  href={`/recurring/${rec.id}/edit`}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => setMenuOpen(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Upraviť
                                </Link>
                                {rec.is_active && (
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => handleGenerate(rec.id)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Generovať teraz
                                  </button>
                                )}
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                  onClick={() => handleToggleActive(rec.id, rec.is_active)}
                                >
                                  {rec.is_active ? (
                                    <>
                                      <Pause className="h-3.5 w-3.5" />
                                      Deaktivovať
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3.5 w-3.5" />
                                      Aktivovať
                                    </>
                                  )}
                                </button>
                                <div className="border-t my-1" />
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                  onClick={() => handleDelete(rec.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Odstrániť
                                </button>
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
                {pagination.total} opakovaných faktúr celkovo
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
