"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  Plus,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Download,
  Send,
  Trash2,
  FileText,
  Loader2,
} from "lucide-react"

interface PaymentOrder {
  id: string
  status: string
  total_amount: number
  payment_count: number
  notes: string | null
  created_at: string
  approved_at: string | null
  bank_account: {
    id: string
    name: string
    iban: string
  } | null
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

const statusConfig: Record<string, { label: string; class: string }> = {
  nova: {
    label: "Nova",
    class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  schvaleny: {
    label: "Schvalena",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  odoslany: {
    label: "Odoslana",
    class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function PaymentOrdersPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  })
  const [statusFilter, setStatusFilter] = useState("")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchOrders = useCallback(async (page = 1) => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company_id: activeCompanyId,
        page: page.toString(),
        limit: "25",
      })
      if (statusFilter) {
        params.set("status", statusFilter)
      }

      const res = await fetch(`/api/payment-orders?${params}`)
      const json = await res.json()
      if (res.ok) {
        setOrders(json.data || [])
        setPagination(json.pagination || { total: 0, page: 1, limit: 25, totalPages: 0 })
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa nacitat prikazy" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat platobne prikazy" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, statusFilter, toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleApprove = async (id: string) => {
    if (!confirm("Naozaj chcete schvalit tento platobny prikaz?")) return
    setActionLoading(id)
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/payment-orders/${id}/approve`, { method: "POST" })
      if (res.ok) {
        toast({ title: "Platobny prikaz schvaleny" })
        fetchOrders(pagination.page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa schvalit prikaz" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownload = async (id: string) => {
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/payment-orders/${id}/download`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const shortId = id.substring(0, 8)
        a.download = `platobny_prikaz_${shortId}.xml`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({ title: "XML subor stiahnuty" })
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa stiahnut XML" })
    }
  }

  const handleMarkSent = async (id: string) => {
    if (!confirm("Naozaj chcete oznacit tento prikaz ako odoslany do banky?")) return
    setActionLoading(id)
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/payment-orders/${id}/mark-sent`, { method: "POST" })
      if (res.ok) {
        toast({ title: "Prikaz oznaceny ako odoslany" })
        fetchOrders(pagination.page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa oznacit prikaz" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstranit tento platobny prikaz?")) return
    setActionLoading(id)
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/payment-orders/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Platobny prikaz odstraneny" })
        fetchOrders(pagination.page)
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit prikaz" })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platobne prikazy</h1>
          <p className="text-muted-foreground">Sprava bankovych platobnych prikazov a SEPA platieb</p>
        </div>
        <Link href="/bank/orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novy prikaz
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Vsetky stavy</option>
          <option value="nova">Nova</option>
          <option value="schvaleny">Schvalena</option>
          <option value="odoslany">Odoslana</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zoznam prikazov</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Datum</th>
                  <th className="h-10 px-4 text-left font-medium">Bankovy ucet</th>
                  <th className="h-10 px-4 text-center font-medium">Pocet platieb</th>
                  <th className="h-10 px-4 text-right font-medium">Celkova suma</th>
                  <th className="h-10 px-4 text-center font-medium">Stav</th>
                  <th className="h-10 px-4 text-right font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Zatial nemate ziadne platobne prikazy.</p>
                      <Link href="/bank/orders/new">
                        <Button variant="link" className="mt-2">
                          Vytvorit prvy prikaz
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const cfg = statusConfig[order.status] || statusConfig.nova
                    return (
                      <tr
                        key={order.id}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/bank/orders/${order.id}`)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {order.bank_account?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {order.payment_count}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatMoney(Number(order.total_amount))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.class}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={actionLoading === order.id}
                              onClick={() => setMenuOpen(menuOpen === order.id ? null : order.id)}
                            >
                              {actionLoading === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                            {menuOpen === order.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border bg-popover p-1 shadow-md">
                                  <Link
                                    href={`/bank/orders/${order.id}`}
                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detail
                                  </Link>
                                  {order.status === "nova" && (
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => handleApprove(order.id)}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Schvalit
                                    </button>
                                  )}
                                  {(order.status === "schvaleny" || order.status === "odoslany") && (
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => handleDownload(order.id)}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Stiahnut XML
                                    </button>
                                  )}
                                  {order.status === "schvaleny" && (
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                      onClick={() => handleMarkSent(order.id)}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      Oznacit ako odoslany
                                    </button>
                                  )}
                                  {order.status === "nova" && (
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                      onClick={() => handleDelete(order.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Odstranit
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Zobrazene {orders.length} z {pagination.total} prikazov
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchOrders(pagination.page - 1)}
                >
                  Predchadzajuca
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchOrders(pagination.page + 1)}
                >
                  Nasledujuca
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
