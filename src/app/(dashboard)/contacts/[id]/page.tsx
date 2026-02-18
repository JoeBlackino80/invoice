"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { formatMoney, formatDate, formatDateTime } from "@/lib/format"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Loader2,
  Pencil,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  CreditCard,
  BarChart3,
  History,
} from "lucide-react"

interface Contact {
  id: string
  type: string
  name: string
  ico: string | null
  dic: string | null
  ic_dph: string | null
  street: string | null
  city: string | null
  zip: string | null
  country: string | null
  email: string | null
  phone: string | null
  web: string | null
  tags: string[] | null
  notes: string | null
}

interface Invoice {
  id: string
  number: string
  type: string
  status: string
  issue_date: string
  due_date: string
  subtotal: number
  vat_amount: number
  total: number
  paid_amount: number
}

interface InvoiceSummary {
  count: number
  total: number
  paid: number
  unpaid: number
}

interface SaldoItem {
  invoice_id: string
  number: string
  type: string
  issue_date: string
  due_date: string
  total: number
  paid: number
  outstanding: number
  status: string
}

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  changes: any
  user_email: string
  created_at: string
}

const typeLabels: Record<string, string> = {
  odberatel: "Odberateľ",
  dodavatel: "Dodávateľ",
  oba: "Oba",
}

const invoiceTypeLabels: Record<string, string> = {
  vydana: "Vydaná",
  prijata: "Prijatá",
  dobropis: "Dobropis",
  zalohova: "Zálohová",
}

const statusLabels: Record<string, string> = {
  draft: "Koncept",
  odoslana: "Odoslaná",
  uhradena: "Uhradená",
  ciastocne_uhradena: "Čiastočne uhradená",
  po_splatnosti: "Po splatnosti",
  stornovana: "Stornovaná",
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  odoslana: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  uhradena: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  ciastocne_uhradena: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  po_splatnosti: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  stornovana: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
}

