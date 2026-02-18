"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  Download,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut,
  Loader2,
} from "lucide-react"
import Link from "next/link"

interface PortalInvoice {
  id: string
  number: string
  issue_date: string
  due_date: string
  total_amount: number
  total_with_vat: number
  currency: string
  status: string
  variable_symbol: string | null
}

interface ContactInfo {
  id: string
  name: string
  email: string
}

interface CompanyInfo {
  id: string
  name: string
  logo_url: string | null
}

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr))
}

function getStatusBadge(status: string) {
  switch (status) {
    case "uhradena":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Uhradená</Badge>
    case "odoslana":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Neuhradená</Badge>
    case "ciastocne_uhradena":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Čiastočne uhradená</Badge>
    case "po_splatnosti":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Po splatnosti</Badge>
    case "stornovana":
      return <Badge variant="secondary">Stornovaná</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "uhradena" || status === "stornovana") return false
  return new Date(dueDate) < new Date()
}

export default function PortalDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<PortalInvoice[]>([])
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  const getPortalToken = useCallback(() => {
    return localStorage.getItem("portal_token")
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem("portal_token")
    localStorage.removeItem("portal_contact")
    localStorage.removeItem("portal_company")
    router.push("/portal")
  }, [router])

  useEffect(() => {
    const token = getPortalToken()
    if (!token) {
      router.push("/portal")
      return
    }

    // Načítať uložené údaje o kontakte a firme
    try {
      const contactData = localStorage.getItem("portal_contact")
      const companyData = localStorage.getItem("portal_company")
      if (contactData) setContact(JSON.parse(contactData))
      if (companyData) setCompany(JSON.parse(companyData))
    } catch {
      // Ignorovať chybu parsovania
    }

    // Načítať faktúry
    const fetchInvoices = async () => {
      try {
        const res = await fetch("/api/portal/invoices", {
          headers: { "x-portal-token": token },
        })

        if (res.status === 401) {
          handleLogout()
          return
        }

        if (res.ok) {
          const data = await res.json()
          setInvoices(data.data || [])
        }
      } catch {
        // Chyba načítania
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [router, getPortalToken, handleLogout])

  // Súhrnné údaje
  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "odoslana" || inv.status === "ciastocne_uhradena"
  )
  const overdueInvoices = invoices.filter(
    (inv) => isOverdue(inv.due_date, inv.status) || inv.status === "po_splatnosti"
  )
  const paidInvoices = invoices.filter((inv) => inv.status === "uhradena")

  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_with_vat || 0), 0)
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + (inv.total_with_vat || 0), 0)
  const paidTotal = paidInvoices.reduce((sum, inv) => sum + (inv.total_with_vat || 0), 0)

  // Filtrovanie podľa tabu
  const getFilteredInvoices = () => {
    switch (activeTab) {
      case "unpaid":
        return unpaidInvoices
      case "paid":
        return paidInvoices
      case "overdue":
        return overdueInvoices
      default:
        return invoices
    }
  }

  const filteredInvoices = getFilteredInvoices()

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-muted-foreground">Načítavam...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Hlavička */}
      <header className="border-b bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-8 w-8 object-contain rounded"
              />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
            <div>
              <h1 className="font-semibold">{company?.name || "Klientsky portál"}</h1>
              <p className="text-xs text-muted-foreground">
                {contact?.name} ({contact?.email})
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Odhlásiť sa
          </Button>
        </div>
      </header>

      {/* Obsah */}
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Súhrnné karty */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Neuhradené</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unpaidInvoices.length}</div>
                <p className="text-xs text-muted-foreground">
                  Celkom: {formatCurrency(unpaidTotal)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Po splatnosti</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overdueInvoices.length}</div>
                <p className="text-xs text-muted-foreground">
                  Celkom: {formatCurrency(overdueTotal)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uhradené</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{paidInvoices.length}</div>
                <p className="text-xs text-muted-foreground">
                  Celkom: {formatCurrency(paidTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Tabuľka faktúr */}
          <Card>
            <CardHeader>
              <CardTitle>Faktúry</CardTitle>
              <CardDescription>Prehľad vašich faktúr</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">
                    Všetky ({invoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="unpaid">
                    Neuhradené ({unpaidInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="paid">
                    Uhradené ({paidInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="overdue">
                    Po splatnosti ({overdueInvoices.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  {filteredInvoices.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Žiadne faktúry v tejto kategórii</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Číslo</TableHead>
                            <TableHead>Dátum</TableHead>
                            <TableHead>Splatnosť</TableHead>
                            <TableHead className="text-right">Suma</TableHead>
                            <TableHead>Stav</TableHead>
                            <TableHead className="text-right">Akcie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">
                                <Link
                                  href={`/portal/invoices/${invoice.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {invoice.number}
                                </Link>
                              </TableCell>
                              <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                              <TableCell>
                                <span className={
                                  isOverdue(invoice.due_date, invoice.status)
                                    ? "text-red-600 font-medium"
                                    : ""
                                }>
                                  {formatDate(invoice.due_date)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(
                                  invoice.total_with_vat || invoice.total_amount || 0,
                                  invoice.currency
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/api/invoices/${invoice.id}/pdf`}>
                                      <Download className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  {invoice.status !== "uhradena" && invoice.status !== "stornovana" && (
                                    <Button size="sm" asChild>
                                      <Link href={`/portal/invoices/${invoice.id}`}>
                                        <CreditCard className="h-4 w-4 mr-1" />
                                        Zaplatiť
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Pätička */}
      <footer className="border-t bg-background px-6 py-3">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Klientsky portál - Bezpečný prístup k vašim faktúram a platbám
          </p>
        </div>
      </footer>
    </div>
  )
}
