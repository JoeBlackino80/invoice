"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Send,
  Trash2,
  Loader2,
  FileText,
  Calendar,
  Hash,
  CreditCard,
  StickyNote,
} from "lucide-react"

interface PaymentItem {
  id: string
  amount: number
  currency: string
  creditor_name: string
  creditor_iban: string
  creditor_bic: string
  variable_symbol: string
  constant_symbol: string
  specific_symbol: string
  remittance_info: string
}

interface PaymentOrder {
  id: string
  company_id: string
  bank_account_id: string
  status: string
  total_amount: number
  payment_count: number
  notes: string | null
  sepa_xml: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  created_by: string
  bank_account: {
    id: string
    name: string
    iban: string
    bic: string | null
    currency: string
  } | null
  items: PaymentItem[]
}

const statusConfig: Record<string, { label: string; class: string; description: string }> = {
  nova: {
    label: "Nova",
    class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    description: "Prikaz caka na schvalenie",
  },
  schvaleny: {
    label: "Schvalena",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    description: "Prikaz bol schvaleny a je pripraveny na odoslanie do banky",
  },
  odoslany: {
    label: "Odoslana",
    class: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    description: "Prikaz bol odoslany do banky",
  },
}

function formatMoney(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("sk-SK")
}

export default function PaymentOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment-orders/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: "Platobny prikaz nebol najdeny" })
        router.push("/bank/orders")
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa nacitat platobny prikaz" })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast, router])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleApprove = async () => {
    if (!order) return
    if (!confirm("Naozaj chcete schvalit tento platobny prikaz?")) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/payment-orders/${order.id}/approve`, { method: "POST" })
      if (res.ok) {
        toast({ title: "Platobny prikaz schvaleny" })
        fetchOrder()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa schvalit prikaz" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!order) return
    try {
      const res = await fetch(`/api/payment-orders/${order.id}/download`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const shortId = order.id.substring(0, 8)
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

  const handleMarkSent = async () => {
    if (!order) return
    if (!confirm("Naozaj chcete oznacit tento prikaz ako odoslany do banky?")) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/payment-orders/${order.id}/mark-sent`, { method: "POST" })
      if (res.ok) {
        toast({ title: "Prikaz oznaceny ako odoslany" })
        fetchOrder()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa oznacit prikaz" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!order) return
    if (!confirm("Naozaj chcete odstranit tento platobny prikaz?")) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/payment-orders/${order.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Platobny prikaz odstraneny" })
        router.push("/bank/orders")
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Chyba", description: err.error })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa odstranit prikaz" })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Platobny prikaz nebol najdeny</p>
      </div>
    )
  }

  const cfg = statusConfig[order.status] || statusConfig.nova

  return (
    <div>
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Detail platobneho prikazu</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.class}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-muted-foreground">
            Vytvoreny: {formatDateTime(order.created_at)}
            {order.approved_at && ` | Schvaleny: ${formatDateTime(order.approved_at)}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/bank/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Spat na zoznam
        </Button>
      </div>

      {/* Status info */}
      <div className={`flex items-center gap-2 mb-6 p-3 rounded-md ${
        order.status === "nova"
          ? "bg-gray-50 border border-gray-200 dark:bg-gray-950 dark:border-gray-800"
          : order.status === "schvaleny"
            ? "bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800"
            : "bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800"
      }`}>
        {order.status === "odoslany" ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : order.status === "schvaleny" ? (
          <Download className="h-4 w-4 text-blue-600" />
        ) : (
          <FileText className="h-4 w-4 text-gray-600" />
        )}
        <span className="text-sm">
          {cfg.description}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CreditCard className="h-4 w-4" />
              Bankovy ucet
            </div>
            <p className="font-semibold">{order.bank_account?.name || "-"}</p>
            <p className="text-xs font-mono text-muted-foreground">{order.bank_account?.iban || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Hash className="h-4 w-4" />
              Pocet platieb
            </div>
            <p className="text-2xl font-bold">{order.payment_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CreditCard className="h-4 w-4" />
              Celkova suma
            </div>
            <p className="text-2xl font-bold">{formatMoney(Number(order.total_amount))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Datum vytvorenia
            </div>
            <p className="font-semibold">{formatDate(order.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Jednotlive platby</CardTitle>
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
                  <th className="h-10 px-4 text-left font-medium">KS</th>
                  <th className="h-10 px-4 text-left font-medium">SS</th>
                </tr>
              </thead>
              <tbody>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{item.creditor_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {item.creditor_iban}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(item.amount, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.variable_symbol || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.constant_symbol || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.specific_symbol || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      Ziadne platby v tomto prikaze
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals row */}
          {order.items && order.items.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
              <span className="text-sm font-medium">Spolu: {order.items.length} platieb</span>
              <span className="text-lg font-bold">{formatMoney(Number(order.total_amount))}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">Poznamky</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        {order.status === "nova" && (
          <>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Odstranit
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Schvalit
            </Button>
          </>
        )}
        {(order.status === "schvaleny" || order.status === "odoslany") && (
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Stiahnut XML
          </Button>
        )}
        {order.status === "schvaleny" && (
          <Button
            onClick={handleMarkSent}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Oznacit ako odoslany
          </Button>
        )}
      </div>
    </div>
  )
}