export default function ContactDetailPage() {
  const params = useParams()
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)

  // Invoices tab state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null)
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  // Saldo tab state
  const [saldoItems, setSaldoItems] = useState<SaldoItem[]>([])
  const [saldoGrandTotal, setSaldoGrandTotal] = useState(0)
  const [saldoLoading, setSaldoLoading] = useState(false)

  // History tab state
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Fetch contact details
  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await fetch(`/api/contacts/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setContact(data)
        }
      } catch {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať kontakt" })
      } finally {
        setLoading(false)
      }
    }
    fetchContact()
  }, [params.id, toast])

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!activeCompanyId) return
    setInvoicesLoading(true)
    try {
      const res = await fetch(`/api/contacts/${params.id}/invoices?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setInvoices(json.data || [])
        setInvoiceSummary(json.summary || null)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať faktúry" })
    } finally {
      setInvoicesLoading(false)
    }
  }, [activeCompanyId, params.id, toast])

  // Fetch saldo
  const fetchSaldo = useCallback(async () => {
    if (!activeCompanyId) return
    setSaldoLoading(true)
    try {
      const res = await fetch(`/api/contacts/${params.id}/saldo?company_id=${activeCompanyId}`)
      const json = await res.json()
      if (res.ok) {
        setSaldoItems(json.items || [])
        setSaldoGrandTotal(json.grand_total || 0)
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať saldo" })
    } finally {
      setSaldoLoading(false)
    }
  }, [activeCompanyId, params.id, toast])

  // Fetch audit history
  const fetchHistory = useCallback(async () => {
    if (!activeCompanyId) return
    setHistoryLoading(true)
    try {
      const res = await fetch(
        `/api/settings/audit-log?company_id=${activeCompanyId}&entity_type=contacts&entity_id=${params.id}&limit=50`
      )
      const json = await res.json()
      if (res.ok) {
        setAuditEntries(json.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať históriu" })
    } finally {
      setHistoryLoading(false)
    }
  }, [activeCompanyId, params.id, toast])

  const handleTabChange = (value: string) => {
    if (value === "faktury" && invoices.length === 0 && !invoicesLoading) {
      fetchInvoices()
    } else if (value === "saldo" && saldoItems.length === 0 && !saldoLoading) {
      fetchSaldo()
    } else if (value === "historia" && auditEntries.length === 0 && !historyLoading) {
      fetchHistory()
    }
  }

  // Load invoices on initial mount when company is available
  useEffect(() => {
    if (activeCompanyId && contact) {
      fetchInvoices()
    }
  }, [activeCompanyId, contact, fetchInvoices])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Kontakt nebol nájdený</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb />

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{contact.name}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    contact.type === "odberatel"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : contact.type === "dodavatel"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  }`}
                >
                  {typeLabels[contact.type] || contact.type}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                {contact.ico && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">IČO:</span>
                    <span className="font-medium">{contact.ico}</span>
                  </div>
                )}
                {contact.dic && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">DIČ:</span>
                    <span className="font-medium">{contact.dic}</span>
                  </div>
                )}
                {contact.ic_dph && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">IČ DPH:</span>
                    <span className="font-medium">{contact.ic_dph}</span>
                  </div>
                )}
                {(contact.street || contact.city || contact.zip) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[contact.street, contact.city, contact.zip].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.web && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={contact.web.startsWith("http") ? contact.web : `https://${contact.web}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {contact.web}
                    </a>
                  </div>
                )}
              </div>

              {contact.tags && contact.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Link href={`/contacts/${params.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Upraviť
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="faktury" onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="faktury" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Faktúry
          </TabsTrigger>
          <TabsTrigger value="platby" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Platby
          </TabsTrigger>
          <TabsTrigger value="saldo" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Saldo
          </TabsTrigger>
          <TabsTrigger value="historia" className="gap-1.5">
            <History className="h-4 w-4" />
            História
          </TabsTrigger>
        </TabsList>

        {/* Faktúry Tab */}
        <TabsContent value="faktury">
          {/* Summary cards */}
          {invoiceSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">Počet faktúr</p>
                  <p className="text-2xl font-bold">{invoiceSummary.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">Celkom</p>
                  <p className="text-2xl font-bold">{formatMoney(invoiceSummary.total)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">Uhradené</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatMoney(invoiceSummary.paid)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">Neuhradené</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatMoney(invoiceSummary.unpaid)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Číslo</th>
                      <th className="h-10 px-4 text-left font-medium">Typ</th>
                      <th className="h-10 px-4 text-left font-medium">Dátum</th>
                      <th className="h-10 px-4 text-left font-medium">Splatnosť</th>
                      <th className="h-10 px-4 text-right font-medium">Suma</th>
                      <th className="h-10 px-4 text-left font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesLoading ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Žiadne faktúry pre tento kontakt.</p>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {inv.number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {invoiceTypeLabels[inv.type] || inv.type}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(inv.issue_date)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(inv.due_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatMoney(inv.total)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                statusColors[inv.status] || ""
                              }`}
                            >
                              {statusLabels[inv.status] || inv.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platby Tab */}
        <TabsContent value="platby">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Faktúra</th>
                      <th className="h-10 px-4 text-left font-medium">Typ faktúry</th>
                      <th className="h-10 px-4 text-right font-medium">Celkom</th>
                      <th className="h-10 px-4 text-right font-medium">Uhradené</th>
                      <th className="h-10 px-4 text-left font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesLoading ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : invoices.filter((inv) => Number(inv.paid_amount) > 0).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center text-muted-foreground">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Žiadne platby pre tento kontakt.</p>
                        </td>
                      </tr>
                    ) : (
                      invoices
                        .filter((inv) => Number(inv.paid_amount) > 0)
                        .map((inv) => (
                          <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <Link
                                href={`/invoices/${inv.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {inv.number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {invoiceTypeLabels[inv.type] || inv.type}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(inv.total)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                              {formatMoney(inv.paid_amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  statusColors[inv.status] || ""
                                }`}
                              >
                                {statusLabels[inv.status] || inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saldo Tab */}
        <TabsContent value="saldo">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Číslo faktúry</th>
                      <th className="h-10 px-4 text-left font-medium">Typ</th>
                      <th className="h-10 px-4 text-left font-medium">Dátum</th>
                      <th className="h-10 px-4 text-left font-medium">Splatnosť</th>
                      <th className="h-10 px-4 text-right font-medium">Celkom</th>
                      <th className="h-10 px-4 text-right font-medium">Uhradené</th>
                      <th className="h-10 px-4 text-right font-medium">Zostáva</th>
                      <th className="h-10 px-4 text-left font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldoLoading ? (
                      <tr>
                        <td colSpan={8} className="h-24 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : saldoItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="h-24 text-center text-muted-foreground">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Žiadne záznamy pre saldo.</p>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {saldoItems.map((item) => (
                          <tr
                            key={item.invoice_id}
                            className={`border-b hover:bg-muted/30 transition-colors ${
                              item.outstanding > 0 ? "" : "opacity-60"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/invoices/${item.invoice_id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {item.number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {invoiceTypeLabels[item.type] || item.type}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(item.issue_date)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(item.due_date)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(item.total)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                              {formatMoney(item.paid)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              <span
                                className={
                                  item.outstanding > 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-green-600 dark:text-green-400"
                                }
                              >
                                {formatMoney(item.outstanding)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  statusColors[item.status] || ""
                                }`}
                              >
                                {statusLabels[item.status] || item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {/* Grand total row */}
                        <tr className="border-t-2 bg-muted/50 font-medium">
                          <td className="px-4 py-3" colSpan={6}>
                            Celkový zostatok
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span
                              className={
                                saldoGrandTotal > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-green-600 dark:text-green-400"
                              }
                            >
                              {formatMoney(saldoGrandTotal)}
                            </span>
                          </td>
                          <td></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* História Tab */}
        <TabsContent value="historia">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left font-medium">Dátum</th>
                      <th className="h-10 px-4 text-left font-medium">Akcia</th>
                      <th className="h-10 px-4 text-left font-medium">Používateľ</th>
                      <th className="h-10 px-4 text-left font-medium">Zmeny</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : auditEntries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Žiadna história zmien.</p>
                        </td>
                      </tr>
                    ) : (
                      auditEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDateTime(entry.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={entry.action === "delete" ? "destructive" : "secondary"}>
                              {entry.action}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {entry.user_email || "–"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                            {entry.changes
                              ? typeof entry.changes === "string"
                                ? entry.changes
                                : JSON.stringify(entry.changes).substring(0, 120)
                              : "–"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
