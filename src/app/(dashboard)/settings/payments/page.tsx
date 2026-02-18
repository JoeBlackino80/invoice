"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/hooks/use-company"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard,
  ExternalLink,
  Building2,
  QrCode,
  Link2,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from "lucide-react"

interface PaymentSettings {
  stripe_enabled: boolean
  stripe_api_key: string
  stripe_webhook_url: string
  gopay_enabled: boolean
  gopay_goid: string
  gopay_client_id: string
  gopay_client_secret: string
  gopay_is_production: boolean
  payment_links_enabled: boolean
  payment_links_slug: string
  bank_transfer_enabled: boolean
}

interface PaymentHistoryItem {
  id: string
  invoice_id: string
  invoice_number: string
  amount: number
  currency: string
  method: string
  status: string
  transaction_id: string | null
  paid_at: string | null
  created_at: string
}

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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

function maskApiKey(key: string): string {
  if (!key) return ""
  if (key.length <= 8) return "****"
  return key.substring(0, 4) + "****" + key.substring(key.length - 4)
}

function getMethodLabel(method: string): string {
  switch (method) {
    case "stripe":
      return "Stripe"
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

function getStatusBadge(status: string) {
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

export default function PaymentSettingsPage() {
  const { activeCompanyId, activeCompany } = useCompany()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingStripe, setTestingStripe] = useState(false)
  const [testingGoPay, setTestingGoPay] = useState(false)
  const [showStripeKey, setShowStripeKey] = useState(false)
  const [showGoPaySecret, setShowGoPaySecret] = useState(false)
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([])
  const [qrPreview, setQrPreview] = useState<string | null>(null)

  const [settings, setSettings] = useState<PaymentSettings>({
    stripe_enabled: false,
    stripe_api_key: "",
    stripe_webhook_url: "",
    gopay_enabled: false,
    gopay_goid: "",
    gopay_client_id: "",
    gopay_client_secret: "",
    gopay_is_production: false,
    payment_links_enabled: false,
    payment_links_slug: "",
    bank_transfer_enabled: true,
  })

  const fetchSettings = useCallback(async () => {
    if (!activeCompanyId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/settings/payments?company_id=${activeCompanyId}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setSettings((prev) => ({ ...prev, ...data }))
        }
      }
    } catch {
      // Použiť predvolené nastavenia
    }

    // Načítať históriu platieb
    try {
      const res = await fetch(`/api/payments/history?company_id=${activeCompanyId}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.data || [])
      }
    } catch {
      // Ignorovať
    }

    setLoading(false)
  }, [activeCompanyId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Generovať QR náhľad ak je IBAN nastavený
  useEffect(() => {
    const generatePreview = async () => {
      if (!activeCompany) return

      const companyData = activeCompany as any
      const iban = companyData.bank_account_iban || companyData.iban

      if (iban) {
        try {
          const { generatePayBySquareQRCode } = await import("@/lib/payments/payment-service")
          const qr = await generatePayBySquareQRCode(
            iban,
            100,
            companyData.name || "Test",
            "1234567890",
            "",
            "",
            "Testovacia platba"
          )
          setQrPreview(qr)
        } catch {
          setQrPreview(null)
        }
      }
    }

    generatePreview()
  }, [activeCompany])

  const handleSave = async () => {
    if (!activeCompanyId) return
    setSaving(true)

    try {
      const res = await fetch("/api/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: activeCompanyId,
          ...settings,
        }),
      })

      if (res.ok) {
        toast({
          title: "Nastavenia uložené",
          description: "Platobné nastavenia boli úspešne uložené.",
        })
      } else {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa uložiť nastavenia.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Chyba",
        description: "Chyba pripojenia k serveru.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestStripe = async () => {
    setTestingStripe(true)
    // Simulácia testu pripojenia
    await new Promise((resolve) => setTimeout(resolve, 1500))
    toast({
      title: "Stripe test",
      description: settings.stripe_api_key
        ? "Pripojenie k Stripe je simulované (sandbox režim)."
        : "Zadajte API kľúč pre test pripojenia.",
    })
    setTestingStripe(false)
  }

  const handleTestGoPay = async () => {
    setTestingGoPay(true)
    // Simulácia testu pripojenia
    await new Promise((resolve) => setTimeout(resolve, 1500))
    toast({
      title: "GoPay test",
      description: settings.gopay_goid
        ? "Pripojenie ku GoPay je simulované (sandbox režim)."
        : "Zadajte GoID pre test pripojenia.",
    })
    setTestingGoPay(false)
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/payments/webhook`
    : "/api/payments/webhook"

  const paymentLinkPreview = settings.payment_links_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/payments/link/{token}`
    : ""

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({ title: "Skopírované", description: "Webhook URL bol skopírovaný." })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Načítavam nastavenia...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platobné nastavenia</h1>
          <p className="text-muted-foreground">
            Konfigurácia platobných brán a metód pre príjem platieb
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Uložiť nastavenia
        </Button>
      </div>

      <Tabs defaultValue="stripe">
        <TabsList>
          <TabsTrigger value="stripe">
            <CreditCard className="h-4 w-4 mr-2" />
            Stripe
          </TabsTrigger>
          <TabsTrigger value="gopay">
            <ExternalLink className="h-4 w-4 mr-2" />
            GoPay
          </TabsTrigger>
          <TabsTrigger value="pay-by-square">
            <QrCode className="h-4 w-4 mr-2" />
            PAY by square
          </TabsTrigger>
          <TabsTrigger value="payment-links">
            <Link2 className="h-4 w-4 mr-2" />
            Platobné linky
          </TabsTrigger>
          <TabsTrigger value="history">
            <Building2 className="h-4 w-4 mr-2" />
            História
          </TabsTrigger>
        </TabsList>

        {/* Stripe */}
        <TabsContent value="stripe" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Stripe
                  </CardTitle>
                  <CardDescription>
                    Prijímajte platby kreditnými a debetnými kartami
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {settings.stripe_enabled ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktívne
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Neaktívne
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        stripe_enabled: !prev.stripe_enabled,
                      }))
                    }
                  >
                    {settings.stripe_enabled ? "Deaktivovať" : "Aktivovať"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stripe_api_key">API kľúč (Secret Key)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="stripe_api_key"
                      type={showStripeKey ? "text" : "password"}
                      placeholder="sk_live_..."
                      value={settings.stripe_api_key}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, stripe_api_key: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowStripeKey(!showStripeKey)}
                    >
                      {showStripeKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestStripe}
                    disabled={testingStripe}
                  >
                    {testingStripe ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nájdete ho v Stripe Dashboard &gt; Developers &gt; API keys
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={handleCopyWebhook}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nastavte túto URL v Stripe Dashboard &gt; Developers &gt; Webhooks
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GoPay */}
        <TabsContent value="gopay" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    GoPay
                  </CardTitle>
                  <CardDescription>
                    Slovenský platobný systém pre online platby
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {settings.gopay_enabled ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktívne
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Neaktívne
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        gopay_enabled: !prev.gopay_enabled,
                      }))
                    }
                  >
                    {settings.gopay_enabled ? "Deaktivovať" : "Aktivovať"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gopay_goid">GoID</Label>
                <Input
                  id="gopay_goid"
                  placeholder="12345678"
                  value={settings.gopay_goid}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, gopay_goid: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gopay_client_id">Client ID</Label>
                <Input
                  id="gopay_client_id"
                  placeholder="Client ID z GoPay"
                  value={settings.gopay_client_id}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, gopay_client_id: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gopay_client_secret">Client Secret</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="gopay_client_secret"
                      type={showGoPaySecret ? "text" : "password"}
                      placeholder="Client Secret z GoPay"
                      value={settings.gopay_client_secret}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, gopay_client_secret: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowGoPaySecret(!showGoPaySecret)}
                    >
                      {showGoPaySecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestGoPay}
                    disabled={testingGoPay}
                  >
                    {testingGoPay ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Test
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Prostredie</Label>
                  <p className="text-xs text-muted-foreground">
                    {settings.gopay_is_production
                      ? "Produkčný režim - skutočné platby"
                      : "Testovací režim (sandbox) - žiadne skutočné platby"}
                  </p>
                </div>
                <Button
                  variant={settings.gopay_is_production ? "destructive" : "outline"}
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      gopay_is_production: !prev.gopay_is_production,
                    }))
                  }
                >
                  {settings.gopay_is_production ? "Prepnúť na test" : "Prepnúť na produkciu"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAY by square */}
        <TabsContent value="pay-by-square" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                PAY by square
              </CardTitle>
              <CardDescription>
                QR kódy pre bankové platby - automaticky povolené ak je nastavený IBAN
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Automaticky povolené
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    PAY by square QR kódy sa generujú automaticky pre všetky faktúry
                    s nastaveným IBAN. Zákazníci môžu naskenovať QR kód bankovou aplikáciou
                    pre rýchle vyplnenie platobných údajov.
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Náhľad QR kódu</Label>
                {qrPreview ? (
                  <div className="flex items-start gap-4">
                    <img
                      src={qrPreview}
                      alt="PAY by square náhľad"
                      className="w-40 h-40 border rounded"
                    />
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Testovacia platba:</p>
                      <p>Suma: 100,00 EUR</p>
                      <p>VS: 1234567890</p>
                      <p className="text-xs mt-2 italic">
                        Toto je náhľad. Skutočné QR kódy budú generované pre každú faktúru
                        s konkrétnymi údajmi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 bg-muted/50 rounded-lg">
                    <div className="text-center text-muted-foreground">
                      <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Nastavte IBAN vo firemných nastaveniach pre generovanie QR kódov
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platobné linky */}
        <TabsContent value="payment-links" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Platobné linky
                  </CardTitle>
                  <CardDescription>
                    Odošlite zákazníkom odkaz na úhradu faktúry
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {settings.payment_links_enabled ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktívne
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Neaktívne
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        payment_links_enabled: !prev.payment_links_enabled,
                      }))
                    }
                  >
                    {settings.payment_links_enabled ? "Deaktivovať" : "Aktivovať"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment_links_slug">Vlastný identifikátor (slug)</Label>
                <Input
                  id="payment_links_slug"
                  placeholder="moja-firma"
                  value={settings.payment_links_slug}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      payment_links_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Použije sa v URL platobného odkazu. Iba malé písmená, čísla a pomlčky.
                </p>
              </div>

              {settings.payment_links_slug && (
                <div className="space-y-2">
                  <Label>Formát platobného odkazu</Label>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <code className="text-sm font-mono break-all">
                      {paymentLinkPreview}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token bude vygenerovaný automaticky pre každú faktúru
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* História platieb */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>História platieb</CardTitle>
              <CardDescription>
                Posledné platby zo všetkých metód
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Žiadne platby</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dátum</TableHead>
                        <TableHead>Faktúra</TableHead>
                        <TableHead>Metóda</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>ID transakcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {formatDateTime(payment.paid_at || payment.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.invoice_number || "-"}
                          </TableCell>
                          <TableCell>{getMethodLabel(payment.method)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {payment.transaction_id
                              ? maskApiKey(payment.transaction_id)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
