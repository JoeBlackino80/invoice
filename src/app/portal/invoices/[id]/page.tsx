"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  FileText,
  CreditCard,
  Building2,
  QrCode,
  ArrowLeft,
  Loader2,
  Download,
  LogOut,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number
  total_without_vat: number
  vat_amount: number
  total_with_vat: number
}

interface InvoicePayment {
  id: string
  amount: number
  currency: string
  method: string
  status: string
  transaction_id: string | null
  paid_at: string | null
  created_at: string
}

interface InvoiceDetail {
  id: string
  number: string
  type: string
  issue_date: string
  delivery_date: string
  due_date: string
  total_amount: number
  total_with_vat: number
  currency: string
  status: string
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  notes: string | null
  supplier_name: string | null
  supplier_ico: string | null
  supplier_dic: string | null
  supplier_ic_dph: string | null
  supplier_address: string | null
  supplier_iban: string | null
  supplier_bank_name: string | null
  customer_name: string | null
  invoice_items: InvoiceItem[]
  invoice_payments: InvoicePayment[]
}

interface BankDetails {
  iban: string
  amount: number
  currency: string
  variable_symbol: string
  constant_symbol: string
  specific_symbol: string
  recipient_name: string
  note: string
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

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case "stripe":
      return "Kartou (Stripe)"
    case "gopay":
      return "GoPay"
    case "bank_transfer":
      return "Bankový prevod"
    case "cash":
      return "Hotovosť"
    default:
      return method
  }
}

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Dokončená</Badge>
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Čakajúca</Badge>
    case "failed":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Zlyhala</Badge>
    case "refunded":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Vrátená</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function PortalInvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState("")
  const [company, setCompany] = useState<{ name: string; logo_url: string | null } | null>(null)

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

    try {
      const companyData = localStorage.getItem("portal_company")
      if (companyData) setCompany(JSON.parse(companyData))
    } catch {
      // Ignorovať
    }

    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/portal/invoices/${invoiceId}`, {
          headers: { "x-portal-token": token },
        })

        if (res.status === 401) {
          handleLogout()
          return
        }

        if (res.ok) {
          const data = await res.json()
          setInvoice(data)
        }
      } catch {
        // Chyba načítania
      } finally {
        setLoading(false)
      }
    }

    fetchInvoice()
  }, [invoiceId, router, getPortalToken, handleLogout])

  const handlePayment = async (method: "stripe" | "gopay" | "bank_transfer") => {
    const token = getPortalToken()
    if (!token) return

    setPaymentLoading(true)
    setPaymentError("")
    setBankDetails(null)
    setQrCode(null)

    try {
      const res = await fetch(`/api/portal/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal-token": token,
        },
        body: JSON.stringify({ method }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPaymentError(data.error || "Nepodarilo sa iniciovať platbu")
        return
      }

      if (method === "stripe" && data.payment_url) {
        // V produkcii by sa otvorila Stripe platobná brána
        window.open(data.payment_url, "_blank")
      } else if (method === "gopay" && data.payment_url) {
        // Presmerovanie na GoPay
        window.open(data.payment_url, "_blank")
      } else if (method === "bank_transfer") {
        setBankDetails(data.bank_details || null)
        setQrCode(data.qr_code || null)
      }
    } catch {
      setPaymentError("Chyba pripojenia k serveru")
    } finally {
      setPaymentLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-muted-foreground">Načítavam faktúru...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Faktúra nenájdená</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/portal/dashboard">Späť na prehľad</Link>
          </Button>
        </div>
      </div>
    )
  }

  const canPay = invoice.status !== "uhradena" && invoice.status !== "stornovana" && invoice.status !== "draft"

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Hlavička */}
      <header className="border-b bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-8 w-8 object-contain rounded" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
            <h1 className="font-semibold">{company?.name || "Klientsky portál"}</h1>
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
          {/* Navigácia */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Späť na prehľad
            </Link>
          </Button>

          {/* Hlavička faktúry */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">Faktúra {invoice.number}</CardTitle>
                  <CardDescription className="mt-1">
                    {invoice.supplier_name && `Od: ${invoice.supplier_name}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(invoice.status)}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/api/invoices/${invoice.id}/pdf`}>
                      <Download className="h-4 w-4 mr-2" />
                      Stiahnuť PDF
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Dátum vystavenia</p>
                  <p className="font-medium">{formatDate(invoice.issue_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dátum dodania</p>
                  <p className="font-medium">{formatDate(invoice.delivery_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dátum splatnosti</p>
                  <p className={`font-medium ${
                    new Date(invoice.due_date) < new Date() && invoice.status !== "uhradena"
                      ? "text-red-600"
                      : ""
                  }`}>
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Celkom s DPH</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(invoice.total_with_vat || invoice.total_amount || 0, invoice.currency)}
                  </p>
                </div>
              </div>

              {(invoice.variable_symbol || invoice.constant_symbol || invoice.specific_symbol) && (
                <>
                  <Separator className="my-4" />
                  <div className="grid gap-4 md:grid-cols-3">
                    {invoice.variable_symbol && (
                      <div>
                        <p className="text-sm text-muted-foreground">Variabilný symbol</p>
                        <p className="font-medium">{invoice.variable_symbol}</p>
                      </div>
                    )}
                    {invoice.constant_symbol && (
                      <div>
                        <p className="text-sm text-muted-foreground">Konštantný symbol</p>
                        <p className="font-medium">{invoice.constant_symbol}</p>
                      </div>
                    )}
                    {invoice.specific_symbol && (
                      <div>
                        <p className="text-sm text-muted-foreground">Špecifický symbol</p>
                        <p className="font-medium">{invoice.specific_symbol}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Položky faktúry */}
          <Card>
            <CardHeader>
              <CardTitle>Položky faktúry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Popis</TableHead>
                      <TableHead className="text-right">Množstvo</TableHead>
                      <TableHead>Jednotka</TableHead>
                      <TableHead className="text-right">Cena/ks</TableHead>
                      <TableHead className="text-right">DPH %</TableHead>
                      <TableHead className="text-right">Bez DPH</TableHead>
                      <TableHead className="text-right">S DPH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invoice.invoice_items || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-right">{item.vat_rate}%</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_without_vat || item.quantity * item.unit_price, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total_with_vat || item.quantity * item.unit_price * (1 + item.vat_rate / 100), invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Súčty */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Základ</span>
                    <span>{formatCurrency(invoice.total_amount || 0, invoice.currency)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Celkom s DPH</span>
                    <span>{formatCurrency(invoice.total_with_vat || invoice.total_amount || 0, invoice.currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platobná sekcia */}
          {canPay && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Zaplatiť
                </CardTitle>
                <CardDescription>Vyberte spôsob platby</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Kartou (Stripe) */}
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-6 text-center">
                      <CreditCard className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-semibold mb-1">Kartou</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Platba kreditnou alebo debetnou kartou
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => handlePayment("stripe")}
                        disabled={paymentLoading}
                      >
                        {paymentLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-2" />
                        )}
                        Zaplatiť kartou
                      </Button>
                    </CardContent>
                  </Card>

                  {/* GoPay */}
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-6 text-center">
                      <ExternalLink className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-semibold mb-1">GoPay</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Platba cez platobný systém GoPay
                      </p>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handlePayment("gopay")}
                        disabled={paymentLoading}
                      >
                        {paymentLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        Zaplatiť cez GoPay
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Bankový prevod */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:border-primary transition-colors">
                        <CardContent className="p-6 text-center">
                          <Building2 className="h-8 w-8 mx-auto mb-3 text-primary" />
                          <h3 className="font-semibold mb-1">Bankový prevod</h3>
                          <p className="text-xs text-muted-foreground mb-4">
                            QR kód PAY by square a platobné údaje
                          </p>
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handlePayment("bank_transfer")}
                            disabled={paymentLoading}
                          >
                            {paymentLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <QrCode className="h-4 w-4 mr-2" />
                            )}
                            Zobraziť údaje
                          </Button>
                        </CardContent>
                      </Card>
                    </DialogTrigger>

                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Bankový prevod</DialogTitle>
                        <DialogDescription>
                          Naskenujte QR kód alebo použite platobné údaje
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {qrCode && (
                          <div className="flex justify-center">
                            <img
                              src={qrCode}
                              alt="PAY by square QR kód"
                              className="w-48 h-48"
                            />
                          </div>
                        )}

                        {bankDetails && (
                          <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">IBAN</span>
                              <span className="font-mono text-sm font-medium">{bankDetails.iban}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Suma</span>
                              <span className="font-medium">
                                {formatCurrency(bankDetails.amount, bankDetails.currency)}
                              </span>
                            </div>
                            <Separator />
                            {bankDetails.variable_symbol && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">VS</span>
                                  <span className="font-mono font-medium">{bankDetails.variable_symbol}</span>
                                </div>
                                <Separator />
                              </>
                            )}
                            {bankDetails.constant_symbol && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">KS</span>
                                  <span className="font-mono font-medium">{bankDetails.constant_symbol}</span>
                                </div>
                                <Separator />
                              </>
                            )}
                            {bankDetails.specific_symbol && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">ŠS</span>
                                  <span className="font-mono font-medium">{bankDetails.specific_symbol}</span>
                                </div>
                                <Separator />
                              </>
                            )}
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Príjemca</span>
                              <span className="font-medium">{bankDetails.recipient_name}</span>
                            </div>
                          </div>
                        )}

                        {!bankDetails && !qrCode && !paymentLoading && (
                          <p className="text-center text-muted-foreground">
                            Kliknite na tlačidlo pre zobrazenie platobných údajov
                          </p>
                        )}

                        {paymentLoading && (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {paymentError && (
                  <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-700">{paymentError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* História platieb */}
          {invoice.invoice_payments && invoice.invoice_payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  História platieb
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dátum</TableHead>
                        <TableHead>Spôsob platby</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>ID transakcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.invoice_payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.paid_at
                              ? formatDateTime(payment.paid_at)
                              : formatDateTime(payment.created_at)}
                          </TableCell>
                          <TableCell>{getPaymentMethodLabel(payment.method)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount, payment.currency || invoice.currency)}
                          </TableCell>
                          <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {payment.transaction_id || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Poznámky */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Poznámky</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
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
