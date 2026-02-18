"use client"

import { useState, useCallback, useEffect } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  Ban,
  DollarSign,
  ArrowUpDown,
  Mail,
} from "lucide-react"
import { generateCSV } from "@/lib/reports/export-generator"

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface UnpaidInvoice {
  id: string
  number: string
  type: string
  issue_date: string
  due_date: string
  total_with_vat: number
  paid_amount: number
  remaining: number
  currency: string
  status: string
  contact_name: string
  days_overdue: number
}

type SortField = "amount" | "due_date" | "days_overdue"
type SortDirection = "asc" | "desc"
type InvoiceFilter = "all" | "overdue" | "not-due"
type TypeFilter = "all" | "pohladavky" | "zavazky"

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value)
}

function getOverdueColor(days: number): string {
  if (days <= 0) return "text-green-600"
  if (days <= 30) return "text-yellow-600"
  if (days <= 60) return "text-orange-600"
  return "text-red-600"
}

function getOverdueBgColor(days: number): string {
  if (days <= 0) return ""
  if (days <= 30) return "bg-yellow-50 dark:bg-yellow-950/20"
  if (days <= 60) return "bg-orange-50 dark:bg-orange-950/20"
  return "bg-red-50 dark:bg-red-950/20"
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export default function UnpaidInvoicesPage() {
  const { activeCompanyId } = useCompany()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<UnpaidInvoice[]>([])
  const [filter, setFilter] = useState<InvoiceFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [sortField, setSortField] = useState<SortField>("days_overdue")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Fetch unpaid invoices
  const fetchInvoices = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)
    try {
      // Fetch all non-paid, non-cancelled invoices
      const { data, error } = await fetchUnpaidFromApi(activeCompanyId)
      if (error) throw new Error(error)
      setInvoices(data)
    } catch (err: any) {
      toast({
        title: "Chyba",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId, toast])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  async function fetchUnpaidFromApi(
    companyId: string
  ): Promise<{ data: UnpaidInvoice[]; error: string | null }> {
    try {
      const res = await fetch(
        `/api/invoices?company_id=${companyId}&limit=500`
      )
      if (!res.ok) {
        return { data: [], error: "Nepodarilo sa nacitat faktury" }
      }
      const json = await res.json()
      const allInvoices = json.data || []
      const today = new Date()

      const unpaid: UnpaidInvoice[] = allInvoices
        .filter(
          (inv: any) =>
            inv.status !== "paid" &&
            inv.status !== "cancelled" &&
            (inv.type === "vydana" || inv.type === "prijata")
        )
        .map((inv: any) => {
          const totalWithVat = Number(inv.total_with_vat) || 0
          const paidAmount = Number(inv.paid_amount) || 0
          const remaining = totalWithVat - paidAmount
          const dueDate = new Date(inv.due_date)
          const diffTime = today.getTime() - dueDate.getTime()
          const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24))

          return {
            id: inv.id,
            number: inv.number,
            type: inv.type,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            total_with_vat: totalWithVat,
            paid_amount: paidAmount,
            remaining,
            currency: inv.currency || "EUR",
            status: inv.status,
            contact_name: inv.contact?.name || "",
            days_overdue: daysOverdue,
          }
        })
        .filter((inv: UnpaidInvoice) => inv.remaining > 0.005)

      return { data: unpaid, error: null }
    } catch {
      return { data: [], error: "Chyba pripojenia" }
    }
  }

  // -----------------------------------------------------------------------
  // Filter + Sort
  // -----------------------------------------------------------------------

  const filteredInvoices = invoices
    .filter((inv) => {
      if (filter === "overdue" && inv.days_overdue <= 0) return false
      if (filter === "not-due" && inv.days_overdue > 0) return false
      if (typeFilter === "pohladavky" && inv.type !== "vydana") return false
      if (typeFilter === "zavazky" && inv.type !== "prijata") return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "amount":
          cmp = a.remaining - b.remaining
          break
        case "due_date":
          cmp =
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          break
        case "days_overdue":
          cmp = a.days_overdue - b.days_overdue
          break
      }
      return sortDir === "desc" ? -cmp : cmp
    })

  // -----------------------------------------------------------------------
  // Summary cards
  // -----------------------------------------------------------------------

  const totalUnpaid = invoices.reduce((sum, inv) => sum + inv.remaining, 0)
  const overdueCount = invoices.filter((inv) => inv.days_overdue > 0).length
  const pohladavkySum = invoices
    .filter((inv) => inv.type === "vydana")
    .reduce((sum, inv) => sum + inv.remaining, 0)
  const zavazkySum = invoices
    .filter((inv) => inv.type === "prijata")
    .reduce((sum, inv) => sum + inv.remaining, 0)

  // -----------------------------------------------------------------------
  // Sort toggle
  // -----------------------------------------------------------------------

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  // -----------------------------------------------------------------------
  // CSV export
  // -----------------------------------------------------------------------

  const exportCSV = () => {
    const headers = [
      "Typ",
      "Cislo faktury",
      "Kontakt",
      "Datum vystavenia",
      "Splatnost",
      "Suma",
      "Zostava",
      "Mena",
      "Dni po splatnosti",
    ]
    const rows = filteredInvoices.map((inv) => [
      inv.type === "vydana" ? "Pohladavka" : "Zavazok",
      inv.number,
      inv.contact_name,
      inv.issue_date,
      inv.due_date,
      inv.total_with_vat.toFixed(2),
      inv.remaining.toFixed(2),
      inv.currency,
      inv.days_overdue > 0 ? String(inv.days_overdue) : "0",
    ])
    const csv = generateCSV(headers, rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `neuhradene_faktury_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // -----------------------------------------------------------------------
  // Reminder placeholder
  // -----------------------------------------------------------------------

  const handleSendReminder = () => {
    toast({
      title: "Odoslanie upomienky",
      description:
        "Funkcia odoslania upomienky bude dostupna v dalsej verzii.",
    })
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!activeCompanyId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Najprv vyberte firmu.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Neuhradene faktury</h1>
          <p className="text-muted-foreground">
            Prehlad pohladavok a zavazkov
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendReminder}>
            <Mail className="h-4 w-4 mr-2" />
            Odoslat upomienku
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Celkom neuhradených
                </p>
                <p className="text-xl font-bold">{formatEur(totalUnpaid)}</p>
                <p className="text-xs text-muted-foreground">
                  {invoices.length} faktur
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Po splatnosti</p>
                <p className="text-xl font-bold text-red-600">
                  {overdueCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  faktur po splatnosti
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Suma pohladavok
                </p>
                <p className="text-xl font-bold text-blue-600">
                  {formatEur(pohladavkySum)}
                </p>
                <p className="text-xs text-muted-foreground">vydane faktury</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Suma zavazkov
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {formatEur(zavazkySum)}
                </p>
                <p className="text-xs text-muted-foreground">
                  prijate faktury
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as InvoiceFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">Vsetky</TabsTrigger>
            <TabsTrigger value="overdue">Po splatnosti</TabsTrigger>
            <TabsTrigger value="not-due">Do splatnosti</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky typy</SelectItem>
            <SelectItem value="pohladavky">
              Pohladavky (vydane)
            </SelectItem>
            <SelectItem value="zavazky">
              Zavazky (prijate)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Nacitavam...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Ziadne neuhradene faktury pre zvolene filtre.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>C. faktury</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Datum vystavenia</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("due_date")}
                    >
                      Splatnost
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1 hover:text-foreground ml-auto"
                      onClick={() => toggleSort("amount")}
                    >
                      Suma
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Zostava</TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1 hover:text-foreground ml-auto"
                      onClick={() => toggleSort("days_overdue")}
                    >
                      Dni po splatnosti
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={getOverdueBgColor(inv.days_overdue)}
                  >
                    <TableCell>
                      <Badge
                        variant={
                          inv.type === "vydana" ? "default" : "secondary"
                        }
                      >
                        {inv.type === "vydana"
                          ? "Pohladavka"
                          : "Zavazok"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {inv.number}
                    </TableCell>
                    <TableCell>{inv.contact_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right">
                      {formatEur(inv.total_with_vat)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEur(inv.remaining)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${getOverdueColor(inv.days_overdue)}`}
                    >
                      {inv.days_overdue > 0
                        ? `${inv.days_overdue} dni`
                        : "V termine"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
