"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  ArrowDownLeft,
} from "lucide-react"

interface InvoiceDetail {
  id: string
  number: string
  issue_date: string
  due_date: string
  total: number
  paid_amount: number
  remaining: number
  currency: string
  status: string
  days_overdue: number
  is_overdue: boolean
}

interface ContactGroup {
  contact_id: string
  name: string
  ico: string | null
  email: string | null
  total_payable: number
  total_overdue: number
  invoice_count: number
  invoices: InvoiceDetail[]
}

interface Summary {
  total_payable: number
  total_overdue: number
  total_contacts: number
  total_invoices: number
}

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sk-SK")
}

export default function PayablesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()
  const [data, setData] = useState<ContactGroup[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState("")

  const fetchPayables = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ company_id: activeCompanyId })
      if (statusFilter) {
        params.set("status", statusFilter)
      }

      const res = await fetch(`/api/subledger/payables?${params}`)
      const json = await res.json()

      if (res.ok) {
        setData(json.data || [])
        setSummary(json.summary || null)
      } else {
        toast({ variant: "destructive", title: "Chyba", description: json.error || "Nepodarilo sa načítať záväzky" })
      }
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodarilo sa načítať záväzky" })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, statusFilter, toast])

  useEffect(() => {
    fetchPayables()
  }, [fetchPayables])

  const toggleContact = (contactId: string) => {
    setExpandedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  const statusFilters = [
    { value: "", label: "Všetky" },
    { value: "unpaid", label: "Neuhradené" },
    { value: "partial", label: "Čiastočne" },
    { value: "overdue", label: "Po splatnosti" },
  ]

  return (
    <div>
      <Breadcrumb />

      <div className="mb-4">
        <Link
          href="/accounting/subledger"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Späť na prehľad saldokonta
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Záväzky</h1>
          <p className="text-muted-foreground">Dodávateľské saldokonto - prehľad neuhradených faktúr</p>
        </div>
        <ArrowDownLeft className="h-8 w-8 text-green-500" />
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Celkové záväzky</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatMoney(summary.total_payable)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Po splatnosti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono text-destructive">{formatMoney(summary.total_overdue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kontakty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.total_contacts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Faktúry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.total_invoices}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {statusFilters.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium w-8"></th>
                  <th className="h-10 px-4 text-left font-medium">Kontakt</th>
                  <th className="h-10 px-4 text-left font-medium">ICO</th>
                  <th className="h-10 px-4 text-center font-medium">Pocet faktur</th>
                  <th className="h-10 px-4 text-right font-medium">Celková suma</th>
                  <th className="h-10 px-4 text-right font-medium">Uhradené</th>
                  <th className="h-10 px-4 text-right font-medium">Zostatok</th>
                  <th className="h-10 px-4 text-right font-medium">Po splatnosti</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      Načítavam...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div>
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Žiadne neuhradené záväzky.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((group) => {
                    const isExpanded = expandedContacts.has(group.contact_id)
                    const totalInvoiceAmount = group.invoices.reduce((sum, inv) => sum + inv.total, 0)
                    const totalPaid = group.invoices.reduce((sum, inv) => sum + inv.paid_amount, 0)

                    return (
                      <tbody key={group.contact_id}>
                        {/* Contact row */}
                        <tr
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => toggleContact(group.contact_id)}
                        >
                          <td className="px-4 py-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">{group.name}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">{group.ico || "-"}</td>
                          <td className="px-4 py-3 text-center">{group.invoice_count}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatMoney(totalInvoiceAmount)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatMoney(totalPaid)}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium">{formatMoney(group.total_payable)}</td>
                          <td className="px-4 py-3 text-right">
                            {group.total_overdue > 0 ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-mono font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                {formatMoney(group.total_overdue)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                        {/* Invoice detail rows */}
                        {isExpanded &&
                          group.invoices.map((inv) => (
                            <tr key={inv.id} className="border-b bg-muted/10 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 pl-8">
                                <Link
                                  href={`/invoices/${inv.id}/edit`}
                                  className="text-primary hover:underline font-mono text-xs"
                                >
                                  {inv.number}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-xs text-muted-foreground">
                                {formatDate(inv.issue_date)}
                              </td>
                              <td className="px-4 py-2 text-center text-xs">
                                <span className={inv.is_overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                  {formatDate(inv.due_date)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs">
                                {formatMoney(inv.total, inv.currency)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                                {formatMoney(inv.paid_amount, inv.currency)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs font-medium">
                                {formatMoney(inv.remaining, inv.currency)}
                              </td>
                              <td className="px-4 py-2 text-right text-xs">
                                {inv.is_overdue ? (
                                  <span className="text-destructive font-medium">
                                    {inv.days_overdue} dní
                                  </span>
                                ) : (
                                  <span className="text-green-600 dark:text-green-400">v termíne</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
